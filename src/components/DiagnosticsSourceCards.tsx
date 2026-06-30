import type { ElementType, ReactNode } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, Database, Info, Wifi, WifiOff, XCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from './Layout';
import { SHEET_TABS, type SheetTab } from '../lib/googleSheets';
import { relativeTime, type SyncHealth } from '../lib/syncHealth';
import { isLiveApiKey, sourceTabName, type LiveApiImportStatus } from '../lib/importSources';
import type { ImportedData, Settings, SyncState, TabSyncResult, TableMeta } from '../types';
import type { VoluumHealth } from '../lib/voluum/types';

type Tone = 'green' | 'amber' | 'red' | 'gray' | 'blue';

function Pill({ tone, icon: Icon, label }: { tone: Tone; icon: ElementType; label: string }) {
  const cls = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    gray: 'border-gray-200 bg-gray-100 text-gray-500',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  }[tone];
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}><Icon size={11} />{label}</span>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-center justify-between border-b border-gray-50 py-1 last:border-0"><span className="w-36 flex-shrink-0 text-xs text-gray-500">{label}</span><div className="text-right">{children}</div></div>;
}

function CountValue({ value }: { value: number | null }) {
  return <span className={value !== null ? 'font-medium text-gray-800' : 'text-gray-400'}>{value !== null ? value.toLocaleString() : '—'}</span>;
}

function sheetTabs() {
  return SHEET_TABS.filter((tab) => !isLiveApiKey(tab.key));
}

function fallbackResult(tab: SheetTab, meta?: TableMeta): TabSyncResult | undefined {
  if (!meta) return undefined;
  return { key: tab.key, label: tab.label, tabName: sourceTabName(meta.source) ?? tab.tabName, optional: tab.optional, status: 'synced', rows: meta.rows };
}

function TabRow({ tab, result }: { tab: SheetTab; result?: TabSyncResult }) {
  const status = result?.status ?? 'idle';
  const sourceName = result?.tabName ?? tab.tabName;
  const pill = status === 'synced'
    ? <Pill tone="green" icon={CheckCircle} label={`Synced · ${result?.rows?.toLocaleString()} rows`} />
    : status === 'missing'
    ? <Pill tone="amber" icon={AlertTriangle} label="Missing" />
    : status === 'private'
    ? <Pill tone="red" icon={XCircle} label="Private" />
    : status === 'error'
    ? <Pill tone="red" icon={XCircle} label="Error" />
    : <Pill tone="gray" icon={Clock} label="Not synced" />;
  return (
    <div className="flex items-center justify-between border-b border-gray-50 py-2.5 last:border-0">
      <div>
        <div className="text-sm font-medium text-gray-800">{tab.label}{tab.optional && <span className="ml-1.5 text-xs text-gray-400">(optional)</span>}</div>
        <div className="mt-0.5 font-mono text-xs text-gray-400">source: {sourceName}</div>
        {sourceName !== tab.tabName && <div className="font-mono text-[11px] text-gray-300">legacy: {tab.tabName}</div>}
        {result?.error && <div className="mt-0.5 text-xs text-red-600">{result.error}</div>}
      </div>
      {pill}
    </div>
  );
}

