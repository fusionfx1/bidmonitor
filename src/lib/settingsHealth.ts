import type { ActionMode, DataTableKey, GoogleSyncLogRow, ImportedData, Settings, TableMeta } from '../types';
import { getCurrentImportTabs } from './dataContract/contract';
import { computeSyncHealth } from './syncHealth';

export const SETTINGS_SCRIPT_VERSION = 'tm2-settings-health-v1';
export const COPY_SCRIPT_UPDATE_VERSION = 'tm2-copy-settings-health-v1';

export type SafeActionMode = Extract<ActionMode, 'review_only' | 'disabled'>;
export type HealthTone = 'ok' | 'warn' | 'safe' | 'missing';

export interface DataSourceStatus {
  key: DataTableKey;
  label: string;
  tabName: string;
  rows: number;
  importedAt: string | null;
  source: string | null;
  optional: boolean;
  tone: HealthTone;
}

export interface AccountCard {
  id: string;
  title: string;
  status: string;
  tone: HealthTone;
  details: string;
  values: Array<{ label: string; value: string }>;
}

export interface SettingsHealth {
  safeMode: SafeActionMode;
  automationDisabled: boolean;
  latestScriptVersion: string | null;
  syncTone: HealthTone;
  syncLabel: string;
  dataSources: DataSourceStatus[];
  accountCards: AccountCard[];
}

export const DANGER_ACTIONS = [
  {
    id: 'disable_automation',
    label: 'Disable automation',
    backendCall: 'none',
    localSettingsWrite: true,
  },
  {
    id: 'rotate_feed_token',
    label: 'Rotate feed token',
    backendCall: 'placeholder',
    localSettingsWrite: false,
  },
  {
    id: 'disconnect_account',
    label: 'Disconnect account',
    backendCall: 'placeholder',
    localSettingsWrite: false,
  },
] as const;

export function normalizeSafeActionMode(mode: string | null | undefined): SafeActionMode {
  return mode === 'disabled' ? 'disabled' : 'review_only';
}

export function maskSensitiveValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return 'not configured';

  try {
    const url = new URL(trimmed);
    const host = maskSegment(url.hostname, 3, 4);
    return `${url.protocol}//${host}${url.pathname && url.pathname !== '/' ? '/...' : ''}`;
  } catch {
    return maskSegment(trimmed, 4, 4);
  }
}

export function buildScriptUpdateCopy(settings: Settings, latestScriptVersion: string | null): string {
  return [
    `Bid Monitor script update: ${COPY_SCRIPT_UPDATE_VERSION}`,
    `Expected settings health UI: ${SETTINGS_SCRIPT_VERSION}`,
    `Current detected script: ${latestScriptVersion ?? 'not reported'}`,
    `Account mode: ${normalizeSafeActionMode(settings.action_mode)}`,
    `Currency: ${settings.currency || 'THB'}`,
    `Breakeven CPA: ${settings.payout}`,
    'Keep Google Ads mutate calls disabled.',
    'Keep backend-only credentials out of the frontend bundle.',
  ].join('\n');
}

