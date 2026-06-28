import type { CampaignRow, GoogleSyncLogRow, ImportedData, Settings } from '../types';
import { computeSyncHealth } from './syncHealth';

export type TrendPreset = '7d' | '30d' | '90d' | '180d';
export type TrendVerdict = 'winner' | 'loser' | 'watch' | 'insufficient';

export interface TrendDailyRow {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  value: number;
  ctr: number;
  cvr: number;
  cpa: number | null;
  roi: number | null;
  roas: number | null;
  costMa7: number | null;
  costMa28: number | null;
  conversionsMa7: number | null;
  conversionsMa28: number | null;
}

export interface TrendMetricCard {
  id: string;
  label: string;
  value: number;
  displayValue: string;
  tone: 'ok' | 'warn' | 'safe' | 'missing';
}

export interface CampaignTrendSummary {
  campaignId: string;
  campaignName: string;
  channel: string;
  cost: number;
  conversions: number;
  value: number;
  profit: number;
  cpa: number | null;
  roi: number | null;
  verdict: TrendVerdict;
  reason: string;
}

export interface PacingSummary {
  activeDays: number;
  daysInMonth: number;
  projectedMonthSpend: number;
  rankLostCampaigns: number;
  budgetLostCampaigns: number;
}

export interface TrendModel {
  campaignOptions: Array<{ id: string; name: string }>;
  dailyRows: TrendDailyRow[];
  metricCards: TrendMetricCard[];
  channelBreakdown: Array<{ channel: string; cost: number; conversions: number; value: number; roi: number | null }>;
  campaignSummaries: CampaignTrendSummary[];
  pacing: PacingSummary;
}

export interface DiagnosticDriver {
  id: string;
  label: string;
  current: number;
  previous: number;
  delta: number;
  direction: 'up' | 'down' | 'flat';
  impact: 'positive' | 'negative' | 'neutral';
}

export interface DiagnosticsModel {
  drivers: DiagnosticDriver[];
  autoInsight: string;
  recommendedAction: string;
  risk: 'low' | 'medium' | 'high';
  quickWins: string[];
  copyPrompt: string;
  debugPacket: string;
  staleFailClosed: boolean;
}

type BuildOptions = {
  campaignId?: string;
  includeAllCampaigns?: boolean;
  preset?: TrendPreset;
};

type Totals = {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  value: number;
};

const PRESET_DAYS: Record<TrendPreset, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '180d': 180,
};

export function buildTrendModel(data: ImportedData, settings: Settings, options: BuildOptions = {}): TrendModel {
  const rows = filterCampaignRows(data.campaigns, options);
  const dailyRows = buildDailyRows(rows, options.preset ?? '30d');
  const totals = sumTotals(rows);
  const channelBreakdown = buildChannelBreakdown(rows);
  const campaignSummaries = buildCampaignSummaries(rows, settings);

  return {
    campaignOptions: buildCampaignOptions(data.campaigns),
    dailyRows,
    metricCards: buildMetricCards(totals, settings),
    channelBreakdown,
    campaignSummaries,
    pacing: {
      ...buildPacing(rows),
      rankLostCampaigns: data.auctionCampaigns.filter((row) => row.search_rank_lost_impression_share > 0.2).length,
      budgetLostCampaigns: data.auctionCampaigns.filter((row) => row.search_budget_lost_impression_share > 0.2).length,
    },
  };
}

