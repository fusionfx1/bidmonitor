import type { DataTableKey, Settings, SyncLogStatus, VoluumConversionMetric, VoluumMatchMode } from '../types';
import { makeAccountSource } from './accountSources';
import { normalizeDateValue } from './dateUtils';

export const GENERATED_SETTINGS_TAB = '_settings_global';
export const GENERATED_DASHBOARD_SETTINGS_TAB = '_settings_dashboard';

export const GENERATED_TAB_ALIASES: Partial<Record<DataTableKey, string[]>> = {
  campaigns: ['raw_campaign_daily'],
  adGroups: ['raw_ad_group_daily', 'raw_adgroup_daily'],
  keywords: ['raw_keyword_daily'],
  searchTerms: ['raw_search_terms_daily', 'raw_search_term_daily'],
  hourDevice: ['raw_device_daily', 'raw_hour_device_daily'],
  policy: ['raw_policy_ad_daily', 'raw_policy_daily', 'raw_ads_policy'],
  auctionCampaigns: ['raw_auction_campaign_daily', 'raw_auction_proxy_campaigns'],
  auctionKeywords: ['raw_auction_keyword_daily', 'raw_auction_proxy_keywords'],
  pmaxPerformance: ['raw_pmax_asset_group_daily', 'raw_pmax_performance'],
  geoPerformance: ['raw_geo_daily', 'raw_geo_performance'],
  placementPerformance: ['raw_placement_performance', 'raw_placement_daily'],
  voluum: ['raw_voluum_performance', 'raw_voluum_report'],
  syncLog: ['_sync_runs'],
};

type RawRow = Record<string, unknown>;

function str(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function num(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(/[%,]/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function first(row: RawRow, keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return value;
  }
  return '';
}

function cost(row: RawRow): number {
  const direct = first(row, ['cost', 'cost_thb']);
  if (direct !== '') return num(direct);
  const micros = first(row, ['cost_micros', 'metrics_cost_micros']);
  return micros === '' ? 0 : num(micros) / 1_000_000;
}

function syncStatus(value: unknown): SyncLogStatus {
  const status = str(value).toUpperCase();
  if (status === 'OK' || status === 'SUCCESS') return 'SUCCESS';
  if (status === 'PARTIAL' || status === 'WARNING') return 'PARTIAL';
  return 'FAILED';
}

function metricRows(rows: RawRow[]): RawRow[] {
  return rows.map((row) => {
    const clicks = num(row.clicks);
    const impressions = num(row.impressions);
    const rowCost = cost(row);
    const conversions = num(first(row, ['conversions', 'all_conversions']));
    const conversionValue = num(first(row, ['conversion_value', 'conversions_value', 'value']));

    return {
      ...row,
      date: normalizeDateValue(first(row, ['date', 'day', 'segments_date'])),
      campaign_name: first(row, ['campaign_name', 'campaign']),
      campaign_status: first(row, ['campaign_status', 'status']),
      channel: first(row, ['channel', 'advertising_channel_type']),
      bidding_strategy_type: first(row, ['bidding_strategy_type', 'bid_strategy_type']),
      daily_budget: first(row, ['daily_budget', 'budget']) || 0,
      cost: rowCost,
      ctr: first(row, ['ctr']) || (impressions ? clicks / impressions : 0),
      avg_cpc: first(row, ['avg_cpc']) || (clicks ? rowCost / clicks : 0),
      conversions,
      all_conversions: first(row, ['all_conversions']) || conversions,
      conversion_value: conversionValue,
    };
  });
}

function keywordRows(rows: RawRow[]): RawRow[] {
  return metricRows(rows).map((row) => ({
    ...row,
    keyword_key: first(row, ['keyword_key']) || [row.campaign_id, row.ad_group_id, row.criterion_id].map(str).join(':'),
    keyword: first(row, ['keyword', 'keyword_text']),
    match_type: first(row, ['match_type', 'keyword_match_type']),
    keyword_status: first(row, ['keyword_status', 'status']),
    keyword_cpc_bid: first(row, ['keyword_cpc_bid', 'cpc_bid']) || 0,
  }));
}

function voluumRows(rows: RawRow[]): RawRow[] {
  return rows.map((row) => ({
    ...row,
    date: normalizeDateValue(first(row, ['date', 'visit_date_bkk', 'postback_date_bkk', 'profit_date_bkk'])),
    keyword_key: first(row, ['keyword_key', 'keyword', 'custom_variable_1', 'var1']),
    campaign_id: first(row, ['campaign_id', 'voluum_campaign_id', 'campaign']),
    ad_group_id: first(row, ['ad_group_id', 'adgroup_id']),
    criterion_id: first(row, ['criterion_id', 'keyword_id']),
    voluum_visits: first(row, ['voluum_visits', 'visits']),
    voluum_clicks: first(row, ['voluum_clicks', 'clicks']),
    voluum_conversions: first(row, ['voluum_conversions', 'conversions', 'cv', 'conversions_count']),
    revenue: first(row, ['revenue', 'total_revenue', 'conversion_value', 'payout']),
    profit: first(row, ['profit', 'true_profit']),
    roi: first(row, ['roi']),
  }));
}

function syncRows(rows: RawRow[]): RawRow[] {
  return rows.map((row) => ({
    run_id: first(row, ['run_id', 'sync_run_id', 'id']),
    started_at: first(row, ['started_at', 'start_time']),
    finished_at: first(row, ['finished_at', 'completed_at', 'end_time']),
    status: syncStatus(first(row, ['status'])),
    duration_seconds: num(first(row, ['duration_seconds'])) || num(first(row, ['duration_ms'])) / 1000,
    trigger_type: first(row, ['trigger_type', 'triggered_by']),
    lookback_days: first(row, ['lookback_days']),
    tabs_updated: first(row, ['tabs_updated', 'jobs_run']),
    campaign_rows: first(row, ['campaign_rows']),
    adgroup_rows: first(row, ['adgroup_rows', 'ad_group_rows']),
    keyword_rows: first(row, ['keyword_rows']),
    search_term_rows: first(row, ['search_term_rows']),
    hour_device_rows: first(row, ['hour_device_rows']),
    policy_rows: first(row, ['policy_rows']),
    auction_campaign_rows: first(row, ['auction_campaign_rows']),
    auction_keyword_rows: first(row, ['auction_keyword_rows']),
    voluum_rows: first(row, ['voluum_rows']),
    error_message: first(row, ['error_message', 'errors']),
    script_version: first(row, ['script_version']),
  }));
}

export function normalizeGeneratedRows(key: DataTableKey, rows: RawRow[]): RawRow[] {
  if (key === 'syncLog') return syncRows(rows);
  if (key === 'voluum') return voluumRows(rows);
  if (key === 'keywords' || key === 'auctionKeywords') return keywordRows(rows);
  if (key === 'searchTerms') {
    return metricRows(rows).map((row) => ({
      ...row,
      search_term: first(row, ['search_term', 'term']),
      search_term_status: first(row, ['search_term_status', 'status']),
    }));
  }
  if (key === 'adGroups') {
    return metricRows(rows).map((row) => ({
      ...row,
      ad_group_status: first(row, ['ad_group_status', 'status']),
      ad_group_cpc_bid: first(row, ['ad_group_cpc_bid', 'cpc_bid']) || 0,
    }));
  }
  if (key === 'hourDevice') return metricRows(rows);

  const metricKeys: DataTableKey[] = [
    'campaigns',
    'auctionCampaigns',
    'pmaxPerformance',
    'geoPerformance',
    'placementPerformance',
  ];
  if (metricKeys.includes(key)) return metricRows(rows);

  return rows;
}

function settingsObject(rows: RawRow[]): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [str(row.key), str(row.value)]));
}

