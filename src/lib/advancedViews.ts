import type {
  CampaignRow,
  GeoPerformanceRow,
  ImportedData,
  PlacementPerformanceRow,
  PmaxPerformanceRow,
  Settings,
} from '../types';
import { computeSyncHealth } from './syncHealth';

export type AdvancedBucket = 'Profitable' | 'Costly' | 'Zero Conv' | 'Low Data' | 'Watch';
export type CandidateKind = 'GEO_EXCLUSION_CANDIDATE' | 'PLACEMENT_EXCLUSION_CANDIDATE' | 'BUDGET_ALLOCATION_REVIEW';

export interface AllocationRow {
  id: string;
  accountId: string;
  campaign: string;
  channel: string;
  cost: number;
  conversions: number;
  value: number;
  profit: number;
  cpa: number | null;
  roi: number | null;
  spendShare: number;
}

export interface SegmentPerformanceRow {
  id: string;
  type: 'geo' | 'placement';
  label: string;
  campaign: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  value: number;
  profit: number;
  cpa: number | null;
  roi: number | null;
  bucket: AdvancedBucket;
  reviewStatus: string;
  proposalOnly: true;
  remoteApplyAllowed: false;
  signal: string;
}

export interface TreemapRow {
  id: string;
  level: 'campaign' | 'keyword' | 'search_term' | 'pmax_asset';
  label: string;
  parent: string;
  cost: number;
  conversions: number;
  value: number;
  profit: number;
  share: number;
  bucket: AdvancedBucket;
}

export interface AdvancedProposal {
  id: string;
  kind: CandidateKind;
  entity: string;
  campaign: string;
  cost: number;
  reason: string;
  proposalOnly: true;
  remoteApplyAllowed: false;
}

export interface AdvancedViewsModel {
  allocation: AllocationRow[];
  geo: SegmentPerformanceRow[];
  placements: SegmentPerformanceRow[];
  treemap: TreemapRow[];
  pmaxAssets: TreemapRow[];
  proposals: AdvancedProposal[];
  summary: {
    totalCost: number;
    totalProfit: number;
    geoRows: number;
    placementRows: number;
    proposalOnlyCandidates: number;
    staleFailClosed: boolean;
  };
}

type Totals = {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  value: number;
  profit?: number;
};

export function buildAdvancedViews(data: ImportedData, settings: Settings): AdvancedViewsModel {
  const allocation = buildAllocation(data.campaigns);
  const geo = (data.geoPerformance ?? []).map((row) => segmentFromGeo(row, settings)).sort(byCost);
  const placements = (data.placementPerformance ?? []).map((row) => segmentFromPlacement(row, settings)).sort(byCost);
  const treemap = buildTreemap(data, settings);
  const pmaxAssets = buildPmaxAssets(data.pmaxPerformance ?? [], settings);
  const proposals = buildProposals(geo, placements, allocation, settings);
  const totalCost = allocation.reduce((sum, row) => sum + row.cost, 0);
  const totalProfit = allocation.reduce((sum, row) => sum + row.profit, 0);
  const freshness = computeSyncHealth(data.syncLog).freshnessStatus;

  return {
    allocation,
    geo,
    placements,
    treemap,
    pmaxAssets,
    proposals,
    summary: {
      totalCost,
      totalProfit,
      geoRows: geo.length,
      placementRows: placements.length,
      proposalOnlyCandidates: proposals.length,
      staleFailClosed: freshness === 'STALE' || freshness === 'ERROR',
    },
  };
}

function buildAllocation(rows: CampaignRow[]): AllocationRow[] {
  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);
  const groups = groupRows(rows, (row) => row.campaign_id || row.campaign_name);
  return [...groups.entries()].map(([id, group]) => {
    const totals = totalsFrom(group);
    const first = group[0];
    const profit = totals.value - totals.cost;
    const cpa = totals.conversions > 0 ? totals.cost / totals.conversions : null;
    const roi = totals.cost > 0 ? (profit / totals.cost) * 100 : null;
    return {
      id,
      accountId: first?.account_id ?? 'missing',
      campaign: first?.campaign_name ?? id,
      channel: first?.channel ?? 'UNKNOWN',
      cost: totals.cost,
      conversions: totals.conversions,
      value: totals.value,
      profit,
      cpa,
      roi,
      spendShare: totalCost > 0 ? totals.cost / totalCost : 0,
    };
  }).sort((a, b) => b.cost - a.cost);
}