export function buildDiagnosticsModel(data: ImportedData, settings: Settings): DiagnosticsModel {
  const rows = sortByDate(data.campaigns);
  const latestDates = [...new Set(rows.map((row) => normalizeDate(row.date)).filter(Boolean))];
  const currentDates = latestDates.slice(-7);
  const previousDates = latestDates.slice(-14, -7);
  const current = sumTotals(rows.filter((row) => currentDates.includes(normalizeDate(row.date) ?? '')));
  const previous = sumTotals(rows.filter((row) => previousDates.includes(normalizeDate(row.date) ?? '')));
  const currentProfit = current.value - current.cost;
  const previousProfit = previous.value - previous.cost;
  const currentCpa = current.conversions > 0 ? current.cost / current.conversions : 0;
  const previousCpa = previous.conversions > 0 ? previous.cost / previous.conversions : 0;
  const health = computeSyncHealth(data.syncLog);
  const staleFailClosed = health.freshnessStatus === 'STALE' || health.freshnessStatus === 'ERROR';

  const drivers: DiagnosticDriver[] = [
    driver('cost', 'Spend', current.cost, previous.cost, current.cost <= previous.cost ? 'positive' : 'neutral'),
    driver('conversions', 'Conversions', current.conversions, previous.conversions, current.conversions >= previous.conversions ? 'positive' : 'negative'),
    driver('cvr', 'CVR', ratio(current.conversions, current.clicks), ratio(previous.conversions, previous.clicks), ratio(current.conversions, current.clicks) >= ratio(previous.conversions, previous.clicks) ? 'positive' : 'negative'),
    driver('cpa', 'CPA', currentCpa, previousCpa, currentCpa > 0 && previousCpa > 0 && currentCpa <= previousCpa ? 'positive' : 'negative'),
    driver('profit', 'Profit', currentProfit, previousProfit, currentProfit >= previousProfit ? 'positive' : 'negative'),
  ];

  const strongest = [...drivers].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  const risk = staleFailClosed ? 'high' : current.cost >= settings.max_daily_loss * 7 && currentProfit < 0 ? 'high' : currentProfit < 0 ? 'medium' : 'low';
  const recommendedAction = staleFailClosed
    ? 'Stop scaling decisions until Google sync is fresh; use diagnostics only for investigation.'
    : currentProfit < 0
      ? 'Review high-spend losers, search terms, and CPA drivers before approving budget or bid proposals.'
      : 'Prioritize winners with sufficient conversions and keep recommendations in review-only mode.';

  return {
    drivers,
    autoInsight: strongest
      ? `${strongest.label} is the largest week-over-week driver (${signed(strongest.delta)}).`
      : 'Not enough data for a week-over-week driver tree.',
    recommendedAction,
    risk,
    quickWins: buildQuickWins(staleFailClosed, current, settings),
    copyPrompt: buildCopyPrompt(current, previous, health.freshnessStatus, recommendedAction),
    debugPacket: buildDebugPacket(data, settings, health.lastScriptRunAt, health.lastStatus, health.lastErrorMessage),
    staleFailClosed,
  };
}

function filterCampaignRows(rows: CampaignRow[], options: BuildOptions): CampaignRow[] {
  const scoped = options.includeAllCampaigns || !options.campaignId
    ? rows
    : rows.filter((row) => row.campaign_id === options.campaignId);
  const presetDays = PRESET_DAYS[options.preset ?? '30d'];
  const dates = [...new Set(scoped.map((row) => normalizeDate(row.date)).filter(Boolean))].sort();
  const allowed = new Set(dates.slice(-presetDays));
  return scoped.filter((row) => allowed.has(normalizeDate(row.date) ?? ''));
}

function buildDailyRows(rows: CampaignRow[], preset: TrendPreset): TrendDailyRow[] {
  const byDate = new Map<string, CampaignRow[]>();
  filterCampaignRows(rows, { includeAllCampaigns: true, preset }).forEach((row) => {
    const date = normalizeDate(row.date);
    if (!date) return;
    byDate.set(date, [...(byDate.get(date) ?? []), row]);
  });

  const daily = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, group]) => dailyFromTotals(date, sumTotals(group)));

  return daily.map((row, index) => ({
    ...row,
    costMa7: movingAverage(daily, index, 'cost', 7),
    costMa28: movingAverage(daily, index, 'cost', 28),
    conversionsMa7: movingAverage(daily, index, 'conversions', 7),
    conversionsMa28: movingAverage(daily, index, 'conversions', 28),
  }));
}

function buildMetricCards(totals: Totals, settings: Settings): TrendMetricCard[] {
  const cpa = totals.conversions > 0 ? totals.cost / totals.conversions : null;
  const roi = totals.cost > 0 ? ((totals.value - totals.cost) / totals.cost) * 100 : null;
  const roas = totals.cost > 0 ? (totals.value / totals.cost) * 100 : null;
  return [
    metric('impressions', 'Impressions', totals.impressions, totals.impressions.toLocaleString(), totals.impressions > 0 ? 'safe' : 'missing'),
    metric('clicks', 'Clicks', totals.clicks, totals.clicks.toLocaleString(), totals.clicks > 0 ? 'safe' : 'missing'),
    metric('cost', 'Cost', totals.cost, currency(totals.cost, settings.currency), totals.cost > 0 ? 'safe' : 'missing'),
    metric('conversions', 'Conversions', totals.conversions, totals.conversions.toFixed(1), totals.conversions > 0 ? 'ok' : 'warn'),
    metric('value', 'Value', totals.value, currency(totals.value, settings.currency), totals.value >= totals.cost && totals.value > 0 ? 'ok' : 'warn'),
    metric('ctr', 'CTR', ratio(totals.clicks, totals.impressions), percent(ratio(totals.clicks, totals.impressions) * 100), totals.clicks > 0 ? 'ok' : 'missing'),
    metric('cpa', 'CPA', cpa ?? 0, cpa === null ? 'N/A' : currency(cpa, settings.currency), cpa !== null && cpa <= settings.target_cpa ? 'ok' : 'warn'),
    metric('cvr', 'CVR', ratio(totals.conversions, totals.clicks), percent(ratio(totals.conversions, totals.clicks) * 100), totals.conversions > 0 ? 'ok' : 'warn'),
    metric('roi', 'ROI', roi ?? 0, roi === null ? 'N/A' : percent(roi), roi !== null && roi >= 0 ? 'ok' : 'warn'),
    metric('roas', 'ROAS', roas ?? 0, roas === null ? 'N/A' : percent(roas), roas !== null && roas >= 100 ? 'ok' : 'warn'),
  ];
}

