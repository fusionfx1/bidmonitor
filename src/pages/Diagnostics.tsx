import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckCircle, XCircle, AlertTriangle, RefreshCw, Loader2,
  Activity, Clock, Wifi, WifiOff, Info, Terminal,
} from 'lucide-react';
import { PageContainer, PageHeader, Card, CardHeader, CardBody } from '../components/Layout';
import { useApp } from '../context/AppContext';
import { SHEET_TABS } from '../lib/googleSheets';
import { fetchVoluumHealth } from '../lib/voluum/api';
import { computeSyncHealth, relativeTime } from '../lib/syncHealth';
import type { FreshnessStatus, SyncHealth } from '../lib/syncHealth';
import type { VoluumHealth } from '../lib/voluum/types';
import type { TabSyncResult, SyncLogStatus } from '../types';

// ─── Status pill ──────────────────────────────────────────────────────────────

function Pill({
  color, icon: Icon, label,
}: { color: 'green' | 'amber' | 'red' | 'gray'; icon: React.ElementType; label: string }) {
  const cls = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50  text-amber-700  border-amber-200',
    red:   'bg-red-50    text-red-700    border-red-200',
    gray:  'bg-gray-100  text-gray-500   border-gray-200',
  }[color];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cls}`}>
      <Icon size={11} />{label}
    </span>
  );
}

// ─── Tab row ──────────────────────────────────────────────────────────────────

function TabRow({ tab, result }: { tab: typeof SHEET_TABS[0]; result?: TabSyncResult }) {
  const status = result?.status ?? 'idle';
  const pills = {
    synced:  <Pill color="green" icon={CheckCircle} label={`Synced · ${result?.rows?.toLocaleString()} rows`} />,
    missing: <Pill color="amber" icon={AlertTriangle} label={`Missing tab: ${tab.tabName}`} />,
    private: <Pill color="red"   icon={XCircle}       label="Sheet not accessible" />,
    error:   <Pill color="red"   icon={XCircle}       label="Error" />,
    idle:    <Pill color="gray"  icon={Clock}          label="Not synced" />,
  };
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <div>
        <div className="text-sm font-medium text-gray-800">{tab.label}
          {tab.optional && <span className="ml-1.5 text-xs text-gray-400">(optional)</span>}
        </div>
        <div className="text-xs font-mono text-gray-400 mt-0.5">{tab.tabName}</div>
        {(status === 'error' || status === 'missing' || status === 'private') && result?.error && (
          <div className="text-xs text-red-600 mt-0.5">{result.error}</div>
        )}
      </div>
      {pills[status]}
    </div>
  );
}

// ─── Script runs card ─────────────────────────────────────────────────────────

const FRESHNESS_PILL: Record<FreshnessStatus, { color: 'green' | 'amber' | 'red' | 'gray'; label: string }> = {
  OK:      { color: 'green', label: 'Fresh (≤ 90m)' },
  STALE:   { color: 'amber', label: 'Stale (> 90m)' },
  ERROR:   { color: 'red',   label: 'Last run failed' },
  UNKNOWN: { color: 'gray',  label: 'No data' },
};

const STATUS_COLOR: Record<SyncLogStatus, 'green' | 'amber' | 'red'> = {
  SUCCESS: 'green',
  PARTIAL: 'amber',
  FAILED:  'red',
};

function ScriptRunsCard({ health }: { health: SyncHealth }) {
  const fp = FRESHNESS_PILL[health.freshnessStatus];

  if (health.totalRuns === 0) {
    return (
      <Card>
        <CardHeader
          title="Google Ads Script Runs"
          actions={<Pill color="gray" icon={Terminal} label="No log" />}
        />
        <CardBody>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
            Script run log not found. Add a <code className="bg-amber-100 px-1 rounded">google_sync_log</code> tab
            to your Google Sheet to track hourly Google Ads Script runs.
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Google Ads Script Runs"
        actions={<Pill color={fp.color} icon={Activity} label={fp.label} />}
      />
      <CardBody className="space-y-3">
        <div className="space-y-2 text-sm">
          <SRow label="Freshness">
            <Pill color={fp.color} icon={Activity} label={fp.label} />
          </SRow>
          <SRow label="Runs today">
            <span className="font-medium text-gray-800">
              {health.runsToday}
              <span className="text-gray-400 font-normal"> / {health.expectedRunsToday} expected</span>
            </span>
          </SRow>
          <SRow label="Total runs">
            <span className="text-gray-700">{health.totalRuns.toLocaleString()}</span>
          </SRow>
          <SRow label="Last run">
            <span
              className="text-gray-700 font-mono text-xs"
              title={health.lastScriptRunAt ? new Date(health.lastScriptRunAt).toLocaleString() : ''}
            >
              {health.lastScriptRunAt ? relativeTime(health.lastScriptRunAt) : '—'}
              {health.lastScriptRunAt && (
                <span className="text-gray-400 ml-1">
                  ({new Date(health.lastScriptRunAt).toLocaleTimeString()})
                </span>
              )}
            </span>
          </SRow>
          <SRow label="Last status">
            {health.lastStatus
              ? <Pill color={STATUS_COLOR[health.lastStatus]} icon={health.lastStatus === 'SUCCESS' ? CheckCircle : health.lastStatus === 'PARTIAL' ? AlertTriangle : XCircle} label={health.lastStatus} />
              : <span className="text-gray-400">—</span>
            }
          </SRow>
          <SRow label="Last duration">
            <span className="text-gray-700 text-xs font-mono">
              {health.lastDurationSeconds !== null ? `${health.lastDurationSeconds}s` : '—'}
            </span>
          </SRow>
          {health.lastSuccessfulScriptRunAt && health.lastSuccessfulScriptRunAt !== health.lastScriptRunAt && (
            <SRow label="Last success">
              <span className="text-gray-500 text-xs font-mono"
                title={new Date(health.lastSuccessfulScriptRunAt).toLocaleString()}>
                {relativeTime(health.lastSuccessfulScriptRunAt)}
              </span>
            </SRow>
          )}
        </div>

        {health.lastErrorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            <span className="font-medium">Last error: </span>{health.lastErrorMessage}
          </div>
        )}

        {health.freshnessStatus === 'STALE' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            Data may be outdated. The Google Ads Script has not run in over 90 minutes.
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Diagnostics() {
  const { data, settings, syncState, syncSheet } = useApp();

  const [health,       setHealth]       = useState<VoluumHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError,  setHealthError]  = useState<string | null>(null);

  const scriptHealth = useMemo(() => computeSyncHealth(data.syncLog), [data.syncLog]);

  const checkVoluum = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const h = await fetchVoluumHealth();
      setHealth(h);
    } catch (e) {
      setHealthError(String(e));
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => { checkVoluum(); }, [checkVoluum]);

  const resultMap = Object.fromEntries(syncState.results.map((r) => [r.key, r]));

  const sheetConfigured = Boolean(settings.sheet_id?.trim());
  const syncedTabs  = syncState.results.filter((r) => r.status === 'synced').length;
  const missingTabs = syncState.results.filter((r) => r.status === 'missing').length;
  const privateTabs = syncState.results.filter((r) => r.status === 'private').length;
  const hasSheetData = syncedTabs > 0;

  const voluumLive  = health?.connected === true;
  const voluumMissing = health?.credentialsMissing === true;
  const demoMode = !voluumLive && !hasSheetData;

  return (
    <PageContainer>
      <PageHeader
        title="Connection Diagnostics"
        description="Health check for Voluum API, Google Sheet sync, and data sources"
        actions={
          <div className="flex gap-2">
            <button onClick={checkVoluum} disabled={healthLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
              {healthLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Check Voluum
            </button>
            {sheetConfigured && (
              <button onClick={() => syncSheet()} disabled={syncState.running}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {syncState.running ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Sync Sheet
              </button>
            )}
          </div>
        }
      />

      {/* Mode banner */}
      <div className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-5 border ${
        demoMode       ? 'bg-amber-50 border-amber-200 text-amber-800' :
        voluumLive && hasSheetData ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
        'bg-blue-50 border-blue-200 text-blue-800'
      }`}>
        {demoMode
          ? <><AlertTriangle size={16} className="flex-shrink-0" /> <span className="text-sm font-medium">Demo mode</span> — no live data. Configure Voluum and sync a Google Sheet to activate.</>
          : voluumLive && hasSheetData
          ? <><CheckCircle size={16} className="flex-shrink-0" /> <span className="text-sm font-medium">Live mode</span> — Voluum connected and sheet data loaded.</>
          : <><Info size={16} className="flex-shrink-0" /> <span className="text-sm font-medium">Partial mode</span> — {voluumLive ? 'Voluum connected' : 'Voluum not connected'}, {hasSheetData ? `${syncedTabs} sheet tabs loaded` : 'no sheet data'}.</>
        }
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* ── Voluum API ── */}
        <Card>
          <CardHeader
            title="Voluum API"
            actions={
              health
                ? health.connected
                  ? <Pill color="green" icon={Wifi}    label="Connected" />
                  : health.credentialsMissing
                  ? <Pill color="amber" icon={WifiOff} label="Credentials missing" />
                  : <Pill color="red"   icon={WifiOff} label="Error" />
                : healthLoading
                ? <Pill color="gray" icon={Loader2} label="Checking…" />
                : <Pill color="gray" icon={Clock} label="Not checked" />
            }
          />
          <CardBody className="space-y-3">
            {healthError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {healthError}
              </div>
            )}

            <div className="space-y-2 text-sm">
              <SRow label="Status">
                {health?.connected
                  ? <span className="text-emerald-600 font-medium">Connected</span>
                  : health?.credentialsMissing
                  ? <span className="text-amber-600">Credentials not configured</span>
                  : health?.error
                  ? <span className="text-red-600">{health.error}</span>
                  : <span className="text-gray-400">—</span>}
              </SRow>
              <SRow label="Token expires">
                <span className="text-gray-700 font-mono text-xs">
                  {health?.tokenExpiresAt
                    ? new Date(health.tokenExpiresAt).toLocaleString()
                    : '—'}
                </span>
              </SRow>
              <SRow label="Last checked">
                <span className="text-gray-500 text-xs">
                  {health?.lastCheckedAt
                    ? new Date(health.lastCheckedAt).toLocaleTimeString()
                    : '—'}
                </span>
              </SRow>
            </div>

            {voluumMissing && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                Set <code className="bg-amber-100 px-1 rounded">VOLUUM_ACCESS_ID</code> and{' '}
                <code className="bg-amber-100 px-1 rounded">VOLUUM_ACCESS_KEY</code> as Supabase Edge Function secrets to enable live data.
              </div>
            )}
            {health && !health.connected && !health.credentialsMissing && health.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                  <Terminal size={11} /> Error log
                </div>
                <pre className="text-xs text-red-700 whitespace-pre-wrap break-all font-mono leading-relaxed">
                  {health.error}
                </pre>
              </div>
            )}
            {health?.connected && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <Activity size={12} /> Live campaign data is available.
              </div>
            )}
          </CardBody>
        </Card>

        {/* ── Google Sheet ── */}
        <Card>
          <CardHeader
            title="Google Sheet"
            actions={
              !sheetConfigured
                ? <Pill color="gray"  icon={Info}  label="Not configured" />
                : syncState.sheetError
                ? <Pill color="red"   icon={XCircle} label="Inaccessible" />
                : syncedTabs > 0
                ? <Pill color="green" icon={CheckCircle} label={`${syncedTabs} tabs synced`} />
                : syncState.results.length > 0
                ? <Pill color="amber" icon={AlertTriangle} label="Not synced yet" />
                : <Pill color="gray"  icon={Clock} label="Not synced" />
            }
          />
          <CardBody className="space-y-3">
            <div className="space-y-2 text-sm">
              <SRow label="Sheet ID">
                <span className="font-mono text-xs text-gray-600 truncate max-w-[200px]">
                  {settings.sheet_id || <span className="text-gray-400">not set</span>}
                </span>
              </SRow>
              <SRow label="Last sync">
                <span className="text-gray-500 text-xs">
                  {syncState.lastAt ? new Date(syncState.lastAt).toLocaleString() : '—'}
                </span>
              </SRow>
              <SRow label="Tabs synced">
                <span className={syncedTabs > 0 ? 'text-emerald-600 font-medium' : 'text-gray-400'}>
                  {syncState.results.length > 0 ? `${syncedTabs} / ${SHEET_TABS.length}` : '—'}
                </span>
              </SRow>
              {missingTabs > 0 && (
                <SRow label="Missing tabs">
                  <span className="text-amber-600">{missingTabs}</span>
                </SRow>
              )}
            </div>

            {syncState.sheetError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-800">
                {syncState.sheetError}
              </div>
            )}
            {!sheetConfigured && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-800">
                Go to <strong>Import Data</strong> and paste your Google Sheet URL to start syncing.
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Google Ads Script Runs ── */}
      <div className="mt-5">
        <ScriptRunsCard health={scriptHealth} />
      </div>

      {/* ── Tab-by-tab status ── */}
      {syncState.results.length > 0 && (
        <Card className="mt-5">
          <CardHeader
            title="Sheet Tabs"
            actions={
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {syncedTabs > 0  && <span className="text-emerald-600">{syncedTabs} synced</span>}
                {missingTabs > 0 && <span className="text-amber-600">{missingTabs} missing</span>}
                {privateTabs > 0 && <span className="text-red-600">{privateTabs} inaccessible</span>}
              </div>
            }
          />
          <CardBody>
            {SHEET_TABS.map((tab) => (
              <TabRow
                key={tab.key}
                tab={tab}
                result={resultMap[tab.key] as TabSyncResult | undefined}
              />
            ))}
          </CardBody>
        </Card>
      )}

      {/* ── Required sheet tab reference ── */}
      <Card className="mt-5">
        <CardHeader title="Required Sheet Tab Names" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {SHEET_TABS.map((tab) => (
              <div key={tab.key} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{tab.label}</span>
                <code className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {tab.tabName}
                  {tab.optional && <span className="text-gray-400 ml-1">(optional)</span>}
                </code>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Tab names are case-sensitive. The sheet must be shared as "Anyone with the link can view."
          </p>
        </CardBody>
      </Card>

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800">
        <strong>Safety note:</strong> BidMonitor is read-only. No bids, budgets, or campaigns are ever modified.
        All recommendations require manual review and export.
      </div>
    </PageContainer>
  );
}

function SRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 flex-shrink-0 w-28">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}
