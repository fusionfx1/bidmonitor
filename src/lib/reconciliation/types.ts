import type { MatchType } from './fuzzyMatch';

export type { MatchType };

export interface ReconciledRecord {
  campaignName:            string;
  matchType:               MatchType;
  matchConfidence:         number; // 0–1

  // Voluum
  voluum_visits:       number;
  voluum_clicks:       number;
  voluum_conversions:  number;
  voluum_revenue:      number;
  voluum_cost:         number;
  voluum_roi:          number;

  // Google Ads
  gads_clicks:       number;
  gads_impressions:  number;
  gads_cost:         number;
  gads_conversions:  number;
  gads_ctr:          number;

  // Derived
  click_discrepancy:     number; // voluum_clicks - gads_clicks
  click_discrepancy_pct: number; // |diff| / max * 100
  conv_discrepancy:      number;
  cost_discrepancy:      number;
  true_roi:              number; // (voluum_revenue - gads_cost) / gads_cost * 100
  attribution_gap:       number; // voluum_conversions - gads_conversions
}

export type DiscrepancyLevel = 'low' | 'medium' | 'high';

export function discrepancyLevel(pct: number): DiscrepancyLevel {
  const abs = Math.abs(pct);
  if (abs < 5)  return 'low';
  if (abs < 15) return 'medium';
  return 'high';
}

export interface GadsAggRow {
  campaignName: string;
  clicks:       number;
  impressions:  number;
  cost:         number;
  conversions:  number;
  convValue:    number;
  ctr:          number;
}

export interface VoluumAggRow {
  campaignName: string;
  visits:       number;
  clicks:       number;
  conversions:  number;
  revenue:      number;
  cost:         number;
  roi:          number;
}