function buildCampaignSummaries(rows: CampaignRow[], settings: Settings): CampaignTrendSummary[] {
  const byCampaign = new Map<string, CampaignRow[]>();
  rows.forEach((row) => {
    byCampaign.set(row.campaign_id, [...(byCampaign.get(row.campaign_id) ?? []), row]);
  });

  return [...byCampaign.entries()].map(([campaignId, group]) => {
    const totals = sumTotals(group);
    const profit = totals.value - totals.cost;
    const cpa = totals.conversions > 0 ? totals.cost / totals.conversions : null;
    const roi = totals.cost > 0 ? (profit / totals.cost) * 100 : null;
    const hasSufficientData = totals.clicks >= settings.min_clicks || totals.cost >= settings.min_cost_to_decide;
    const verdict: TrendVerdict = !hasSufficientData
      ? 'insufficient'
      : profit > 0 && cpa !== null && cpa <= settings.target_cpa
        ? 'winner'
        : profit < 0 || (cpa !== null && cpa > settings.target_cpa)
          ? 'loser'
          : 'watch';
    return {
      campaignId,
      campaignName: group[0]?.campaign_name ?? campaignId,
      channel: group[0]?.channel ?? 'UNKNOWN',
      cost: totals.cost,
      conversions: totals.conversions,
      value: totals.value,
      profit,
      cpa,
      roi,
      verdict,
      reason: reasonFor(verdict, totals, settings),
    };
  }).sort((a, b) => b.cost - a.cost);
}

function buildChannelBreakdown(rows: CampaignRow[]): TrendModel['channelBreakdown'] {
  const byChannel = new Map<string, CampaignRow[]>();
  rows.forEach((row) => {
    byChannel.set(row.channel || 'UNKNOWN', [...(byChannel.get(row.channel || 'UNKNOWN') ?? []), row]);
  });
  return [...byChannel.entries()].map(([channel, group]) => {
    const totals = sumTotals(group);
    return {
      channel,
      cost: totals.cost,
      conversions: totals.conversions,
      value: totals.value,
      roi: totals.cost > 0 ? ((totals.value - totals.cost) / totals.cost) * 100 : null,
    };
  }).sort((a, b) => b.cost - a.cost);
}

function buildPacing(rows: CampaignRow[]): Omit<PacingSummary, 'rankLostCampaigns' | 'budgetLostCampaigns'> {
  const dates = [...new Set(rows.map((row) => normalizeDate(row.date)).filter(Boolean))].sort();
  const activeDays = dates.length;
  const latest = dates[dates.length - 1];
  if (!latest) return { activeDays: 0, daysInMonth: 0, projectedMonthSpend: 0 };
  const date = new Date(`${latest}T00:00:00.000Z`);
  const daysInMonth = Number.isNaN(date.getTime()) ? 0 : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return {
    activeDays,
    daysInMonth,
    projectedMonthSpend: activeDays > 0 ? (sumTotals(rows).cost / activeDays) * daysInMonth : 0,
  };
}

function buildQuickWins(staleFailClosed: boolean, current: Totals, settings: Settings): string[] {
  const wins = [];
  if (staleFailClosed) wins.push('Refresh Google sync before approving any recommendations.');
  if (current.cost >= settings.min_cost_to_decide && current.conversions === 0) wins.push('Inspect high-cost zero-conversion campaigns and search terms.');
  if (current.clicks >= settings.min_clicks && current.conversions === 0) wins.push('Check landing page and tracking for high-click no-conversion segments.');
  wins.push('Keep action mode review_only; export findings instead of applying changes.');
  return wins;
}