export function buildSettingsHealth(settings: Settings, data: ImportedData): SettingsHealth {
  const safeMode = normalizeSafeActionMode(settings.action_mode);
  const health = computeSyncHealth(data.syncLog);
  const latestScriptVersion = latestScriptVersionFrom(data.syncLog);
  const dataSources = getCurrentImportTabs().map((tab) => {
    const meta = data.meta[tab.key];
    return buildDataSourceStatus(tab.key, tab.label, tab.tabName, Boolean(tab.optional), meta);
  });

  const syncTone = syncHealthTone(health.freshnessStatus);
  const sourceCount = dataSources.filter((source) => source.rows > 0).length;
  const maskedSheet = maskSensitiveValue(settings.sheet_id);
  const accountSourceCards =
    settings.account_sources.length > 0
      ? settings.account_sources.map((source) => ({
          id: `account_source_${source.id}`,
          title: source.account_name || source.account_id || 'Unnamed account source',
          status: source.enabled ? 'Connected locally' : 'Disabled locally',
          tone: source.enabled ? ('ok' as const) : ('safe' as const),
          details: 'Account identity and Sheet source are local configuration only.',
          values: [
            { label: 'Customer ID', value: source.customer_id || 'missing' },
            { label: 'Account ID', value: source.account_id || 'missing' },
            { label: 'Sheet', value: maskSensitiveValue(source.spreadsheet_id || source.spreadsheet_url) },
            { label: 'Schedule', value: settings.sheet_auto_refresh },
          ],
        }))
      : [
          {
            id: 'account_source_missing',
            title: 'No account source',
            status: 'Not configured',
            tone: 'missing' as const,
            details: 'Add a local account source before syncing account-scoped feed rows.',
            values: [
              { label: 'Customer ID', value: 'missing' },
              { label: 'Account ID', value: 'missing' },
              { label: 'Sheet', value: 'not configured' },
              { label: 'Schedule', value: settings.sheet_auto_refresh },
            ],
          },
        ];

  return {
    safeMode,
    automationDisabled: safeMode === 'disabled',
    latestScriptVersion,
    syncTone,
    syncLabel:
      health.totalRuns === 0
        ? 'No script run log imported'
        : `${health.lastStatus ?? 'UNKNOWN'} run, ${health.runsToday}/${health.expectedRunsToday} expected today`,
    dataSources,
    accountCards: [
      ...accountSourceCards,
      {
        id: 'google_ads',
        title: 'Google Ads account',
        status: safeMode === 'disabled' ? 'Disabled locally' : 'Review only',
        tone: safeMode === 'disabled' ? 'safe' : 'ok',
        details: 'Recommendations remain read-only; mutate paths stay disabled.',
        values: [
          { label: 'Mode', value: labelForMode(safeMode) },
          { label: 'Breakeven CPA', value: formatCurrency(settings.payout, settings.currency) },
          { label: 'Target CPA', value: formatCurrency(settings.target_cpa, settings.currency) },
          { label: 'Currency', value: settings.currency || 'THB' },
        ],
      },
      {
        id: 'sheet_feed',
        title: 'Google Sheet feed',
        status: settings.sheet_id ? 'Configured' : 'Not configured',
        tone: settings.sheet_id ? 'ok' : 'missing',
        details: 'Feed identity is masked and imported through read-only CSV tabs.',
        values: [
          { label: 'Sheet ID / URL', value: maskedSheet },
          { label: 'Auto refresh', value: settings.sheet_auto_refresh },
          { label: 'Imported sources', value: `${sourceCount}/${dataSources.length}` },
        ],
      },
      {
        id: 'script_health',
        title: 'Script health',
        status: health.freshnessStatus,
        tone: syncTone,
        details: health.lastErrorMessage ?? 'Latest script run status is derived from google_sync_log.',
        values: [
          { label: 'Latest script', value: latestScriptVersion ?? 'not reported' },
          { label: 'Last run', value: health.lastScriptRunAt ?? 'none' },
          { label: 'Runs today', value: String(health.runsToday) },
        ],
      },
      {
        id: 'voluum',
        title: 'Voluum tracker',
        status: data.voluum.length > 0 ? 'Imported' : 'Optional',
        tone: data.voluum.length > 0 ? 'ok' : 'safe',
        details: 'Credentials stay server-side in Edge Function secrets.',
        values: [
          { label: 'Rows', value: String(data.voluum.length) },
          { label: 'Access ID', value: 'server secret only' },
          { label: 'Access key', value: 'server secret only' },
        ],
      },
    ],
  };
}

function buildDataSourceStatus(
  key: DataTableKey,
  label: string,
  tabName: string,
  optional: boolean,
  meta: TableMeta | undefined
): DataSourceStatus {
  const rows = meta?.rows ?? 0;
  const importedAt = meta?.importedAt ?? null;
  const source = meta?.source ?? null;

  return {
    key,
    label,
    tabName,
    rows,
    importedAt,
    source,
    optional,
    tone: rows > 0 ? 'ok' : optional ? 'safe' : 'missing',
  };
}

function latestScriptVersionFrom(rows: GoogleSyncLogRow[]): string | null {
  const latestWithVersion = [...rows]
    .filter((row) => row.script_version)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  return latestWithVersion?.script_version ?? null;
}

function syncHealthTone(status: string): HealthTone {
  if (status === 'OK') return 'ok';
  if (status === 'UNKNOWN') return 'safe';
  return 'warn';
}

function labelForMode(mode: SafeActionMode): string {
  return mode === 'disabled' ? 'Disabled' : 'Review only';
}

function formatCurrency(value: number, currency: string): string {
  return `${currency || 'THB'} ${value.toFixed(2)}`;
}

function maskSegment(value: string, visibleStart: number, visibleEnd: number): string {
  if (value.length <= visibleStart + visibleEnd) return '*'.repeat(Math.max(value.length, 4));
  return `${value.slice(0, visibleStart)}...${value.slice(-visibleEnd)}`;
}