function conversionMetric(value: string, fallback: VoluumConversionMetric): VoluumConversionMetric {
  return value === 'revenue_conversions' || value === 'conversions' ? value : fallback;
}

function matchMode(value: string, fallback: VoluumMatchMode): VoluumMatchMode {
  return value === 'strict' || value === 'all' || value === 'auto' ? value : fallback;
}

export function mergeGeneratedSheetSettings(
  current: Settings,
  settingsRows: RawRow[],
  spreadsheetId: string,
  rawSheetInput: string
): Settings {
  const values = settingsObject(settingsRows);
  const accountId = values.account_id || values.customer_id;
  const customerId = values.customer_id || values.account_id;

  if (!accountId || !customerId || !spreadsheetId) return current;

  const source = makeAccountSource({
    account_id: accountId,
    customer_id: customerId,
    account_name: values.account_name || values.project_name || accountId,
    spreadsheet_id: spreadsheetId,
    spreadsheet_url: rawSheetInput.startsWith('http') ? rawSheetInput : '',
    timezone: values.timezone || current.account_sources.find((candidate) => candidate.spreadsheet_id === spreadsheetId)?.timezone,
    currency: values.currency || current.currency,
    enabled: true,
  });

  const sources = [
    ...current.account_sources.filter((candidate) => candidate.id !== source.id),
    source,
  ];

  return {
    ...current,
    currency: source.currency || current.currency,
    account_id: source.account_id,
    customer_id: source.customer_id,
    sheet_id: spreadsheetId,
    account_sources: sources,
    selected_account_source_id: source.id,
  };
}

export function mergeGeneratedDashboardSettings(current: Settings, settingsRows: RawRow[]): Settings {
  const values = settingsObject(settingsRows);
  const accountName = values.DASHBOARD_ACCOUNT_NAME || values.dashboard_account_name;
  const requestedConversionMetric = values.VOLUUM_CONVERSION_METRIC || values.voluum_conversion_metric;
  const requestedMatchMode = values.VOLUUM_MATCH_MODE || values.voluum_match_mode;

  const nextSources = accountName
    ? current.account_sources.map((source) => source.id === current.selected_account_source_id
      ? { ...source, account_name: accountName }
      : source)
    : current.account_sources;

  return {
    ...current,
    account_sources: nextSources,
    voluum_campaign_filter: values.VOLUUM_CAMPAIGN_FILTER || values.voluum_campaign_filter || current.voluum_campaign_filter,
    voluum_conversion_metric: conversionMetric(requestedConversionMetric, current.voluum_conversion_metric),
    voluum_match_mode: matchMode(requestedMatchMode, current.voluum_match_mode),
  };
}
