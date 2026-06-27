// ─── Raw Data Row Types ──────────────────────────────────────────────────────

export interface CampaignRow {
  date: string;
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
  serving_status: string;
  channel: string;
  bidding_strategy_type: string;
  campaign_start_date: string;
  campaign_end_date: string;
  daily_budget: number;
  impressions: number;
  clicks: number;
  cost: number;
  ctr: number;
  avg_cpc: number;
  conversions: number;
  all_conversions: number;
  conversion_value: number;
}

export interface AdGroupRow {
  date: string;
  campaign_id: string;
  campaign_name: string;
  bidding_strategy_type: string;
  ad_group_id: string;
  ad_group_name: string;
  ad_group_status: string;
  ad_group_cpc_bid: number;
  impressions: number;
  clicks: number;
  cost: number;
  ctr: number;
  avg_cpc: number;
  conversions: number;
  all_conversions: number;
  conversion_value: number;
}

export interface KeywordRow {
  date: string;
  device: string;
  keyword_key: string;
  campaign_id: string;
  campaign_name: string;
  bidding_strategy_type: string;
  ad_group_id: string;
  ad_group_name: string;
  criterion_id: string;
  keyword: string;
  match_type: string;
  keyword_status: string;
  keyword_cpc_bid: number;
  impressions: number;
  clicks: number;
  cost: number;
  ctr: number;
  avg_cpc: number;
  conversions: number;
  all_conversions: number;
  conversion_value: number;
}

export interface SearchTermRow {
  date: string;
  campaign_id: string;
  campaign_name: string;
  ad_group_id: string;
  ad_group_name: string;
  search_term: string;
  search_term_status: string;
  impressions: number;
  clicks: number;
  cost: number;
  ctr: number;
  avg_cpc: number;
  conversions: number;
  all_conversions: number;
  conversion_value: number;
}

export interface HourDeviceRow {
  date: string;
  hour: number;
  device: string;
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  cost: number;
  ctr: number;
  avg_cpc: number;
  conversions: number;
  all_conversions: number;
  conversion_value: number;
}

export interface PolicyRow {
  campaign_id: string;
  campaign_name: string;
  ad_group_id: string;
  ad_group_name: string;
  ad_id: string;
  ad_status: string;
  approval_status: string;
  review_status: string;
  final_urls: string;
}

export interface AuctionCampaignRow {
  date: string;
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
  serving_status: string;
  channel: string;
  bidding_strategy_type: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  search_impression_share: number;
  search_rank_lost_impression_share: number;
  search_budget_lost_impression_share: number;
  top_impression_percentage: number;
  absolute_top_impression_percentage: number;
  search_top_impression_share: number;
  search_absolute_top_impression_share: number;
  bid_signal: string;
}

export interface AuctionKeywordRow {
  date: string;
  keyword_key: string;
  campaign_id: string;
  campaign_name: string;
  bidding_strategy_type: string;
  ad_group_id: string;
  ad_group_name: string;
  criterion_id: string;
  keyword: string;
  match_type: string;
  keyword_status: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  search_impression_share: number;
  search_rank_lost_impression_share: number;
  top_impression_percentage: number;
  absolute_top_impression_percentage: number;
  search_top_impression_share: number;
  search_absolute_top_impression_share: number;
  bid_signal: string;
}

export interface VoluumRow {
  date: string;
  keyword_key: string;
  campaign_id: string;
  ad_group_id: string;
  criterion_id: string;
  voluum_visits: number;
  voluum_clicks: number;
  voluum_conversions: number;
  revenue: number;
  profit: number;
  roi: number;
}

export type SyncLogStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface GoogleSyncLogRow {
  run_id: string;
  started_at: string;
  finished_at: string;
  status: SyncLogStatus;
  duration_seconds: number;
  trigger_type: string;
  lookback_days: number;
  tabs_updated: number;
  campaign_rows: number;
  adgroup_rows: number;
  keyword_rows: number;
  search_term_rows: number;
  hour_device_rows: number;
  policy_rows: number;
  auction_campaign_rows: number;
  auction_keyword_rows: number;
  voluum_rows: number;
  error_message: string;
  script_version: string;
}

// ─── Derived / Computed Types ────────────────────────────────────────────────

export type BidAction =
  | 'HOLD'
  | 'INCREASE_BID'
  | 'DECREASE_BID'
  | 'PAUSE_CANDIDATE'
  | 'INCREASE_BUDGET_CANDIDATE';

export type ApprovalStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'WATCHLIST';

export interface BidDecision {
  keyword_key: string;
  campaign: string;
  ad_group: string;
  keyword: string;
  match_type: string;
  current_bid: number;
  recommended_bid: number | null;
  cost: number;
  clicks: number;
  google_conversions: number;
  voluum_conversions: number;
  used_conversions: number;
  revenue: number;
  profit: number;
  roi: number;
  cpa: number;
  search_impression_share: number;
  rank_lost: number;
  absolute_top_rate: number;
  bid_signal: string;
  action: BidAction;
  reason: string;
  approval_status: ApprovalStatus;
}

