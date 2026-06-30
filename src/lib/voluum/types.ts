// ─── Raw Voluum API shapes (both flat and nested response variants) ────────────

export interface VoluumRawRow {
  // Flat variant
  campaignId?: string;
  campaignName?: string;
  campaignStatus?: string;
  status?: string;
  archived?: boolean;
  // Nested variant
  campaign?: { id?: string; name?: string; status?: string; archived?: boolean };
  name?: string;
  id?: string;
  // Metrics (always present, but may be null/undefined)
  visits?: number | string | null;
  clicks?: number | string | null;
  conversions?: number | string | null;
  cost?: number | string | null;
  revenue?: number | string | null;
  profit?: number | string | null;
  roi?: number | string | null;
  ctr?: number | string | null;
  cvr?: number | string | null;
  epc?: number | string | null;
  cpa?: number | string | null;
  // Allow extra fields from groupBy variants
  [key: string]: unknown;
}

export interface VoluumRawReport {
  rows?: VoluumRawRow[];
  totals?: VoluumRawRow;
  totalRows?: number;
  credentialsMissing?: boolean;
}

export interface VoluumCampaignMeta {
  id?: string;
  campaignId?: string;
  name?: string;
  campaignName?: string;
  status?: string;
  state?: string;
  archived?: boolean;
  deleted?: boolean;
  campaign?: { id?: string; name?: string; status?: string; archived?: boolean; deleted?: boolean };
  [key: string]: unknown;
}

export interface VoluumCampaignsResponse {
  rows?: VoluumCampaignMeta[];
  campaigns?: VoluumCampaignMeta[];
  items?: VoluumCampaignMeta[];
  data?: VoluumCampaignMeta[];
  totalRows?: number;
  credentialsMissing?: boolean;
}

export type VoluumCampaignStatusFilter = 'active' | 'all';

// ─── Normalized row (safe for UI consumption) ─────────────────────────────────

export interface NormalizedVoluumRow {
  campaignId: string;
  campaignName: string;
  visits: number;
  clicks: number;
  conversions: number;
  cost: number;
  revenue: number;
  profit: number;
  /** Decimal. 1.0 = 100% ROI. */
  roi: number;
  /** Decimal. 0.5 = 50% CTR. */
  ctr: number;
  /** Decimal. 0.05 = 5% CVR. */
  cvr: number;
  /** Earnings per click. */
  epc: number;
  /** Cost per acquisition. 0 when no conversions. */
  cpa: number;
  dateRange: string;
  source: 'voluum' | 'voluum-mock';
}

export interface VoluumTotals {
  visits: number;
  clicks: number;
  conversions: number;
  cost: number;
  revenue: number;
  profit: number;
  roi: number;
  ctr: number;
  cvr: number;
  epc: number;
  cpa: number;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export interface VoluumHealth {
  connected: boolean;
  credentialsMissing: boolean;
  tokenExpiresAt: string | null;
  lastCheckedAt: string;
  error?: string;
}

// ─── Recommendations ──────────────────────────────────────────────────────────

export type RecommendationAction = 'SCALE' | 'WATCH' | 'CUT' | 'INVESTIGATE';
export type RecommendationConfidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type RecommendationEntityType = 'campaign' | 'keyword' | 'placement' | 'device' | 'geo';

export interface VoluumRecommendation {
  action: RecommendationAction;
  entityType: RecommendationEntityType;
  entityName: string;
  reason: string;
  confidence: RecommendationConfidence;
  metrics: {
    visits: number;
    clicks: number;
    conversions: number;
    cost: number;
    revenue: number;
    profit: number;
    roi: number;
    cvr: number;
  };
}

// ─── Query params ─────────────────────────────────────────────────────────────

export type GroupBy =
  | 'campaign'
  | 'offer'
  | 'landingPage'
  | 'country'
  | 'device'
  | 'keyword'
  | 'customVariable';

export interface ReportParams {
  from: string;
  to: string;
  tz?: string;
  groupBy?: GroupBy;
  campaignName?: string;
  limit?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
}

// ─── Google Ads matching helper ───────────────────────────────────────────────

export interface VoluumGoogleMatchCandidate {
  voluumCampaignId: string;
  voluumCampaignName: string;
  googleCampaignName?: string;
  matchMethod: 'exact' | 'contains' | 'normalized' | 'none';
  confidence: number; // 0–1
}
