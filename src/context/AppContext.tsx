import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ImportedData, Settings, ApprovalStatus, DataTableKey, SyncState, TabSyncResult } from '../types';
import { loadData, saveTableData, clearTableData, loadBidApprovals, saveBidApprovals, loadNegApprovals, saveNegApprovals } from '../store/dataStore';
import { loadSettings, saveSettings } from '../store/settingsStore';
import { SHEET_TABS, SHEET_PARSERS, extractSheetId, fetchTabAsCSV } from '../lib/googleSheets';
import {
  GENERATED_DASHBOARD_SETTINGS_TAB,
  GENERATED_SETTINGS_TAB,
  mergeGeneratedDashboardSettings,
  mergeGeneratedSheetSettings,
} from '../lib/generatedSheetAdapter';
import { parseCSV } from '../lib/csv/parser';
import { addActiveAccountScope, getActiveAccountScope, getActiveSpreadsheetId } from '../lib/accountSources';
import type { AccountSourceScope } from '../lib/accountSources';
import { applyAccountScope, ensureAccountSourceForScope, inferAccountScopeFromRows } from '../lib/accountScopeInference';
import { recordSyncRun } from '../lib/syncRuns';
import { fetchVoluumRowsForDashboard } from '../lib/voluum/dashboardImport';

