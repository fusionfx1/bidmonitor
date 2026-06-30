// ─── Raw Data Row Types ──────────────────────────────────────────────────────

export interface CampaignRow {
  account_id?: string;
  customer_id?: string;
  source_sheet_id?: string;
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
  account_id?: string;
  customer_id?: string;
  source_sheet_id?: string;
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
  account_id?: string;
  customer_id?: string;
  source_sheet_id?: string;
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
  account_id?: string;
  customer_id?: string;
  source_sheet_id?: string;
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
  account_id?: string;
  customer_id?: string;
  source_sheet_id?: string;
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
  account_id?: string;
  customer_id?: string;
  source_sheet_id?: string;
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
  account_id?: string;
  customer_id?: string;
  source_sheet_id?: string;
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
  account_id?: string;
  customer_id?: string;
  source_sheet_id?: string;
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
  account_id?: string;
  customer_id?: string;
  source_sheet_id?: string;
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
  account_id?: string;
  customer_id?: string;
  source_sheet_id?: string;
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

export interface PmaxPerformanceRow {
  account_id?: string;
  customer_id?: string;
  source_sheet_id?: string;
  date: string;
  campaign_id: string;
  campaign_name: string;
  asset_group_id: string;
  asset_group_name: string;
  asset_id: string;
  asset_type: string;
  listing_group_filter: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversion_value: number;
  asset_signal: string;
  review_status: ApprovalStatus;
}

export interface GeoPerformanceRow {
  account_id?: string;
  customer_id?: string;
  source_sheet_id?: string;
  date: string;
  campaign_id: string;
  campaign_name: string;
  country_criterion_id: string;
  country_code: string;
  region: string;
  city: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversion_value: number;
  profit: number;
  roi: number;
  geo_signal: string;
  review_status: ApprovalStatus;
}

export interface PlacementPerformanceRow {
  account_id?: string;
  customer_id?: string;
  source_sheet_id?: string;
  date: string;
  campaign_id: string;
  campaign_name: string;
  ad_group_id: string;
  ad_group_name: string;
  placement: string;
  placement_type: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversion_value: number;
  profit: number;
  placement_signal: string;
  review_status: ApprovalStatus;
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

export type ActionMode = 'disabled' | 'review_only' | 'dry_run' | 'manual_apply';
export type SheetAutoRefresh = 'off' | '15min' | '1hour';
export type VoluumConversionMetric = 'conversions' | 'revenue_conversions';
export type VoluumMatchMode = 'auto' | 'strict' | 'all';

export type BidActionEntityLevel = 'campaign';
export type BidActionFeedAction = 'SET_BUDGET' | 'PAUSE_CAMPAIGN' | 'ENABLE_CAMPAIGN' | 'SET_CAMPAIGN_LABEL';
export type BidActionFeedMode = 'dry_run';
export type BidActionFeedStatus = 'ready' | 'applied' | 'failed' | 'skipped' | 'stale';

export interface AutoBidGuardrails {
  minBid: number;
  maxBid: number;
  maxChangePercent: number;
  minBudget: number;
  maxBudget: number;
  maxBudgetChangePercent: number;
  allowSharedBudget: boolean;
  maxChangesPerRun: number;
  dryRun: boolean;
  applyEnabled: boolean;
}

export interface AccountSource {
  id: string;
  account_id: string;
  customer_id: string;
  account_name: string;
  spreadsheet_id: string;
  spreadsheet_url: string;
  sheet_tab_name: string;
  timezone: string;
  currency: string;
  enabled: boolean;
}

export interface BidActionFeedRow {
  id: string;
  account_id: string;
  customer_id: string;
  source_sheet_id: string;
  entity_level: BidActionEntityLevel;
  keyword_key: string | null;
  campaign_id: string;
  ad_group_id: string | null;
  criterion_id: string | null;
  campaign_name: string | null;
  ad_group_name: string | null;
  keyword: string | null;
  match_type: string | null;
  action: BidActionFeedAction;
  expected_current_bid: number | null;
  target_bid: number | null;
  expected_current_budget: number | null;
  target_budget: number | null;
  budget_is_shared: boolean | null;
  reason: string | null;
  mode: BidActionFeedMode;
  status: BidActionFeedStatus;
  created_at: string | null;
  picked_at: string | null;
  applied_at: string | null;
}

export type BidActionLogResult =
  | 'applied'
  | 'dry_run'
  | 'failed'
  | 'skipped'
  | 'skipped_smart_bidding'
  | 'skipped_bid_changed'
  | 'skipped_budget_changed'
  | 'skipped_shared_budget'
  | 'skipped_max_changes'
  | 'stale'
  | 'not_found'
  | 'error';

export interface BidActionLogRow {
  id: string;
  feed_id: string | null;
  account_id: string;
  customer_id: string;
  source_sheet_id: string;
  entity_level: BidActionEntityLevel | null;
  keyword_key: string | null;
  campaign_id: string | null;
  action: BidActionFeedAction | null;
  mode: BidActionFeedMode | null;
  old_value: number | null;
  new_value: number | null;
  result: BidActionLogResult;
  message: string | null;
  script_version: string | null;
  created_at: string | null;
}

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
  auto_bid_guardrails: AutoBidGuardrails;
  account_sources: AccountSource[];
  selected_account_source_id: string;
  account_id: string;
  customer_id: string;
  sheet_id: string;
  sheet_auto_refresh: SheetAutoRefresh;
  voluum_campaign_filter: string;
  voluum_conversion_metric: VoluumConversionMetric;
  voluum_match_mode: VoluumMatchMode;
}

export const DEFAULT_AUTO_BID_GUARDRAILS: AutoBidGuardrails = {
  minBid: 0.01,
  maxBid: 2.0,
  maxChangePercent: 25,
  minBudget: 1,
  maxBudget: 200,
  maxBudgetChangePercent: 30,
  allowSharedBudget: false,
  maxChangesPerRun: 50,
  dryRun: true,
  applyEnabled: false,
};

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
  auto_bid_guardrails: { ...DEFAULT_AUTO_BID_GUARDRAILS },
  account_sources: [],
  selected_account_source_id: '',
  account_id: '',
  customer_id: '',
  sheet_id: '',
  sheet_auto_refresh: 'off',
  voluum_campaign_filter: '',
  voluum_conversion_metric: 'conversions',
  voluum_match_mode: 'auto',
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
  pmaxPerformance?: PmaxPerformanceRow[];
  geoPerformance?: GeoPerformanceRow[];
  placementPerformance?: PlacementPerformanceRow[];
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
  | 'pmaxPerformance'
  | 'geoPerformance'
  | 'placementPerformance'
  | 'voluum'
  | 'syncLog';

// ─── KPIs ────────────────────────────────────────────────────────────────────

export interface KpiCard {
  label: string;
  value: string;
  change?: string;
  tone?: 'green' | 'red' | 'gray' | 'amber';
}
