import { useState, useRef, useCallback, useEffect } from 'react';
import {
  RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock,
  ChevronDown, ChevronUp, Upload, Link, Loader2, Trash2, Wifi,
} from 'lucide-react';
import { PageContainer, PageHeader, Card, CardHeader, CardBody } from '../components/Layout';
import { useApp } from '../context/AppContext';
import type { DataTableKey, TabSyncResult, SheetAutoRefresh } from '../types';
import { SHEET_TABS, extractSheetId, type SheetTab } from '../lib/googleSheets';
import {
  parseCSV, parseCampaigns, parseAdGroups, parseKeywords, parseSearchTerms,
  parseHourDevice, parsePolicy, parseAuctionCampaigns, parseAuctionKeywords, parseVoluum, parseSyncLog,
  parsePmaxPerformance, parseGeoPerformance, parsePlacementPerformance,
} from '../lib/csv/parser';
import { clearAllData } from '../store/dataStore';
import { addActiveAccountScope, getActiveAccountSource, getActiveSpreadsheetId, makeAccountSource } from '../lib/accountSources';
import { getVoluumLiveImportStatus, isLiveApiKey, sourceTabName } from '../lib/importSources';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 minute ago';
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 1) return '1 hour ago';
  if (hrs < 24) return `${hrs} hours ago`;
  return new Date(iso).toLocaleString();
}

function compactSource(source?: string): string {
  if (!source) return 'not imported';
  if (source.startsWith('voluum-api:')) return source.replace('voluum-api:', 'Voluum API / ');
  if (source.startsWith('sheet:')) return source.replace('sheet:', 'Sheet / ');
  return source;
}

const CSV_PARSERS: Record<DataTableKey, (rows: Record<string, unknown>[]) => unknown[]> = {
  campaigns: parseCampaigns,
  adGroups: parseAdGroups,
  keywords: parseKeywords,
  searchTerms: parseSearchTerms,
  hourDevice: parseHourDevice,
  policy: parsePolicy,
  auctionCampaigns: parseAuctionCampaigns,
  auctionKeywords: parseAuctionKeywords,
  pmaxPerformance: parsePmaxPerformance,
  geoPerformance: parseGeoPerformance,
  placementPerformance: parsePlacementPerformance,
  voluum: parseVoluum,
  syncLog: parseSyncLog,
};

function StatusBadge({ result }: { result?: TabSyncResult }) {
  if (!result || result.status === 'idle') {
    return <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Not synced</span>;
  }
  if (result.status === 'synced') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
        <CheckCircle size={11} /> Synced
      </span>
    );
  }
  if (result.status === 'missing') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
        <AlertTriangle size={11} /> Missing tab
      </span>
    );
  }
  if (result.status === 'private') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
        <XCircle size={11} /> Private
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
      <XCircle size={11} /> Error
    </span>
  );
}

function DatasetCard({ tab, result }: { tab: SheetTab; result?: TabSyncResult }) {
  const actualTab = result?.tabName ?? tab.tabName;
  const usesAlias = actualTab !== tab.tabName;
  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      result?.status === 'synced'  ? 'border-emerald-200 bg-emerald-50/40' :
      result?.status === 'error'   ? 'border-red-200 bg-red-50/30' :
      result?.status === 'missing' ? 'border-amber-200 bg-amber-50/30' :
      result?.status === 'private' ? 'border-red-300 bg-red-50/40' :
                                     'border-gray-200 bg-white'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-gray-800">{tab.label}</span>
            {tab.optional && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Optional</span>}
          </div>
          <div className="text-xs text-gray-400 font-mono mt-0.5">source: {actualTab}</div>
          {usesAlias && <div className="text-[11px] text-gray-400 font-mono">legacy: {tab.tabName}</div>}
        </div>
        <StatusBadge result={result} />
      </div>
      {result?.status === 'synced'  && <div className="text-xs text-emerald-700 font-medium">{result.rows?.toLocaleString()} rows imported</div>}
      {result?.status === 'error'   && <div className="text-xs text-red-600 truncate" title={result.error}>{result.error}</div>}
      {result?.status === 'missing' && <div className="text-xs text-amber-600">Tab not found. Accepts generated aliases or legacy tab name.</div>}
      {result?.status === 'private' && <div className="text-xs text-red-600">{result.error ?? 'Sheet is not publicly accessible'}</div>}
    </div>
  );
}

