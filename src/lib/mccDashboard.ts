import type { CampaignRow, GoogleSyncLogRow, ImportedData, Settings, VoluumRow } from '../types';
import { normalizeAccountSources } from './accountSources';
import { normalizeSafeActionMode } from './settingsHealth';
import { computeSyncHealth, computeVoluumFreshness } from './syncHealth';
import type { FreshnessStatus, VoluumFreshnessStatus } from './syncHealth';

export type DashboardTone = 'ok' | 'warn' | 'error' | 'safe' | 'missing';
export type MccAlertLevel = 'warning' | 'critical' | 'info';

export interface MccSummaryCard {
  id: string;
  label: string;
  value: number;
  displayValue: string;
  tone: DashboardTone;
  meaning: string;
  action: string;
  outcome: string;
}

export interface MccAlert {
  id: string;
  level: MccAlertLevel;
  label: string;
  drillHref: string;
}

export interface MccSparkPoint {
  date: string;
  cost: number;
}

export interface MccAccountRow {
  id: string;
  name: string;
  accountId: string;
  customerId: string;
  sourceSheetId: string;
  cost: number;
  conversions: number;
  revenue: number;
  value: number;
  cpa: number | null;
  roi: number | null;
  roas: number | null;
  projectedMonthSpend: number;
  sparkline: MccSparkPoint[];
  alerts: MccAlert[];
  drillHref: string;
}

export interface MccFreshnessIndicator {
  id: 'google' | 'voluum';
  label: string;
  tone: DashboardTone;
  status: string;
  runsToday: number | null;
  expectedRunsToday: number | null;
  rows: number;
  lastAt: string | null;
}

export interface MccDashboardModel {
  summaryCards: MccSummaryCard[];
  accountRows: MccAccountRow[];
  freshness: MccFreshnessIndicator[];
  visibleActionMode: 'review_only' | 'disabled';
  totalAlerts: number;
  hasVoluum: boolean;
}

type AccountBucket = {
  id: string;
  name: string;
  accountId: string;
  customerId: string;
  sourceSheetId: string;
  campaigns: CampaignRow[];
  voluum: VoluumRow[];
};

export function buildMccDashboard(data: ImportedData, settings: Settings): MccDashboardModel {
  const normalizedSettings = normalizeAccountSources(settings);
  const buckets = new Map<string, AccountBucket>();

  data.campaigns.forEach((row) => {
    bucketFor(row, normalizedSettings, buckets).campaigns.push(row);
  });

  data.voluum.forEach((row) => {
    bucketFor(row, normalizedSettings, buckets).voluum.push(row);
  });

  if (buckets.size === 0 && normalizedSettings.account_sources.length > 0) {
    normalizedSettings.account_sources.forEach((source) => {
      const id = keyFromParts(source.account_id, source.customer_id, source.spreadsheet_id);
      buckets.set(id, {
        id,
        name: source.account_name || source.account_id || source.customer_id || 'Configured account',
        accountId: source.account_id,
        customerId: source.customer_id,
        sourceSheetId: source.spreadsheet_id,
        campaigns: [],
        voluum: [],
      });
    });
  }

  const googleHealth = computeSyncHealth(data.syncLog);
  const voluumHealth = computeVoluumFreshness(data);
  const accountRows = [...buckets.values()]
    .map((bucket) => buildAccountRow(bucket, settings, googleHealth.freshnessStatus, voluumHealth.status))
    .sort((a, b) => b.cost - a.cost);

  const totals = accountRows.reduce(
    (acc, row) => ({
      cost: acc.cost + row.cost,
      conversions: acc.conversions + row.conversions,
      revenue: acc.revenue + row.revenue,
      projectedMonthSpend: acc.projectedMonthSpend + row.projectedMonthSpend,
      alerts: acc.alerts + row.alerts.length,
    }),
    { cost: 0, conversions: 0, revenue: 0, projectedMonthSpend: 0, alerts: 0 }
  );

  const cpa = totals.conversions > 0 ? totals.cost / totals.conversions : null;
  const roi = totals.cost > 0 ? ((totals.revenue - totals.cost) / totals.cost) * 100 : null;
  const roas = totals.cost > 0 ? (totals.revenue / totals.cost) * 100 : null;
  const hasVoluum = data.voluum.length > 0;

  return {
    summaryCards: [
      card('total_cost', 'Total cost', totals.cost, currency(totals.cost, settings.currency), totals.cost > 0 ? 'safe' : 'missing', 'Google spend across imported MCC accounts.', 'Review accounts with high spend first.', 'Spend pressure is visible before changing bids.'),
      card('conversions', 'Conversions', totals.conversions, totals.conversions.toFixed(1), totals.conversions > 0 ? 'ok' : 'warn', hasVoluum ? 'Uses Voluum conversions when present.' : 'Uses Google conversions until Voluum is imported.', 'Connect Voluum for true conversion validation.', 'Conversion source is explicit per dashboard.'),
      card('true_value', 'True revenue/value', totals.revenue, currency(totals.revenue, settings.currency), totals.revenue > totals.cost ? 'ok' : totals.revenue > 0 ? 'warn' : 'missing', hasVoluum ? 'Revenue is sourced from Voluum rows.' : 'Value falls back to Google conversion value.', 'Use Voluum import to reduce attribution drift.', 'Profitability reads from the best local source available.'),
      card('cpa', 'CPA', cpa ?? 0, cpa === null ? 'N/A' : currency(cpa, settings.currency), cpa !== null && cpa <= settings.target_cpa ? 'ok' : cpa !== null ? 'warn' : 'missing', `Target CPA is ${currency(settings.target_cpa, settings.currency)}.`, 'Open accounts above target for diagnostics.', 'Overspend is flagged without executing changes.'),
      card('roi_roas', 'ROI / ROAS', roi ?? 0, `${roi === null ? 'N/A' : `${roi.toFixed(1)}%`} / ${roas === null ? 'N/A' : `${roas.toFixed(1)}%`}`, roi !== null && roi >= 0 ? 'ok' : roi !== null ? 'warn' : 'missing', 'ROI is profit over spend; ROAS is revenue over spend.', 'Prioritize negative ROI accounts.', 'The dashboard separates profit and return rate.'),
      card('projected_month_spend', 'Projected month spend', totals.projectedMonthSpend, currency(totals.projectedMonthSpend, settings.currency), totals.projectedMonthSpend > settings.max_daily_loss * 30 ? 'warn' : 'safe', 'Projection uses imported active days and calendar month length.', 'Check pacing before budget recommendations.', 'Month-end exposure is visible in review mode.'),
      card('alerts', 'Alerts', totals.alerts, String(totals.alerts), totals.alerts > 0 ? 'warn' : 'ok', 'Counts stale sync, missing scope, CPA, and profit alerts.', 'Drill into flagged account rows.', 'Review queue starts from concrete account issues.'),
    ],
    accountRows,
    freshness: [
      googleFreshness(googleHealth, data.syncLog),
      voluumFreshness(voluumHealth),
    ],
    visibleActionMode: normalizeSafeActionMode(settings.action_mode),
    totalAlerts: totals.alerts,
    hasVoluum,
  };
}

