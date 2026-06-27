import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ImportedData, Settings, ApprovalStatus, DataTableKey, SyncState, TabSyncResult } from '../types';
import { loadData, saveTableData, loadBidApprovals, saveBidApprovals, loadNegApprovals, saveNegApprovals } from '../store/dataStore';
import { loadSettings, saveSettings } from '../store/settingsStore';
import { SHEET_TABS, SHEET_PARSERS, extractSheetId, fetchTabAsCSV } from '../lib/googleSheets';
import { parseCSV } from '../lib/csv/parser';

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
    const rawId = overrideSheetId ?? settings.sheet_id;
    const sheetId = extractSheetId(rawId);
    if (!sheetId) return;

    setSyncState({
      running: true,
      lastAt: null,
      results: SHEET_TABS.map((t) => ({
        key: t.key, tabName: t.tabName, label: t.label, optional: t.optional, status: 'idle' as const,
      })),
    });

    const results: TabSyncResult[] = await Promise.all(
      SHEET_TABS.map(async (tab): Promise<TabSyncResult> => {
        const base = { key: tab.key, tabName: tab.tabName, label: tab.label, optional: tab.optional };
        try {
          const result = await fetchTabAsCSV(sheetId, tab.tabName);
          if (result.error === 'private') return { ...base, status: 'private', error: result.message ?? undefined };
          if (result.error === 'missing')  return { ...base, status: 'missing', error: result.message ?? undefined };
          if (result.error || !result.csv) return { ...base, status: 'error',   error: result.message ?? 'Unknown error' };
          const rawRows = await parseCSV(result.csv);
          if (!rawRows.length) return { ...base, status: 'missing' };
          const parsed = SHEET_PARSERS[tab.key](rawRows);
          saveTableData(tab.key, parsed, `sheet:${sheetId}/${tab.tabName}`);
          return { ...base, status: 'synced', rows: parsed.length };
        } catch (err) {
          return { ...base, status: 'error', error: String(err) };
        }
      })
    );

    // Detect if the sheet itself is inaccessible (all tabs returned private/error)
    const privateCount = results.filter((r) => r.status === 'private').length;
    const sheetError = privateCount > 0
      ? 'Sheet is not publicly accessible. Share it as "Anyone with the link can view".'
      : undefined;

    setData(loadData());
    setSyncState({ running: false, lastAt: new Date().toISOString(), results, sheetError });
  }, [settings.sheet_id]);

  useEffect(() => { syncSheetRef.current = syncSheet; }, [syncSheet]);

  // Auto-refresh
  useEffect(() => {
    if (!settings.sheet_id || settings.sheet_auto_refresh === 'off') return;
    const ms = settings.sheet_auto_refresh === '15min' ? 15 * 60 * 1000 : 60 * 60 * 1000;
    const id = setInterval(() => syncSheetRef.current?.(), ms);
    return () => clearInterval(id);
  }, [settings.sheet_id, settings.sheet_auto_refresh]);

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