function CountLine({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className={value !== null ? 'font-medium text-gray-800' : 'text-gray-400'}>{value !== null ? value.toLocaleString() : '—'}</span>
    </div>
  );
}

function LiveApiImportCard({ status }: { status: ReturnType<typeof getVoluumLiveImportStatus> }) {
  const ok = status.status === 'synced';
  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      ok ? 'border-emerald-200 bg-emerald-50/40' :
      status.status === 'fallback' ? 'border-amber-200 bg-amber-50/30' :
      'border-gray-200 bg-white'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-gray-800">{status.label}</span>
            <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">Live API</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">{status.description}</div>
          <div className="text-xs text-gray-400 font-mono mt-1">source: {status.sourceLabel}</div>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
          ok ? 'text-emerald-700 bg-emerald-50' : status.status === 'fallback' ? 'text-amber-700 bg-amber-50' : 'text-gray-500 bg-gray-100'
        }`}>
          {ok ? <CheckCircle size={11} /> : status.status === 'fallback' ? <AlertTriangle size={11} /> : <Wifi size={11} />}
          {ok ? 'Imported' : status.status === 'fallback' ? 'Fallback only' : 'Waiting'}
        </span>
      </div>
      <div className="text-xs text-emerald-700 font-medium">
        {ok ? `${status.rows.toLocaleString()} rows imported` : 'No live API rows imported into Overview yet'}
      </div>
      <div className="mt-3 space-y-1 rounded-lg bg-white/60 p-2">
        <CountLine label="Report rows before filter" value={status.reportRows} />
        <CountLine label="Active rows used" value={status.activeCampaignRows} />
        <CountLine label="Archived/inactive filtered" value={status.filteredInactiveRows} />
      </div>
      {status.importedAt && (
        <div className="text-xs text-gray-400 mt-1">Last import {relativeTime(status.importedAt)}</div>
      )}
    </div>
  );
}

export function ImportData() {
  const { data, settings, updateSettings, updateTableData, syncState, syncSheet } = useApp();
  const [sheetInput, setSheetInput] = useState(getActiveSpreadsheetId(settings));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [csvStatuses, setCsvStatuses] = useState<Partial<Record<DataTableKey, { status: string; msg: string }>>>({});
  const [urlInputs, setUrlInputs] = useState<Partial<Record<DataTableKey, string>>>({});
  const [showUrl, setShowUrl] = useState<Partial<Record<DataTableKey, boolean>>>({});
  const fileRefs = useRef<Partial<Record<DataTableKey, HTMLInputElement | null>>>({});

  const sheetTabs = SHEET_TABS.filter((tab) => !isLiveApiKey(tab.key));
  const resultMap = Object.fromEntries(syncState.results.map((r) => [r.key, r])) as Record<DataTableKey, TabSyncResult | undefined>;
  const voluumApiStatus = getVoluumLiveImportStatus(data);

  useEffect(() => {
    setSheetInput(getActiveSpreadsheetId(settings));
  }, [settings]);

  const handleSync = () => {
    const id = extractSheetId(sheetInput);
    if (!id) return;
    const activeSource = getActiveAccountSource(settings);
    if (activeSource && id !== activeSource.spreadsheet_id) {
      updateSettings({
        ...settings,
        sheet_id: id,
        account_sources: settings.account_sources.map((source) =>
          source.id === activeSource.id
            ? makeAccountSource({
              ...source,
              spreadsheet_id: id,
              spreadsheet_url: sheetInput.startsWith('http') ? sheetInput : source.spreadsheet_url,
            })
            : source
        ),
      });
    } else if (!activeSource && id !== settings.sheet_id) {
      updateSettings({ ...settings, sheet_id: id });
    }
    syncSheet(id);
  };

  const handleAutoRefreshChange = (val: SheetAutoRefresh) => {
    updateSettings({ ...settings, sheet_auto_refresh: val });
  };

  const handleFileUpload = useCallback(async (key: DataTableKey, file: File) => {
    setCsvStatuses((p) => ({ ...p, [key]: { status: 'loading', msg: 'Parsing...' } }));
    try {
      const rows = await parseCSV(await file.text());
      if (!rows.length) {
        setCsvStatuses((p) => ({ ...p, [key]: { status: 'error', msg: 'File is empty.' } }));
        return;
      }
      const parsed = addActiveAccountScope(CSV_PARSERS[key](rows), settings);
      updateTableData(key, parsed, `file:${file.name}`);
      setCsvStatuses((p) => ({ ...p, [key]: { status: 'success', msg: `${parsed.length.toLocaleString()} rows imported` } }));
    } catch (e) {
      setCsvStatuses((p) => ({ ...p, [key]: { status: 'error', msg: String(e) } }));
    }
  }, [settings, updateTableData]);

  const handleUrlImport = useCallback(async (key: DataTableKey) => {
    const url = urlInputs[key]?.trim();
    if (!url) return;
    setCsvStatuses((p) => ({ ...p, [key]: { status: 'loading', msg: 'Fetching...' } }));
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await parseCSV(await res.text());
      if (!rows.length) {
        setCsvStatuses((p) => ({ ...p, [key]: { status: 'error', msg: 'No data rows found.' } }));
        return;
      }
      const parsed = addActiveAccountScope(CSV_PARSERS[key](rows), settings);
      updateTableData(key, parsed, `url:${url}`);
      setCsvStatuses((p) => ({ ...p, [key]: { status: 'success', msg: `${parsed.length.toLocaleString()} rows imported` } }));
    } catch (e) {
      setCsvStatuses((p) => ({ ...p, [key]: { status: 'error', msg: String(e) } }));
    }
  }, [settings, urlInputs, updateTableData]);

  const handleClearAll = () => {
    if (window.confirm('Clear all imported data? This cannot be undone.')) {
      clearAllData();
      window.location.reload();
    }
  };

  const sheetSyncedCount = sheetTabs.filter((tab) => resultMap[tab.key]?.status === 'synced' || data.meta[tab.key]).length;
  const missingCount = sheetTabs.filter((tab) => resultMap[tab.key]?.status === 'missing').length;
  const privateSheet = Boolean(syncState.sheetError);

  return (
    <PageContainer>
      <PageHeader
        title="Import Data"
        description="Sync Google Ads data from one Sheet and live performance data from backend API imports."
        actions={
          <button
            onClick={handleClearAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={12} /> Clear All Data
          </button>
        }
      />

      <Card className="mb-6">
        <CardHeader title="Google Sheet Sync" />
        <CardBody className="space-y-5">
          {privateSheet && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-800">
              <XCircle size={14} className="flex-shrink-0 mt-0.5" />
              <div><strong>Sheet is not accessible.</strong> {syncState.sheetError}</div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Google Sheet URL or Sheet ID</label>
            {settings.account_sources.length > 0 && (
              <p className="text-xs text-gray-500 mb-1.5">
                Sync target: {getActiveAccountSource(settings)?.account_name ?? 'No enabled account selected'}
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={sheetInput}
                onChange={(e) => setSheetInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSync()}
                placeholder="https://docs.google.com/spreadsheets/d/…  or paste the Sheet ID"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 font-mono placeholder:font-sans placeholder:text-gray-400"
              />
              <button
                onClick={handleSync}
                disabled={!sheetInput.trim() || syncState.running}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {syncState.running
                  ? <><Loader2 size={15} className="animate-spin" /> Syncing…</>
                  : <><RefreshCw size={15} /> Sync Now</>}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              The sheet must be shared as "Anyone with the link can view." Generated raw tabs are preferred; legacy tab names remain supported.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="text-xs font-medium text-gray-700 mb-1.5">Auto-refresh</div>
              <div className="flex gap-1">
                {(['off', '15min', '1hour'] as SheetAutoRefresh[]).map((val) => (
                  <button
                    key={val}
                    onClick={() => handleAutoRefreshChange(val)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      settings.sheet_auto_refresh === val
                        ? 'bg-blue-600 text-white border-blue-600 font-medium'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {val === 'off' ? 'Off' : val === '15min' ? 'Every 15 min' : 'Every 1 hour'}
                  </button>
                ))}
              </div>
            </div>

            {syncState.lastAt && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Clock size={13} />
                Last synced {relativeTime(syncState.lastAt)}
                {sheetSyncedCount > 0 && <span className="ml-1 text-emerald-600 font-medium">· {sheetSyncedCount} sheet tabs</span>}
                {voluumApiStatus.status === 'synced' && <span className="ml-1 text-emerald-600 font-medium">· Voluum API {voluumApiStatus.rows.toLocaleString()} rows</span>}
                {missingCount > 0 && <span className="ml-1 text-amber-600">· {missingCount} missing</span>}
              </div>
            )}
          </div>

          <details className="group">
            <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-700 select-none list-none flex items-center gap-1">
              <ChevronDown size={13} className="group-open:rotate-180 transition-transform" />
              Accepted Google Sheet tab names
            </summary>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {sheetTabs.map((t) => (
                <div key={t.key} className="flex items-center justify-between gap-2 text-xs border-b border-gray-50 py-1">
                  <span className="text-gray-600">{t.label}</span>
                  <span className="font-mono text-gray-500 text-right">
                    {t.aliases?.[0] ?? t.tabName}
                    <span className="text-gray-300"> / {t.tabName}</span>
                  </span>
                </div>
              ))}
            </div>
          </details>
        </CardBody>
      </Card>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Google Sheet Tabs</h2>
        {syncState.running && <span className="flex items-center gap-1.5 text-xs text-blue-600"><Loader2 size={13} className="animate-spin" /> Fetching tabs…</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-8">
        {sheetTabs.map((tab) => {
          const syncResult = resultMap[tab.key];
          const meta = data.meta[tab.key];
          const metaTabName = sourceTabName(meta?.source) ?? tab.tabName;
          const effective: TabSyncResult | undefined = syncResult ?? (meta
            ? { key: tab.key, tabName: metaTabName, label: tab.label, optional: tab.optional, status: 'synced', rows: meta.rows }
            : undefined);
          return <DatasetCard key={tab.key} tab={tab} result={effective} />;
        })}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Live API Imports</h2>
        {voluumApiStatus.status === 'synced' && <span className="text-xs text-emerald-600">Used by Overview</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-8">
        <LiveApiImportCard status={voluumApiStatus} />
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        >
          <div>
            <div className="text-sm font-semibold text-gray-800">Advanced: Manual CSV Upload</div>
            <div className="text-xs text-gray-500 mt-0.5">Upload individual CSV files per dataset — use only as fallback</div>
          </div>
          {showAdvanced ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {showAdvanced && (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {SHEET_TABS.map(({ key, label, tabName, optional }) => {
              const meta = data.meta[key];
              const s = csvStatuses[key];
              return (
                <div key={key} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">{label}</span>
                    {optional && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Optional</span>}
                  </div>
                  <p className="text-xs text-gray-400 font-mono">{tabName}</p>
                  <div
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(key, f); }}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileRefs.current[key]?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                  >
                    <Upload size={16} className="text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-400">Drop CSV or click to browse</p>
                    <input
                      ref={(el) => { fileRefs.current[key] = el; }}
                      type="file" accept=".csv,text/csv" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(key, f); }}
                    />
                  </div>
                  <button
                    onClick={() => setShowUrl((p) => ({ ...p, [key]: !p[key] }))}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                  >
                    <Link size={11} /> {showUrl[key] ? 'Hide URL' : 'Import from URL'}
                  </button>
                  {showUrl[key] && (
                    <div className="flex gap-2">
                      <input
                        type="url" placeholder="CSV URL…"
                        value={urlInputs[key] || ''}
                        onChange={(e) => setUrlInputs((p) => ({ ...p, [key]: e.target.value }))}
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => handleUrlImport(key)}
                        disabled={!urlInputs[key]?.trim()}
                        className="px-2 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
                      >
                        Go
                      </button>
                    </div>
                  )}
                  {s && (
                    <div className={`text-xs rounded-lg p-2 ${
                      s.status === 'success' ? 'bg-emerald-50 text-emerald-700' :
                      s.status === 'error'   ? 'bg-red-50 text-red-700' :
                                               'bg-blue-50 text-blue-700'
                    }`}>
                      {s.msg}
                    </div>
                  )}
                  {meta && !s && (
                    <div className="text-xs text-gray-400">
                      {meta.rows.toLocaleString()} rows · {new Date(meta.importedAt).toLocaleDateString()} · {compactSource(meta.source)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
