import type { ReconciledRecord, GadsAggRow, VoluumAggRow } from './types';
import { findBestMatch } from './fuzzyMatch';

export interface ManualMapping {
  voluum_campaign_name: string;
  gads_campaign_name:   string;
}

export function buildReconciledRecords(
  voluumRows: VoluumAggRow[],
  gadsRows:   GadsAggRow[],
  manualMappings: ManualMapping[] = [],
): ReconciledRecord[] {
  const gadsMap = new Map(gadsRows.map((r) => [r.campaignName.toLowerCase(), r]));
  const gadsNames = gadsRows.map((r) => r.campaignName);

  // Build manual lookup: voluum name → gads name
  const manualMap = new Map(
    manualMappings.map((m) => [m.voluum_campaign_name.toLowerCase(), m.gads_campaign_name])
  );

  const matched = new Set<string>(); // track matched gads campaign names (lowercase)
  const records: ReconciledRecord[] = [];

  for (const v of voluumRows) {
    const vKey = v.campaignName.toLowerCase();

    // 1. Manual mapping takes highest priority
    const manualTarget = manualMap.get(vKey);
    if (manualTarget) {
      const g = gadsMap.get(manualTarget.toLowerCase());
      if (g) {
        matched.add(manualTarget.toLowerCase());
        records.push(buildRecord(v, g, 'manual', 1));
        continue;
      }
    }

    // 2. Exact match
    const exactG = gadsMap.get(vKey);
    if (exactG) {
      matched.add(vKey);
      records.push(buildRecord(v, exactG, 'exact', 1));
      continue;
    }

    // 3. Fuzzy match
    const fuzzy = findBestMatch(v.campaignName, gadsNames);
    if (fuzzy) {
      const g = gadsMap.get(fuzzy.name.toLowerCase())!;
      matched.add(fuzzy.name.toLowerCase());
      records.push(buildRecord(v, g, 'fuzzy', fuzzy.similarity));
      continue;
    }

    // 4. Unmatched Voluum
    records.push(buildRecord(v, null, 'unmatched', 0));
  }

  // Add unmatched Google Ads rows (exist in GAds but not Voluum)
  for (const g of gadsRows) {
    if (!matched.has(g.campaignName.toLowerCase())) {
      records.push(buildRecord(null, g, 'unmatched', 0));
    }
  }

  return records.sort((a, b) => Math.abs(b.click_discrepancy_pct) - Math.abs(a.click_discrepancy_pct));
}

function buildRecord(
  v:    VoluumAggRow | null,
  g:    GadsAggRow  | null,
  type: ReconciledRecord['matchType'],
  conf: number,
): ReconciledRecord {
  const vClicks  = v?.clicks      ?? 0;
  const gClicks  = g?.clicks      ?? 0;
  const maxClk   = Math.max(vClicks, gClicks, 1);
  const vConv    = v?.conversions  ?? 0;
  const gConv    = g?.conversions  ?? 0;
  const gCost    = g?.cost         ?? 0;
  const vRev     = v?.revenue      ?? 0;
  const trueRoi  = gCost > 0 ? ((vRev - gCost) / gCost) * 100 : 0;

  return {
    campaignName:        v?.campaignName ?? g?.campaignName ?? '(unknown)',
    matchType:           type,
    matchConfidence:     conf,
    voluum_visits:       v?.visits       ?? 0,
    voluum_clicks:       vClicks,
    voluum_conversions:  vConv,
    voluum_revenue:      vRev,
    voluum_cost:         v?.cost         ?? 0,
    voluum_roi:          v?.roi          ?? 0,
    gads_clicks:         gClicks,
    gads_impressions:    g?.impressions  ?? 0,
    gads_cost:           gCost,
    gads_conversions:    gConv,
    gads_ctr:            g?.ctr          ?? 0,
    click_discrepancy:     vClicks - gClicks,
    click_discrepancy_pct: ((vClicks - gClicks) / maxClk) * 100,
    conv_discrepancy:      vConv - gConv,
    cost_discrepancy:      (v?.cost ?? 0) - gCost,
    true_roi:              trueRoi,
    attribution_gap:       vConv - gConv,
  };
}

/**
 * Aggregate imported VoluumRow[] by campaign name.
 * Requires a `campaignNameById` map (campaign_id → campaign_name)
 * built from the Google Ads CampaignRow[] import, since VoluumRow
 * carries campaign_id but not campaign_name.
 */
export function aggregateVoluumByCampaign(
  voluum: Array<{ campaign_id?: string; voluum_visits?: number; voluum_clicks?: number; voluum_conversions?: number; revenue?: number; cost?: number }>,
  campaignNameById: Map<string, string>,
): VoluumAggRow[] {
  const map = new Map<string, VoluumAggRow>();
  for (const r of voluum) {
    const name = (r.campaign_id ? (campaignNameById.get(r.campaign_id) ?? r.campaign_id) : '').trim();
    if (!name) continue;
    const p = map.get(name) ?? { campaignName: name, visits: 0, clicks: 0, conversions: 0, revenue: 0, cost: 0, roi: 0 };
    const next = {
      ...p,
      visits:      p.visits      + (r.voluum_visits      ?? 0),
      clicks:      p.clicks      + (r.voluum_clicks      ?? 0),
      conversions: p.conversions + (r.voluum_conversions ?? 0),
      revenue:     p.revenue     + (r.revenue            ?? 0),
      cost:        p.cost        + (r.cost               ?? 0),
    };
    next.roi = next.cost > 0 ? (next.revenue - next.cost) / next.cost : 0;
    map.set(name, next);
  }
  return Array.from(map.values());
}

/** Aggregate live Voluum API rows (NormalizedVoluumRow) by campaign name. */
export function aggregateNormalizedVoluumByCampaign(
  rows: Array<{ campaignName: string; visits: number; clicks: number; conversions: number; revenue: number; cost: number; roi: number }>,
): VoluumAggRow[] {
  const map = new Map<string, VoluumAggRow>();
  for (const r of rows) {
    const name = r.campaignName.trim();
    if (!name) continue;
    const p = map.get(name) ?? { campaignName: name, visits: 0, clicks: 0, conversions: 0, revenue: 0, cost: 0, roi: 0 };
    const next = {
      ...p,
      visits:      p.visits      + r.visits,
      clicks:      p.clicks      + r.clicks,
      conversions: p.conversions + r.conversions,
      revenue:     p.revenue     + r.revenue,
      cost:        p.cost        + r.cost,
    };
    next.roi = next.cost > 0 ? (next.revenue - next.cost) / next.cost : 0;
    map.set(name, next);
  }
  return Array.from(map.values());
}


export function aggregateGadsByCampaign(
  campaigns: Array<{ campaign?: string; campaign_name?: string; clicks?: number; impressions?: number; cost?: number; conversions?: number }>,
): GadsAggRow[] {
  const map = new Map<string, GadsAggRow>();
  for (const r of campaigns) {
    const name = (r.campaign_name ?? r.campaign ?? '').trim();
    if (!name) continue;
    const p = map.get(name) ?? { campaignName: name, clicks: 0, impressions: 0, cost: 0, conversions: 0, convValue: 0, ctr: 0 };
    const next = {
      ...p,
      clicks:      p.clicks      + (r.clicks      ?? 0),
      impressions: p.impressions + (r.impressions  ?? 0),
      cost:        p.cost        + (r.cost         ?? 0),
      conversions: p.conversions + (r.conversions  ?? 0),
    };
    next.ctr = next.impressions > 0 ? next.clicks / next.impressions : 0;
    map.set(name, next);
  }
  return Array.from(map.values());
}