function segmentFromGeo(row: GeoPerformanceRow, settings: Settings): SegmentPerformanceRow {
  const label = [row.country_code, row.region, row.city].filter(Boolean).join(' / ') || row.country_criterion_id;
  return segment({
    id: `geo:${row.campaign_id}:${label}`,
    type: 'geo',
    label,
    campaign: row.campaign_name,
    totals: {
      impressions: row.impressions,
      clicks: row.clicks,
      cost: row.cost,
      conversions: row.conversions,
      value: row.conversion_value,
      profit: row.profit,
    },
    signal: row.geo_signal,
    reviewStatus: row.review_status,
    settings,
  });
}

function segmentFromPlacement(row: PlacementPerformanceRow, settings: Settings): SegmentPerformanceRow {
  return segment({
    id: `placement:${row.campaign_id}:${row.placement}`,
    type: 'placement',
    label: `${row.placement_type}: ${row.placement}`,
    campaign: row.campaign_name,
    totals: {
      impressions: row.impressions,
      clicks: row.clicks,
      cost: row.cost,
      conversions: row.conversions,
      value: row.conversion_value,
      profit: row.profit,
    },
    signal: row.placement_signal,
    reviewStatus: row.review_status,
    settings,
  });
}

function segment(input: {
  id: string;
  type: 'geo' | 'placement';
  label: string;
  campaign: string;
  totals: Totals;
  signal: string;
  reviewStatus: string;
  settings: Settings;
}): SegmentPerformanceRow {
  const profit = input.totals.profit ?? input.totals.value - input.totals.cost;
  const cpa = input.totals.conversions > 0 ? input.totals.cost / input.totals.conversions : null;
  const roi = input.totals.cost > 0 ? (profit / input.totals.cost) * 100 : null;
  return {
    id: input.id,
    type: input.type,
    label: input.label,
    campaign: input.campaign,
    impressions: input.totals.impressions,
    clicks: input.totals.clicks,
    cost: input.totals.cost,
    conversions: input.totals.conversions,
    value: input.totals.value,
    profit,
    cpa,
    roi,
    bucket: bucketFor({ ...input.totals, profit }, input.settings),
    reviewStatus: input.reviewStatus,
    proposalOnly: true,
    remoteApplyAllowed: false,
    signal: input.signal,
  };
}

function buildTreemap(data: ImportedData, settings: Settings): TreemapRow[] {
  const campaignRows = aggregateTreemap(data.campaigns, 'campaign', (row) => row.campaign_id, (row) => row.campaign_name, () => 'MCC', settings);
  const keywordRows = aggregateTreemap(data.keywords, 'keyword', (row) => row.keyword_key, (row) => row.keyword, (row) => row.campaign_name, settings);
  const searchRows = aggregateTreemap(data.searchTerms, 'search_term', (row) => `${row.campaign_id}:${row.search_term}`, (row) => row.search_term, (row) => row.campaign_name, settings);
  return [...campaignRows, ...keywordRows, ...searchRows].sort((a, b) => b.cost - a.cost).slice(0, 150);
}

function buildPmaxAssets(rows: PmaxPerformanceRow[], settings: Settings): TreemapRow[] {
  return aggregateTreemap(
    rows,
    'pmax_asset',
    (row) => row.asset_id || `${row.campaign_id}:${row.asset_group_id}:${row.asset_type}`,
    (row) => `${row.asset_type}: ${row.asset_group_name || row.listing_group_filter || row.asset_id}`,
    (row) => row.campaign_name,
    settings
  ).sort((a, b) => b.cost - a.cost);
}

