import type {
  NormalizedVoluumRow, RecommendationAction, RecommendationConfidence, VoluumRecommendation,
} from './types';

// Configurable thresholds — edit here to tune recommendation sensitivity.
export const THRESHOLDS = {
  minSpendCut:          10,    // Min $ spend before considering CUT
  minClicksCut:         10,    // Min clicks before considering CUT
  negativeRoiCut:      -0.30,  // ROI below this → CUT
  minConversionsScale:  1,     // Min conversions before SCALE
  goodRoiScale:         0.50,  // ROI above this → SCALE
  minClicksInvestigate: 50,    // Clicks above this with no CVR → INVESTIGATE
  lowCvrThreshold:      0.02,  // CVR below this → INVESTIGATE
} as const;

interface RecResult {
  action: RecommendationAction;
  reason: string;
  confidence: RecommendationConfidence;
}

export function getRecommendation(row: NormalizedVoluumRow): RecResult {
  const { cost, clicks, conversions, roi, cvr, profit } = row;

  // CUT: money spent, zero return
  if (cost >= THRESHOLDS.minSpendCut && conversions === 0) {
    return { action: 'CUT', reason: 'Spend with zero conversions', confidence: 'HIGH' };
  }

  // CUT: significant data, strongly negative ROI
  if (
    cost >= THRESHOLDS.minSpendCut &&
    clicks >= THRESHOLDS.minClicksCut &&
    roi < THRESHOLDS.negativeRoiCut
  ) {
    return {
      action: 'CUT',
      reason: `Negative ROI (${(roi * 100).toFixed(1)}%)`,
      confidence: roi < -0.5 ? 'HIGH' : 'MEDIUM',
    };
  }

  // SCALE: profitable with healthy ROI
  if (
    conversions >= THRESHOLDS.minConversionsScale &&
    roi >= THRESHOLDS.goodRoiScale &&
    profit > 0
  ) {
    return {
      action: 'SCALE',
      reason: `ROI ${(roi * 100).toFixed(1)}% · ${conversions} conversions`,
      confidence: roi >= 1.0 ? 'HIGH' : 'MEDIUM',
    };
  }

  // INVESTIGATE: high click volume but no conversions
  if (
    clicks >= THRESHOLDS.minClicksInvestigate &&
    cvr < THRESHOLDS.lowCvrThreshold &&
    conversions === 0
  ) {
    return {
      action: 'INVESTIGATE',
      reason: `${clicks} clicks, CVR ${(cvr * 100).toFixed(2)}% — check landing page`,
      confidence: 'MEDIUM',
    };
  }

  // WATCH: not enough signal yet
  return { action: 'WATCH', reason: 'Insufficient data to decide', confidence: 'LOW' };
}

export function buildRecommendations(
  rows: NormalizedVoluumRow[],
  opts: { minSpend?: number; minClicks?: number; minConversions?: number } = {}
): VoluumRecommendation[] {
  const minSpend       = opts.minSpend       ?? THRESHOLDS.minSpendCut;
  const minClicks      = opts.minClicks      ?? THRESHOLDS.minClicksCut;
  const minConversions = opts.minConversions ?? 0;

  return rows
    .filter((r) => r.cost >= minSpend && r.clicks >= minClicks && r.conversions >= minConversions)
    .map((r) => {
      const rec = getRecommendation(r);
      return {
        action:     rec.action,
        entityType: 'campaign' as const,
        entityName: r.campaignName,
        reason:     rec.reason,
        confidence: rec.confidence,
        metrics: {
          visits:      r.visits,
          clicks:      r.clicks,
          conversions: r.conversions,
          cost:        r.cost,
          revenue:     r.revenue,
          profit:      r.profit,
          roi:         r.roi,
          cvr:         r.cvr,
        },
      };
    });
}