function buildCopyPrompt(current: Totals, previous: Totals, freshness: string, action: string): string {
  return [
    'Analyze this Google Ads account trend using only supplied metrics.',
    `Freshness: ${freshness}.`,
    `Current 7d: cost=${current.cost.toFixed(2)}, conversions=${current.conversions.toFixed(2)}, value=${current.value.toFixed(2)}.`,
    `Previous 7d: cost=${previous.cost.toFixed(2)}, conversions=${previous.conversions.toFixed(2)}, value=${previous.value.toFixed(2)}.`,
    `Recommended local action: ${action}`,
    'Do not suggest direct Google Ads API writes; keep all changes review-only.',
  ].join('\n');
}

function buildDebugPacket(
  data: ImportedData,
  settings: Settings,
  lastRunAt: string | null,
  lastStatus: GoogleSyncLogRow['status'] | null,
  lastError: string | null
): string {
  return JSON.stringify({
    generated_at: new Date().toISOString(),
    action_mode: settings.action_mode,
    currency: settings.currency,
    target_cpa: settings.target_cpa,
    script_last_run_at: lastRunAt,
    script_last_status: lastStatus,
    script_last_error: lastError,
    row_counts: {
      campaigns: data.campaigns.length,
      search_terms: data.searchTerms.length,
      sync_log: data.syncLog.length,
      voluum: data.voluum.length,
    },
    sample_campaign_rows: data.campaigns.slice(0, 3),
  }, null, 2);
}

function buildCampaignOptions(rows: CampaignRow[]): TrendModel['campaignOptions'] {
  const byId = new Map<string, string>();
  rows.forEach((row) => {
    if (row.campaign_id) byId.set(row.campaign_id, row.campaign_name || row.campaign_id);
  });
  return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

function dailyFromTotals(date: string, totals: Totals): Omit<TrendDailyRow, 'costMa7' | 'costMa28' | 'conversionsMa7' | 'conversionsMa28'> {
  return {
    date,
    ...totals,
    ctr: ratio(totals.clicks, totals.impressions),
    cvr: ratio(totals.conversions, totals.clicks),
    cpa: totals.conversions > 0 ? totals.cost / totals.conversions : null,
    roi: totals.cost > 0 ? ((totals.value - totals.cost) / totals.cost) * 100 : null,
    roas: totals.cost > 0 ? (totals.value / totals.cost) * 100 : null,
  };
}

function driver(id: string, label: string, current: number, previous: number, positiveWhen: 'positive' | 'negative' | 'neutral'): DiagnosticDriver {
  const delta = current - previous;
  return {
    id,
    label,
    current,
    previous,
    delta,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    impact: delta === 0 ? 'neutral' : positiveWhen,
  };
}

function movingAverage(
  rows: Array<{ cost: number; conversions: number }>,
  index: number,
  key: 'cost' | 'conversions',
  window: number
): number | null {
  const start = index - window + 1;
  if (start < 0) return null;
  const slice = rows.slice(start, index + 1);
  return slice.reduce((total, row) => total + Number(row[key] ?? 0), 0) / window;
}

function sumTotals(rows: CampaignRow[]): Totals {
  return rows.reduce((total, row) => ({
    impressions: total.impressions + row.impressions,
    clicks: total.clicks + row.clicks,
    cost: total.cost + row.cost,
    conversions: total.conversions + row.conversions,
    value: total.value + row.conversion_value,
  }), { impressions: 0, clicks: 0, cost: 0, conversions: 0, value: 0 });
}

function sortByDate(rows: CampaignRow[]): CampaignRow[] {
  return [...rows].sort((a, b) => normalizeDate(a.date)?.localeCompare(normalizeDate(b.date) ?? '') ?? 0);
}

function normalizeDate(value: string): string | null {
  return value ? value.slice(0, 10) : null;
}

function metric(id: string, label: string, value: number, displayValue: string, tone: TrendMetricCard['tone']): TrendMetricCard {
  return { id, label, value, displayValue, tone };
}

function reasonFor(verdict: TrendVerdict, totals: Totals, settings: Settings): string {
  if (verdict === 'insufficient') return `Needs at least ${settings.min_clicks} clicks or ${settings.min_cost_to_decide} cost.`;
  if (verdict === 'winner') return 'Profitable and CPA is within target.';
  if (verdict === 'loser') return totals.conversions === 0 ? 'Spend is high with no conversions.' : 'Profit or CPA is below target.';
  return 'Mixed signal; keep under review.';
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function currency(value: number, currencyCode: string): string {
  return `${currencyCode || 'THB'} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}