function aggregateTreemap<T extends { cost: number; conversions: number; conversion_value: number; impressions?: number; clicks?: number }>(
  rows: T[],
  level: TreemapRow['level'],
  idFor: (row: T) => string,
  labelFor: (row: T) => string,
  parentFor: (row: T) => string,
  settings: Settings
): TreemapRow[] {
  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);
  const groups = groupRows(rows, idFor);
  return [...groups.entries()].map(([id, group]) => {
    const totals = totalsFrom(group);
    const first = group[0];
    const profit = totals.value - totals.cost;
    return {
      id: `${level}:${id}`,
      level,
      label: first ? labelFor(first) : id,
      parent: first ? parentFor(first) : '',
      cost: totals.cost,
      conversions: totals.conversions,
      value: totals.value,
      profit,
      share: totalCost > 0 ? totals.cost / totalCost : 0,
      bucket: bucketFor({ ...totals, profit }, settings),
    };
  });
}

function buildProposals(
  geo: SegmentPerformanceRow[],
  placements: SegmentPerformanceRow[],
  allocation: AllocationRow[],
  settings: Settings
): AdvancedProposal[] {
  const geoProposals = geo
    .filter((row) => row.cost >= settings.min_cost_to_decide && row.conversions === 0)
    .map((row) => proposal('GEO_EXCLUSION_CANDIDATE', row.label, row.campaign, row.cost, 'Geo segment has spend above threshold with zero conversions.'));
  const placementProposals = placements
    .filter((row) => row.cost >= settings.min_cost_to_decide && row.conversions === 0)
    .map((row) => proposal('PLACEMENT_EXCLUSION_CANDIDATE', row.label, row.campaign, row.cost, 'Placement has spend above threshold with zero conversions.'));
  const allocationProposals = allocation
    .filter((row) => row.spendShare >= 0.25 && row.profit < 0)
    .map((row) => proposal('BUDGET_ALLOCATION_REVIEW', row.campaign, row.campaign, row.cost, 'Campaign consumes high spend share while profit is negative; review allocation only.'));
  return [...geoProposals, ...placementProposals, ...allocationProposals].sort((a, b) => b.cost - a.cost);
}

function proposal(kind: CandidateKind, entity: string, campaign: string, cost: number, reason: string): AdvancedProposal {
  return {
    id: `${kind}:${campaign}:${entity}`,
    kind,
    entity,
    campaign,
    cost,
    reason,
    proposalOnly: true,
    remoteApplyAllowed: false,
  };
}

function bucketFor(totals: Totals, settings: Settings): AdvancedBucket {
  const profit = totals.profit ?? totals.value - totals.cost;
  const cpa = totals.conversions > 0 ? totals.cost / totals.conversions : null;
  if (totals.clicks < settings.min_clicks && totals.cost < settings.min_cost_to_decide) return 'Low Data';
  if (totals.conversions === 0) return 'Zero Conv';
  if (profit > 0 && cpa !== null && cpa <= settings.target_cpa) return 'Profitable';
  if (profit < 0 || (cpa !== null && cpa > settings.target_cpa)) return 'Costly';
  return 'Watch';
}

function groupRows<T>(rows: T[], keyFor: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  rows.forEach((row) => {
    const key = keyFor(row) || 'missing';
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  return groups;
}

function totalsFrom(rows: Array<{ impressions?: number; clicks?: number; cost: number; conversions: number; conversion_value: number }>): Totals {
  return rows.reduce((total, row) => ({
    impressions: total.impressions + Number(row.impressions ?? 0),
    clicks: total.clicks + Number(row.clicks ?? 0),
    cost: total.cost + row.cost,
    conversions: total.conversions + row.conversions,
    value: total.value + row.conversion_value,
  }), { impressions: 0, clicks: 0, cost: 0, conversions: 0, value: 0 });
}

function byCost(a: SegmentPerformanceRow, b: SegmentPerformanceRow): number {
  return b.cost - a.cost;
}