function buildAccountRow(
  bucket: AccountBucket,
  settings: Settings,
  freshnessStatus: FreshnessStatus,
  voluumFreshnessStatus: VoluumFreshnessStatus
): MccAccountRow {
  const cost = sum(bucket.campaigns, 'cost');
  const googleConversions = sum(bucket.campaigns, 'conversions');
  const useVoluum = bucket.voluum.length > 0 && voluumFreshnessStatus === 'OK';
  const voluumConversions = sum(bucket.voluum, 'voluum_conversions');
  const conversions = useVoluum ? voluumConversions : googleConversions;
  const googleValue = sum(bucket.campaigns, 'conversion_value');
  const voluumRevenue = sum(bucket.voluum, 'revenue');
  const revenue = useVoluum ? voluumRevenue : googleValue;
  const cpa = conversions > 0 ? cost / conversions : null;
  const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : null;
  const roas = cost > 0 ? (revenue / cost) * 100 : null;
  const projectedMonthSpend = projectMonthSpend(bucket.campaigns);
  const sparkline = buildSparkline(bucket.campaigns);
  const alerts = buildAlerts(bucket, settings, cost, conversions, revenue, cpa, roi, freshnessStatus, voluumFreshnessStatus);

  return {
    id: bucket.id,
    name: bucket.name,
    accountId: bucket.accountId || 'missing',
    customerId: bucket.customerId || 'missing',
    sourceSheetId: bucket.sourceSheetId || 'missing',
    cost,
    conversions,
    revenue,
    value: revenue,
    cpa,
    roi,
    roas,
    projectedMonthSpend,
    sparkline,
    alerts,
    drillHref: '/diagnostics',
  };
}

function buildAlerts(
  bucket: AccountBucket,
  settings: Settings,
  cost: number,
  conversions: number,
  revenue: number,
  cpa: number | null,
  roi: number | null,
  freshnessStatus: FreshnessStatus,
  voluumFreshnessStatus: VoluumFreshnessStatus
): MccAlert[] {
  const alerts: MccAlert[] = [];
  if (!bucket.accountId || !bucket.customerId || !bucket.sourceSheetId) {
    alerts.push({ id: 'missing_scope', level: 'critical', label: 'Missing account scope', drillHref: '/settings' });
  }
  if (freshnessStatus === 'STALE' || freshnessStatus === 'ERROR') {
    alerts.push({ id: 'stale_google_sync', level: 'critical', label: 'Google sync fail-closed', drillHref: '/diagnostics' });
  }
  if (voluumFreshnessStatus === 'STALE' || voluumFreshnessStatus === 'ERROR' || voluumFreshnessStatus === 'UNKNOWN') {
    alerts.push({ id: 'stale_voluum_sync', level: 'critical', label: 'Voluum import fail-closed', drillHref: '/diagnostics' });
  }
  if (cost >= settings.min_cost_to_decide && conversions === 0) {
    alerts.push({ id: 'cost_no_conversion', level: 'warning', label: 'Cost with no conversions', drillHref: '/search-terms' });
  }
  if (cpa !== null && cpa > settings.target_cpa) {
    alerts.push({ id: 'cpa_above_target', level: 'warning', label: 'CPA above target', drillHref: '/bid-decisions' });
  }
  if (roi !== null && roi < 0 && revenue > 0) {
    alerts.push({ id: 'negative_profit', level: 'warning', label: 'Negative profit', drillHref: '/profit' });
  }
  if (bucket.voluum.length === 0) {
    alerts.push({ id: 'no_voluum', level: 'info', label: 'Voluum not imported', drillHref: '/voluum' });
  }
  return alerts;
}