export type NegativeType = 'NEGATIVE_PHRASE_CANDIDATE' | 'NEGATIVE_EXACT_CANDIDATE';

export interface NegativeCandidate {
  search_term: string;
  campaign: string;
  ad_group: string;
  clicks: number;
  cost: number;
  conversions: number;
  negative_type: NegativeType;
  reason: string;
  approval_status: ApprovalStatus;
}

export type AuctionSignalLabel =
  | 'WINNER_RANK_LIMITED'
  | 'WINNER_BUDGET_LIMITED'
  | 'HIGH_POSITION_NO_CONV_REDUCE_BID_CANDIDATE'
  | 'LOW_IS_RANK_LOST'
  | 'LOW_IS_BUDGET_LOST'
  | 'NO_CONV_RANK_LOST_DO_NOT_SCALE'
  | 'HOLD_REVIEW';

export interface AuctionSignalRow {
  type: 'campaign' | 'keyword';
  id: string;
  name: string;
  campaign_name: string;
  search_impression_share: number;
  rank_lost: number;
  budget_lost: number;
  top_impression_pct: number;
  abs_top_impression_pct: number;
  top_is: number;
  abs_top_is: number;
  bid_signal: string;
  conversions: number;
  label: AuctionSignalLabel;
  description: string;
}

export type PolicyIssueLevel = 'CRITICAL' | 'WARNING' | 'INFO';

export interface PolicyIssue {
  campaign: string;
  ad_group: string;
  ad_id: string;
  ad_status: string;
  approval_status: string;
  review_status: string;
  final_urls: string;
  issue_level: PolicyIssueLevel;
  recommended_fix: string;
}

export type VoluumMismatchFlag =
  | 'TRACKING_MISMATCH'
  | 'LOW_VISIT_CAPTURE'
  | 'CONVERSION_MISMATCH'
  | 'NO_VOLUUM_DATA'
  | 'OK';

export interface VoluumMismatchRow {
  campaign_id: string;
  keyword_key: string;
  google_clicks: number;
  voluum_visits: number;
  google_conversions: number;
  voluum_conversions: number;
  google_cost: number;
  voluum_revenue: number;
  voluum_profit: number;
  flag: VoluumMismatchFlag;
  description: string;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export type ActionMode = 'review_only' | 'semi_auto_ready' | 'disabled';
export type SheetAutoRefresh = 'off' | '15min' | '1hour';

export interface Settings {
  payout: number;
  target_cpa: number;
  min_clicks: number;
  min_cost_to_decide: number;
  max_bid: number;
  min_bid: number;
  bid_increase_percent: number;
  bid_decrease_percent: number;
  conversion_delay_hours: number;
  max_daily_loss: number;
  currency: string;
  action_mode: ActionMode;
  sheet_id: string;
  sheet_auto_refresh: SheetAutoRefresh;
}

export const DEFAULT_SETTINGS: Settings = {
  payout: 35,
  target_cpa: 25,
  min_clicks: 30,
  min_cost_to_decide: 25,
  min_bid: 0.01,
  max_bid: 2.0,
  bid_increase_percent: 10,
  bid_decrease_percent: 20,
  conversion_delay_hours: 3,
  max_daily_loss: 100,
  currency: 'THB',
  action_mode: 'review_only',
  sheet_id: '',
  sheet_auto_refresh: 'off',
};

// ─── Google Sheet Sync ───────────────────────────────────────────────────────

export interface TabSyncResult {
  key: DataTableKey;
  tabName: string;
  label: string;
  optional?: boolean;
  status: 'synced' | 'missing' | 'error' | 'idle' | 'private';
  rows?: number;
  error?: string;
}

export interface SyncState {
  running: boolean;
  lastAt: string | null;
  results: TabSyncResult[];
  /** Set when the sheet itself is inaccessible (private / wrong ID) */
  sheetError?: string;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export interface TableMeta {
  rows: number;
  importedAt: string;
  source: string;
}

export interface ImportedData {
  campaigns: CampaignRow[];
  adGroups: AdGroupRow[];
  keywords: KeywordRow[];
  searchTerms: SearchTermRow[];
  hourDevice: HourDeviceRow[];
  policy: PolicyRow[];
  auctionCampaigns: AuctionCampaignRow[];
  auctionKeywords: AuctionKeywordRow[];
  voluum: VoluumRow[];
  syncLog: GoogleSyncLogRow[];
  meta: Partial<Record<DataTableKey, TableMeta>>;
}

export type DataTableKey =
  | 'campaigns'
  | 'adGroups'
  | 'keywords'
  | 'searchTerms'
  | 'hourDevice'
  | 'policy'
  | 'auctionCampaigns'
  | 'auctionKeywords'
  | 'voluum'
  | 'syncLog';

// ─── KPIs ────────────────────────────────────────────────────────────────────

export interface OverviewKPIs {
  totalSpend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  avgCpc: number;
  googleConversions: number;
  voluumConversions: number;
  revenue: number;
  profit: number;
  roi: number;
  cpa: number;
  policyIssuesCount: number;
  bidActionsPending: number;
  negativeCandidatesCount: number;
  campaignsRankLost: number;
  campaignsBudgetLost: number;
}
