import type {
  CampaignRow, AdGroupRow, KeywordRow, SearchTermRow, HourDeviceRow,
  PolicyRow, AuctionCampaignRow, AuctionKeywordRow, VoluumRow, GoogleSyncLogRow,
} from '../../types';

function num(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const s = String(v).replace(/[%,]/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

function parseRows<T>(
  raw: Record<string, unknown>[],
  transform: (r: Record<string, unknown>) => T
): T[] {
  return raw.map(transform);
}

export function parseCampaigns(raw: Record<string, unknown>[]): CampaignRow[] {
  return parseRows<CampaignRow>(raw, (r) => ({
    date: str(r['date']),
    campaign_id: str(r['campaign_id']),
    campaign_name: str(r['campaign_name']),
    campaign_status: str(r['campaign_status']),
    serving_status: str(r['serving_status']),
    channel: str(r['channel']),
    bidding_strategy_type: str(r['bidding_strategy_type']),
    campaign_start_date: str(r['campaign_start_date']),
    campaign_end_date: str(r['campaign_end_date']),
    daily_budget: num(r['daily_budget']),
    impressions: num(r['impressions']),
    clicks: num(r['clicks']),
    cost: num(r['cost']),
    ctr: num(r['ctr']),
    avg_cpc: num(r['avg_cpc']),
    conversions: num(r['conversions']),
    all_conversions: num(r['all_conversions']),
    conversion_value: num(r['conversion_value']),
  }));
}

export function parseAdGroups(raw: Record<string, unknown>[]): AdGroupRow[] {
  return parseRows<AdGroupRow>(raw, (r) => ({
    date: str(r['date']),
    campaign_id: str(r['campaign_id']),
    campaign_name: str(r['campaign_name']),
    bidding_strategy_type: str(r['bidding_strategy_type']),
    ad_group_id: str(r['ad_group_id']),
    ad_group_name: str(r['ad_group_name']),
    ad_group_status: str(r['ad_group_status']),
    ad_group_cpc_bid: num(r['ad_group_cpc_bid']),
    impressions: num(r['impressions']),
    clicks: num(r['clicks']),
    cost: num(r['cost']),
    ctr: num(r['ctr']),
    avg_cpc: num(r['avg_cpc']),
    conversions: num(r['conversions']),
    all_conversions: num(r['all_conversions']),
    conversion_value: num(r['conversion_value']),
  }));
}

export function parseKeywords(raw: Record<string, unknown>[]): KeywordRow[] {
  return parseRows<KeywordRow>(raw, (r) => ({
    date: str(r['date']),
    device: str(r['device']),
    keyword_key: str(r['keyword_key']),
    campaign_id: str(r['campaign_id']),
    campaign_name: str(r['campaign_name']),
    bidding_strategy_type: str(r['bidding_strategy_type']),
    ad_group_id: str(r['ad_group_id']),
    ad_group_name: str(r['ad_group_name']),
    criterion_id: str(r['criterion_id']),
    keyword: str(r['keyword']),
    match_type: str(r['match_type']),
    keyword_status: str(r['keyword_status']),
    keyword_cpc_bid: num(r['keyword_cpc_bid']),
    impressions: num(r['impressions']),
    clicks: num(r['clicks']),
    cost: num(r['cost']),
    ctr: num(r['ctr']),
    avg_cpc: num(r['avg_cpc']),
    conversions: num(r['conversions']),
    all_conversions: num(r['all_conversions']),
    conversion_value: num(r['conversion_value']),
  }));
}

export function parseSearchTerms(raw: Record<string, unknown>[]): SearchTermRow[] {
  return parseRows<SearchTermRow>(raw, (r) => ({
    date: str(r['date']),
    campaign_id: str(r['campaign_id']),
    campaign_name: str(r['campaign_name']),
    ad_group_id: str(r['ad_group_id']),
    ad_group_name: str(r['ad_group_name']),
    search_term: str(r['search_term']),
    search_term_status: str(r['search_term_status']),
    impressions: num(r['impressions']),
    clicks: num(r['clicks']),
    cost: num(r['cost']),
    ctr: num(r['ctr']),
    avg_cpc: num(r['avg_cpc']),
    conversions: num(r['conversions']),
    all_conversions: num(r['all_conversions']),
    conversion_value: num(r['conversion_value']),
  }));
}

export function parseHourDevice(raw: Record<string, unknown>[]): HourDeviceRow[] {
  return parseRows<HourDeviceRow>(raw, (r) => ({
    date: str(r['date']),
    hour: num(r['hour']),
    device: str(r['device']),
    campaign_id: str(r['campaign_id']),
    campaign_name: str(r['campaign_name']),
    impressions: num(r['impressions']),
    clicks: num(r['clicks']),
    cost: num(r['cost']),
    ctr: num(r['ctr']),
    avg_cpc: num(r['avg_cpc']),
    conversions: num(r['conversions']),
    all_conversions: num(r['all_conversions']),
    conversion_value: num(r['conversion_value']),
  }));
}

export function parsePolicy(raw: Record<string, unknown>[]): PolicyRow[] {
  return parseRows<PolicyRow>(raw, (r) => ({
    campaign_id: str(r['campaign_id']),
    campaign_name: str(r['campaign_name']),
    ad_group_id: str(r['ad_group_id']),
    ad_group_name: str(r['ad_group_name']),
    ad_id: str(r['ad_id']),
    ad_status: str(r['ad_status']),
    approval_status: str(r['approval_status']),
    review_status: str(r['review_status']),
    final_urls: str(r['final_urls']),
  }));
}

export function parseAuctionCampaigns(raw: Record<string, unknown>[]): AuctionCampaignRow[] {
  return parseRows<AuctionCampaignRow>(raw, (r) => ({
    date: str(r['date']),
    campaign_id: str(r['campaign_id']),
    campaign_name: str(r['campaign_name']),
    campaign_status: str(r['campaign_status']),
    serving_status: str(r['serving_status']),
    channel: str(r['channel']),
    bidding_strategy_type: str(r['bidding_strategy_type']),
    impressions: num(r['impressions']),
    clicks: num(r['clicks']),
    cost: num(r['cost']),
    conversions: num(r['conversions']),
    search_impression_share: num(r['search_impression_share']),
    search_rank_lost_impression_share: num(r['search_rank_lost_impression_share']),
    search_budget_lost_impression_share: num(r['search_budget_lost_impression_share']),
    top_impression_percentage: num(r['top_impression_percentage']),
    absolute_top_impression_percentage: num(r['absolute_top_impression_percentage']),
    search_top_impression_share: num(r['search_top_impression_share']),
    search_absolute_top_impression_share: num(r['search_absolute_top_impression_share']),
    bid_signal: str(r['bid_signal']),
  }));
}

export function parseAuctionKeywords(raw: Record<string, unknown>[]): AuctionKeywordRow[] {
  return parseRows<AuctionKeywordRow>(raw, (r) => ({
    date: str(r['date']),
    keyword_key: str(r['keyword_key']),
    campaign_id: str(r['campaign_id']),
    campaign_name: str(r['campaign_name']),
    bidding_strategy_type: str(r['bidding_strategy_type']),
    ad_group_id: str(r['ad_group_id']),
    ad_group_name: str(r['ad_group_name']),
    criterion_id: str(r['criterion_id']),
    keyword: str(r['keyword']),
    match_type: str(r['match_type']),
    keyword_status: str(r['keyword_status']),
    impressions: num(r['impressions']),
    clicks: num(r['clicks']),
    cost: num(r['cost']),
    conversions: num(r['conversions']),
    search_impression_share: num(r['search_impression_share']),
    search_rank_lost_impression_share: num(r['search_rank_lost_impression_share']),
    top_impression_percentage: num(r['top_impression_percentage']),
    absolute_top_impression_percentage: num(r['absolute_top_impression_percentage']),
    search_top_impression_share: num(r['search_top_impression_share']),
    search_absolute_top_impression_share: num(r['search_absolute_top_impression_share']),
    bid_signal: str(r['bid_signal']),
  }));
}

export function parseVoluum(raw: Record<string, unknown>[]): VoluumRow[] {
  return parseRows<VoluumRow>(raw, (r) => ({
    date: str(r['date']),
    keyword_key: str(r['keyword_key']),
    campaign_id: str(r['campaign_id']),
    ad_group_id: str(r['ad_group_id']),
    criterion_id: str(r['criterion_id']),
    voluum_visits: num(r['voluum_visits']),
    voluum_clicks: num(r['voluum_clicks']),
    voluum_conversions: num(r['voluum_conversions']),
    revenue: num(r['revenue']),
    profit: num(r['profit']),
    roi: num(r['roi']),
  }));
}

export function parseSyncLog(raw: Record<string, unknown>[]): GoogleSyncLogRow[] {
  return parseRows<GoogleSyncLogRow>(raw, (r) => ({
    run_id: str(r['run_id']),
    started_at: str(r['started_at']),
    finished_at: str(r['finished_at']),
    status: str(r['status']) as GoogleSyncLogRow['status'],
    duration_seconds: num(r['duration_seconds']),
    trigger_type: str(r['trigger_type']),
    lookback_days: num(r['lookback_days']),
    tabs_updated: num(r['tabs_updated']),
    campaign_rows: num(r['campaign_rows']),
    adgroup_rows: num(r['adgroup_rows']),
    keyword_rows: num(r['keyword_rows']),
    search_term_rows: num(r['search_term_rows']),
    hour_device_rows: num(r['hour_device_rows']),
    policy_rows: num(r['policy_rows']),
    auction_campaign_rows: num(r['auction_campaign_rows']),
    auction_keyword_rows: num(r['auction_keyword_rows']),
    voluum_rows: num(r['voluum_rows']),
    error_message: str(r['error_message']),
    script_version: str(r['script_version']),
  }));
}

export function parseCSV(csvText: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    try {
      const lines = csvText.split(/\r?\n/);
      const nonEmpty = lines.filter((l) => l.trim() !== '');
      if (nonEmpty.length === 0) { resolve([]); return; }

      const headers = splitCSVLine(nonEmpty[0]).map((h) =>
        h.toLowerCase().replace(/\s+/g, '_').trim()
      );

      const rows: Record<string, unknown>[] = [];
      for (let i = 1; i < nonEmpty.length; i++) {
        const values = splitCSVLine(nonEmpty[i]);
        const row: Record<string, unknown> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });
        rows.push(row);
      }
      resolve(rows);
    } catch (e) {
      reject(e);
    }
  });
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export async function parseCSVFromUrl(url: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status} ${res.statusText}`);
  const text = await res.text();
  return parseCSV(text);
}