export function DiagnosticsSourceCards({
  data, settings, syncState, scriptHealth, voluumHealth, voluumError, voluumImport,
}: {
  data: ImportedData;
  settings: Settings;
  syncState: SyncState;
  scriptHealth: SyncHealth;
  voluumHealth: VoluumHealth | null;
  voluumError: string | null;
  voluumImport: LiveApiImportStatus;
}) {
  const tabs = sheetTabs();
  const resultMap = Object.fromEntries(syncState.results.map((row) => [row.key, row])) as Record<string, TabSyncResult | undefined>;
  const syncedSheetTabs = tabs.filter((tab) => resultMap[tab.key]?.status === 'synced' || data.meta[tab.key]).length;
  const hasVoluumRows = voluumImport.status === 'synced';
  const scriptTone: Tone = scriptHealth.freshnessStatus === 'OK' ? 'green' : scriptHealth.freshnessStatus === 'STALE' ? 'amber' : scriptHealth.freshnessStatus === 'ERROR' ? 'red' : 'gray';
  const voluumAction = voluumHealth?.connected
    ? <Pill tone="green" icon={Wifi} label="Connected" />
    : voluumError
    ? <Pill tone="red" icon={WifiOff} label="Error" />
    : hasVoluumRows
    ? <Pill tone="green" icon={Database} label="Imported" />
    : <Pill tone="gray" icon={Clock} label="Not checked" />;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Voluum API" actions={voluumAction} />
        <CardBody className="space-y-2 text-sm">
          {voluumError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{voluumError}</div>}
          <Row label="Connection"><span className={voluumHealth?.connected ? 'font-medium text-emerald-600' : hasVoluumRows ? 'text-gray-500' : 'text-gray-400'}>{voluumHealth?.connected ? 'connected' : hasVoluumRows ? 'not checked, import loaded' : '—'}</span></Row>
          <Row label="Dashboard import"><span className={hasVoluumRows ? 'font-medium text-emerald-600' : 'text-gray-400'}>{hasVoluumRows ? `${voluumImport.rows.toLocaleString()} rows` : 'not imported'}</span></Row>
          <Row label="Report rows"><CountValue value={voluumImport.reportRows} /></Row>
          <Row label="Active rows"><CountValue value={voluumImport.activeCampaignRows} /></Row>
          <Row label="Filtered inactive"><CountValue value={voluumImport.filteredInactiveRows} /></Row>
          <Row label="Source"><span className="font-mono text-xs text-gray-600">{voluumImport.sourceLabel}</span></Row>
          <Row label="Last import"><span className="text-xs text-gray-500">{voluumImport.importedAt ? relativeTime(voluumImport.importedAt) : '—'}</span></Row>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Google Sheet" actions={!settings.sheet_id ? <Pill tone="gray" icon={Info} label="Not configured" /> : syncedSheetTabs > 0 ? <Pill tone="green" icon={CheckCircle} label={`${syncedSheetTabs} sheet tabs`} /> : <Pill tone="gray" icon={Clock} label="Not synced" />} />
        <CardBody className="space-y-2 text-sm">
          <Row label="Sheet ID"><span className="max-w-[220px] truncate font-mono text-xs text-gray-600">{settings.sheet_id || 'not set'}</span></Row>
          <Row label="Last sync"><span className="text-xs text-gray-500">{syncState.lastAt ? new Date(syncState.lastAt).toLocaleString() : '—'}</span></Row>
          <Row label="Sheet tabs"><span className={syncedSheetTabs > 0 ? 'font-medium text-emerald-600' : 'text-gray-400'}>{syncedSheetTabs > 0 ? `${syncedSheetTabs} / ${tabs.length}` : '—'}</span></Row>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Google Ads Script Runs" actions={<Pill tone={scriptTone} icon={Activity} label={scriptHealth.freshnessStatus === 'OK' ? 'Fresh' : scriptHealth.freshnessStatus} />} />
        <CardBody className="space-y-2 text-sm">
          <Row label="Runs today"><span className="font-medium text-gray-800">{scriptHealth.runsToday}<span className="font-normal text-gray-400"> / {scriptHealth.expectedRunsToday} expected</span></span></Row>
          <Row label="Total runs"><span className="text-gray-700">{scriptHealth.totalRuns.toLocaleString()}</span></Row>
          <Row label="Last run"><span className="font-mono text-xs text-gray-700">{scriptHealth.lastScriptRunAt ? relativeTime(scriptHealth.lastScriptRunAt) : '—'}</span></Row>
          <Row label="Last status"><span className="text-gray-700">{scriptHealth.lastStatus ?? '—'}</span></Row>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Live API Imports" actions={hasVoluumRows ? <Pill tone="green" icon={Database} label={`${voluumImport.rows.toLocaleString()} rows`} /> : <Pill tone="gray" icon={Database} label="No rows" />} />
        <CardBody className="space-y-2 text-sm">
          <Row label="Voluum report"><span className={hasVoluumRows ? 'font-medium text-emerald-600' : 'text-gray-400'}>{hasVoluumRows ? `${voluumImport.rows.toLocaleString()} rows` : 'not imported'}</span></Row>
          <Row label="Used by Overview"><span className={hasVoluumRows ? 'font-medium text-emerald-600' : 'text-gray-400'}>{hasVoluumRows ? 'yes' : 'no'}</span></Row>
          <Row label="Active filter"><span className={hasVoluumRows ? 'font-medium text-emerald-600' : 'text-gray-400'}>{hasVoluumRows ? 'active campaigns only' : '—'}</span></Row>
        </CardBody>
      </Card>
    </div>
  );
}

export function DiagnosticsSheetTabs({ data, syncState }: { data: ImportedData; syncState: SyncState }) {
  const tabs = sheetTabs();
  const resultMap = Object.fromEntries(syncState.results.map((row) => [row.key, row])) as Record<string, TabSyncResult | undefined>;
  const synced = tabs.filter((tab) => resultMap[tab.key]?.status === 'synced' || data.meta[tab.key]).length;
  const missing = tabs.filter((tab) => resultMap[tab.key]?.status === 'missing').length;
  const inaccessible = tabs.filter((tab) => resultMap[tab.key]?.status === 'private').length;

  return (
    <>
      <Card className="mt-5">
        <CardHeader title="Google Sheet Tabs" actions={<div className="flex items-center gap-3 text-xs text-gray-500">{synced > 0 && <span className="text-emerald-600">{synced} synced</span>}{missing > 0 && <span className="text-amber-600">{missing} missing</span>}{inaccessible > 0 && <span className="text-red-600">{inaccessible} inaccessible</span>}</div>} />
        <CardBody>{tabs.map((tab) => <TabRow key={tab.key} tab={tab} result={resultMap[tab.key] ?? fallbackResult(tab, data.meta[tab.key])} />)}</CardBody>
      </Card>

      <Card className="mt-5">
        <CardHeader title="Accepted Google Sheet Tab Names" />
        <CardBody><div className="grid grid-cols-1 gap-2 md:grid-cols-2">{tabs.map((tab) => <div key={tab.key} className="flex items-center justify-between gap-3 border-b border-gray-50 py-1.5"><span className="text-sm text-gray-700">{tab.label}</span><code className="rounded bg-gray-100 px-2 py-0.5 text-right font-mono text-xs text-gray-600">{tab.aliases?.[0] ?? tab.tabName}<span className="ml-1 text-gray-400">/ {tab.tabName}</span></code></div>)}</div></CardBody>
      </Card>
    </>
  );
}