function bucketFor(
  row: Pick<CampaignRow | VoluumRow, 'account_id' | 'customer_id' | 'source_sheet_id'>,
  settings: Settings,
  buckets: Map<string, AccountBucket>
): AccountBucket {
  const source = settings.account_sources.find((candidate) =>
    candidate.account_id === row.account_id
    && candidate.customer_id === row.customer_id
    && candidate.spreadsheet_id === row.source_sheet_id
  );
  const accountId = row.account_id ?? source?.account_id ?? settings.account_id;
  const customerId = row.customer_id ?? source?.customer_id ?? settings.customer_id;
  const sourceSheetId = row.source_sheet_id ?? source?.spreadsheet_id ?? settings.sheet_id;
  const id = keyFromParts(accountId, customerId, sourceSheetId);
  const existing = buckets.get(id);
  if (existing) return existing;

  const bucket: AccountBucket = {
    id,
    name: source?.account_name || accountId || customerId || 'Unscoped import',
    accountId: accountId ?? '',
    customerId: customerId ?? '',
    sourceSheetId: sourceSheetId ?? '',
    campaigns: [],
    voluum: [],
  };
  buckets.set(id, bucket);
  return bucket;
}

function buildSparkline(rows: CampaignRow[]): MccSparkPoint[] {
  const byDate = new Map<string, number>();
  rows.forEach((row) => {
    const date = normalizedDate(row.date);
    if (!date) return;
    byDate.set(date, (byDate.get(date) ?? 0) + row.cost);
  });
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, cost]) => ({ date, cost }));
}

function projectMonthSpend(rows: CampaignRow[]): number {
  if (rows.length === 0) return 0;
  const dates = [...new Set(rows.map((row) => normalizedDate(row.date)).filter(Boolean))].sort();
  const daysCovered = Math.max(1, dates.length);
  const latestDate = dates[dates.length - 1] ?? new Date().toISOString().slice(0, 10);
  const parsed = new Date(`${latestDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return 0;
  const daysInMonth = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0)).getUTCDate();
  return (sum(rows, 'cost') / daysCovered) * daysInMonth;
}

function googleFreshness(health: ReturnType<typeof computeSyncHealth>, rows: GoogleSyncLogRow[]): MccFreshnessIndicator {
  return {
    id: 'google',
    label: 'Google Ads script',
    tone: freshnessTone(health.freshnessStatus),
    status: health.freshnessStatus,
    runsToday: health.runsToday,
    expectedRunsToday: health.expectedRunsToday,
    rows: rows.length,
    lastAt: health.lastScriptRunAt,
  };
}

function voluumFreshness(health: ReturnType<typeof computeVoluumFreshness>): MccFreshnessIndicator {
  return {
    id: 'voluum',
    label: 'Voluum import',
    tone: health.status === 'OPTIONAL' ? 'safe' : freshnessTone(health.status),
    status: health.status,
    runsToday: null,
    expectedRunsToday: null,
    rows: health.rows,
    lastAt: health.importedAt,
  };
}

function freshnessTone(status: FreshnessStatus | 'OPTIONAL'): DashboardTone {
  if (status === 'OK') return 'ok';
  if (status === 'ERROR') return 'error';
  if (status === 'STALE') return 'warn';
  if (status === 'OPTIONAL') return 'safe';
  return 'missing';
}

function card(
  id: string,
  label: string,
  value: number,
  displayValue: string,
  tone: DashboardTone,
  meaning: string,
  action: string,
  outcome: string
): MccSummaryCard {
  return { id, label, value, displayValue, tone, meaning, action, outcome };
}

function sum<T>(rows: T[], key: keyof T): number {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function currency(value: number, currencyCode: string): string {
  return `${currencyCode || 'THB'} ${value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function normalizedDate(value: string): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function keyFromParts(accountId?: string, customerId?: string, sourceSheetId?: string): string {
  const key = [accountId, customerId, sourceSheetId].map((part) => part?.trim() || 'missing').join('|');
  return key.toLowerCase();
}
