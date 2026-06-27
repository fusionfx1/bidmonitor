import type { DataTableKey } from '../../types';

export const REQUIRED_COLUMNS: Record<DataTableKey, string[]> = {
  campaigns: [
    'date','campaign_id','campaign_name','campaign_status','serving_status',
    'channel','bidding_strategy_type','daily_budget','impressions','clicks',
    'cost','ctr','avg_cpc','conversions','conversion_value',
  ],
  adGroups: [
    'date','campaign_id','campaign_name','bidding_strategy_type','ad_group_id',
    'ad_group_name','ad_group_status','impressions','clicks','cost','conversions',
  ],
  keywords: [
    'date','keyword_key','campaign_id','campaign_name','bidding_strategy_type',
    'ad_group_id','ad_group_name','criterion_id','keyword','match_type',
    'keyword_status','keyword_cpc_bid','impressions','clicks','cost','conversions',
  ],
  searchTerms: [
    'date','campaign_id','campaign_name','ad_group_id','ad_group_name',
    'search_term','impressions','clicks','cost','conversions',
  ],
  hourDevice: [
    'date','hour','device','campaign_id','campaign_name',
    'impressions','clicks','cost','conversions',
  ],
  policy: [
    'campaign_id','campaign_name','ad_group_id','ad_group_name',
    'ad_id','ad_status','approval_status','review_status','final_urls',
  ],
  auctionCampaigns: [
    'date','campaign_id','campaign_name','bidding_strategy_type',
    'impressions','clicks','cost','conversions','search_impression_share',
    'search_rank_lost_impression_share',
  ],
  auctionKeywords: [
    'date','keyword_key','campaign_id','campaign_name','bidding_strategy_type',
    'ad_group_id','ad_group_name','criterion_id','keyword','match_type',
    'keyword_status','impressions','clicks','cost','conversions',
    'search_impression_share','search_rank_lost_impression_share',
  ],
  voluum: [
    'date','keyword_key','campaign_id','ad_group_id','criterion_id',
    'voluum_visits','voluum_conversions','revenue','profit',
  ],
  syncLog: [
    'run_id','started_at','status',
  ],
};

export interface ValidationResult {
  valid: boolean;
  missingColumns: string[];
  presentColumns: string[];
}

export function validateHeaders(
  rows: Record<string, unknown>[],
  tableKey: DataTableKey
): ValidationResult {
  if (!rows.length) return { valid: false, missingColumns: [], presentColumns: [] };
  const presentColumns = Object.keys(rows[0]).map((k) => k.toLowerCase());
  const required = REQUIRED_COLUMNS[tableKey];
  const missingColumns = required.filter((col) => !presentColumns.includes(col));
  return {
    valid: missingColumns.length === 0,
    missingColumns,
    presentColumns,
  };
}