interface AppContextValue {
  data: ImportedData;
  settings: Settings;
  bidApprovals: Record<string, ApprovalStatus>;
  negApprovals: Record<string, ApprovalStatus>;
  syncState: SyncState;
  refreshData: () => void;
  updateTableData: <T>(key: DataTableKey, rows: T[], source: string) => void;
  updateSettings: (s: Settings) => void;
  setBidApproval: (key: string, status: ApprovalStatus) => void;
  setNegApproval: (key: string, status: ApprovalStatus) => void;
  syncSheet: (overrideSheetId?: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<ImportedData>(() => loadData());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [bidApprovals, setBidApprovals] = useState<Record<string, ApprovalStatus>>(() => loadBidApprovals());
  const [negApprovals, setNegApprovals] = useState<Record<string, ApprovalStatus>>(() => loadNegApprovals());
  const [syncState, setSyncState] = useState<SyncState>({ running: false, lastAt: null, results: [] });

  // Stable ref so interval callback always calls the latest syncSheet
  const syncSheetRef = useRef<(overrideSheetId?: string) => Promise<void>>();

  const refreshData = useCallback(() => {
    setData(loadData());
    setBidApprovals(loadBidApprovals());
    setNegApprovals(loadNegApprovals());
  }, []);

  const updateTableData = useCallback(<T,>(key: DataTableKey, rows: T[], source: string) => {
    saveTableData(key, rows, source);
    setData(loadData());
  }, []);

  const updateSettings = useCallback((s: Settings) => {
    saveSettings(s);
    setSettings(s);
  }, []);

  const setBidApproval = useCallback((key: string, status: ApprovalStatus) => {
    setBidApprovals((prev) => {
      const next = { ...prev, [key]: status };
      saveBidApprovals(next);
      return next;
    });
  }, []);

  const setNegApproval = useCallback((key: string, status: ApprovalStatus) => {
    setNegApprovals((prev) => {
      const next = { ...prev, [key]: status };
      saveNegApprovals(next);
      return next;
    });
  }, []);

  const syncSheet = useCallback(async (overrideSheetId?: string) => {
    const rawId = overrideSheetId ?? getActiveSpreadsheetId(settings);
    const sheetId = extractSheetId(rawId);
    if (!sheetId) return;
    const startedAt = new Date().toISOString();
    let syncSettings = settings;
    let inferredScope: AccountSourceScope | null = null;

    setSyncState({
      running: true,
      lastAt: null,
      results: SHEET_TABS.map((t) => ({
        key: t.key, tabName: t.tabName, label: t.label, optional: t.optional, status: 'idle' as const,
      })),
    });

    try {
      const generatedSettings = await fetchTabAsCSV(sheetId, GENERATED_SETTINGS_TAB);
      if (generatedSettings.csv) {
        const settingsRows = await parseCSV(generatedSettings.csv);
        syncSettings = mergeGeneratedSheetSettings(syncSettings, settingsRows, sheetId, rawId);
      }

      const dashboardSettings = await fetchTabAsCSV(sheetId, GENERATED_DASHBOARD_SETTINGS_TAB);
      if (dashboardSettings.csv) {
        const dashboardRows = await parseCSV(dashboardSettings.csv);
        syncSettings = mergeGeneratedDashboardSettings(syncSettings, dashboardRows);
      }

      if (JSON.stringify(syncSettings) !== JSON.stringify(settings)) {
        saveSettings(syncSettings);
        setSettings(syncSettings);
      }
    } catch {
      // Generated settings are helpful but not required; raw data rows can still provide scope.
    }

    const syncScope = getActiveAccountScope(syncSettings);
    const results: TabSyncResult[] = [];

    for (const tab of SHEET_TABS) {
      const base = { key: tab.key, tabName: tab.tabName, label: tab.label, optional: tab.optional };
      const aliases = tab.aliases ?? [];
      const candidates = Array.from(new Set([...aliases, tab.tabName]));

      try {
        let tabName = candidates[0];
        let result = await fetchTabAsCSV(sheetId, tabName);
        for (const candidate of candidates.slice(1)) {
          if (result.error !== 'missing' && result.csv) break;
          const nextResult = await fetchTabAsCSV(sheetId, candidate);
          if (nextResult.error !== 'missing') {
            tabName = candidate;
            result = nextResult;
          }
        }

        if (result.error === 'private') {
          clearTableData(tab.key, `sheet:${sheetId}/${tabName}:private`);
          results.push({ ...base, tabName, status: 'private', error: result.message ?? undefined });
          continue;
        }
        if (result.error === 'missing') {
          clearTableData(tab.key, `sheet:${sheetId}/${tabName}:missing`);
          results.push({ ...base, tabName, status: 'missing', error: result.message ?? undefined });
          continue;
        }
        if (result.error || !result.csv) {
          clearTableData(tab.key, `sheet:${sheetId}/${tabName}:error`);
          results.push({ ...base, tabName, status: 'error', error: result.message ?? 'Unknown error' });
          continue;
        }

        const rawRows = await parseCSV(result.csv);
        if (!rawRows.length) {
          clearTableData(tab.key, `sheet:${sheetId}/${tabName}:empty`);
          results.push({ ...base, tabName, status: 'missing' });
          continue;
        }

        const normalizedRows = tab.normalizeRows?.(rawRows) ?? rawRows;
        const rowScope = syncScope ?? inferAccountScopeFromRows(normalizedRows, sheetId);
        if (!syncScope && rowScope && !inferredScope) inferredScope = rowScope;
        const parsedRows = SHEET_PARSERS[tab.key](normalizedRows);
        const parsed = rowScope
          ? applyAccountScope(parsedRows, rowScope)
          : addActiveAccountScope(parsedRows, syncSettings);
        saveTableData(tab.key, parsed, `sheet:${sheetId}/${tabName}`);
        results.push({ ...base, tabName, status: 'synced', rows: parsed.length });
      } catch (err) {
        clearTableData(tab.key, `sheet:${sheetId}/${tab.tabName}:error`);
        results.push({ ...base, status: 'error', error: String(err) });
      }
    }

    if (!syncScope && inferredScope) {
      const scopedSettings = ensureAccountSourceForScope(syncSettings, inferredScope, rawId);
      syncSettings = scopedSettings;
      saveSettings(scopedSettings);
      setSettings(scopedSettings);
    }

    // Detect if the sheet itself is inaccessible (all tabs returned private/error)
    const privateCount = results.filter((r) => r.status === 'private').length;
    const sheetError = privateCount > 0
      ? 'Sheet is not publicly accessible. Share it as "Anyone with the link can view".'
      : undefined;
    const syncedRows = results
      .filter((r) => r.status === 'synced')
      .reduce((sum, row) => sum + (row.rows ?? 0), 0);
    const syncedTabs = results.filter((r) => r.status === 'synced').length;
    const hasError = results.some((r) => r.status === 'error' || r.status === 'private');
    const hasMissing = results.some((r) => r.status === 'missing');
    const hasSynced = syncedRows > 0 || syncedTabs > 0;
    const syncStatus = hasError ? 'failed' : hasSynced && hasMissing ? 'warning' : hasSynced ? 'success' : 'warning';
    const finalScope = syncScope ?? inferredScope;

    if (finalScope) {
      try {
        const storedAfterSheet = loadData();
        const voluumRows = await fetchVoluumRowsForDashboard(finalScope, {
          campaigns: storedAfterSheet.campaigns,
          settings: syncSettings,
        });
        if (voluumRows.length > 0) {
          saveTableData(
            'voluum',
            voluumRows,
            `voluum-api:last30/campaign:active:${syncSettings.voluum_match_mode}:${syncSettings.voluum_conversion_metric}`
          );
        } else {
          clearTableData('voluum', `voluum-api:last30/campaign:active:${syncSettings.voluum_match_mode}:empty-or-filtered`);
        }
      } catch (e) {
        clearTableData('voluum', 'voluum-api:last30/campaign:active:error');
        console.warn('[BitMonitor] Voluum dashboard import skipped:', e);
      }

      recordSyncRun(finalScope, {
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        status: syncStatus,
        rows_imported: syncedRows,
        tabs_updated: syncedTabs,
        error_message: sheetError ?? null,
        trigger_type: 'manual',
        source: `sheet:${sheetId}`,
      });
    }

    setData(loadData());
    setSyncState({ running: false, lastAt: new Date().toISOString(), results, sheetError });
  }, [settings]);

  useEffect(() => { syncSheetRef.current = syncSheet; }, [syncSheet]);

  // Auto-refresh
  useEffect(() => {
    if (!getActiveSpreadsheetId(settings) || settings.sheet_auto_refresh === 'off') return;
    const ms = settings.sheet_auto_refresh === '15min' ? 15 * 60 * 1000 : 60 * 60 * 1000;
    const id = setInterval(() => syncSheetRef.current?.(), ms);
    return () => clearInterval(id);
  }, [settings]);

  useEffect(() => {
    const handler = () => refreshData();
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [refreshData]);

  return (
    <AppContext.Provider value={{
      data, settings, bidApprovals, negApprovals, syncState,
      refreshData, updateTableData, updateSettings,
      setBidApproval, setNegApproval, syncSheet,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
