import type { CampaignRow, ImportedData, Settings, VoluumRow } from '../types';
import { getActiveAccountScope, matchesAccountScope } from './accountSources';
import { computeVoluumFreshness, type VoluumFreshnessStatus } from './syncHealth';

export type PacingStatus = 'over' | 'on_track' | 'under';
export type OptimizationPreset = 'none' | 'conservative' | 'balanced' | 'aggressive';

export interface BudgetPacingRow {
  campaignId: string;
  campaignName: string;
  dailyBudget: number;
  cost: number;
  revenue: number;
  profit: number;
  conversions: number;
  cpa: number | null;
  roi: number | null;
  dailyAverage: number;
  monthProjection: number;
  next30Projection: number;
  utilization: number;
  status: PacingStatus;
  recommendedBudget: number;
  reason: string;
}

export interface BudgetProposal {
  id: string;
  campaignId: string;
  campaignName: string;
  currentBudget: number;
  proposedBudget: number;
  deltaPercent: number;
  projectedProfitDelta: number;
  reason: string;
  proposalOnly: true;
  remoteApplyAllowed: false;
}

export interface ProfitCurvePoint {
  cost: number;
  revenue: number;
  profit: number;
  cpa: number | null;
  roi: number | null;
  zone: 'loss' | 'breakeven' | 'optimal' | 'diminishing';
}

export interface BudgetOptimizationModel {
  monthProgressPercent: number;
  totalCost: number;
  configuredMonthlyBudget: number;
  variance: number;
  next30Forecast: number;
  rows: BudgetPacingRow[];
  proposals: BudgetProposal[];
  profitCurve: ProfitCurvePoint[];
  optimalCost: number;
  voluumFreshnessStatus: VoluumFreshnessStatus;
  staleFailClosed: boolean;
}

const PRESET_CHANGE: Record<OptimizationPreset, number> = {
  none: 0,
  conservative: 0.1,
  balanced: 0.2,
  aggressive: 0.35,
};

export function buildBudgetOptimization(data: ImportedData, settings: Settings, preset: OptimizationPreset = 'balanced'): BudgetOptimizationModel {
  const voluumFreshness = computeVoluumFreshness(data);
  const useVoluumRows = voluumFreshness.status === 'OK';
  const rows = buildPacingRows(
    rowsForActiveScope(data.campaigns, settings),
    useVoluumRows ? rowsForActiveScope(data.voluum, settings) : [],
    settings
  );
  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);
  const configuredMonthlyBudget = rows.reduce((sum, row) => sum + row.dailyBudget, 0) * daysInCurrentMonth();
  const elapsed = dayOfMonth();
  const monthProgressPercent = elapsed / daysInCurrentMonth();
  const expectedSpend = configuredMonthlyBudget * monthProgressPercent;
  const next30Forecast = rows.reduce((sum, row) => sum + row.next30Projection, 0);
  const proposals = useVoluumRows ? buildProposals(rows, settings, preset) : [];
  const profitCurve = buildProfitCurve(rows, settings);
  const optimal = [...profitCurve].sort((a, b) => b.profit - a.profit)[0];

  return {
    monthProgressPercent,
    totalCost,
    configuredMonthlyBudget,
    variance: totalCost - expectedSpend,
    next30Forecast,
    rows,
    proposals,
    profitCurve,
    optimalCost: optimal?.cost ?? 0,
    voluumFreshnessStatus: voluumFreshness.status,
    staleFailClosed: voluumFreshness.staleFailClosed,
  };
}

function buildPacingRows(campaigns: CampaignRow[], voluumRows: VoluumRow[], settings: Settings): BudgetPacingRow[] {
  const byCampaign = new Map<string, CampaignRow[]>();
  campaigns.forEach((row) => byCampaign.set(row.campaign_id, [...(byCampaign.get(row.campaign_id) ?? []), row]));
  const voluum = aggregateVoluum(voluumRows);

  return [...byCampaign.entries()].map(([campaignId, group]) => {
    const cost = sum(group, 'cost');
    const googleValue = sum(group, 'conversion_value');
    const v = voluum.get(campaignId);
    const revenue = v?.revenue ?? googleValue;
    const conversions = v?.conversions ?? sum(group, 'conversions');
    const profit = revenue - cost;
    const activeDays = Math.max(1, new Set(group.map((row) => row.date.slice(0, 10))).size);
    const dailyBudget = latestPositiveBudget(group);
    const dailyAverage = cost / activeDays;
    const monthProjection = dailyAverage * daysInCurrentMonth();
    const next30Projection = dailyAverage * 30;
    const utilization = dailyBudget > 0 ? dailyAverage / dailyBudget : 0;
    const roi = cost > 0 ? (profit / cost) * 100 : null;
    const cpa = conversions > 0 ? cost / conversions : null;
    const status: PacingStatus = utilization > 1.15 ? 'over' : utilization < 0.85 ? 'under' : 'on_track';
    const recommendedBudget = recommendedBudgetFor(dailyBudget, status, cpa, profit, settings);

    return {
      campaignId,
      campaignName: group[0]?.campaign_name ?? campaignId,
      dailyBudget,
      cost,
      revenue,
      profit,
      conversions,
      cpa,
      roi,
      dailyAverage,
      monthProjection,
      next30Projection,
      utilization,
      status,
      recommendedBudget,
      reason: reasonFor(status, cpa, profit, settings),
    };
  }).sort((a, b) => b.cost - a.cost);
}

function buildProposals(rows: BudgetPacingRow[], settings: Settings, preset: OptimizationPreset): BudgetProposal[] {
  const change = PRESET_CHANGE[preset];
  if (change <= 0) return [];
  return rows
    .flatMap((row) => {
      const direction = proposalDirection(row, settings);
      if (row.dailyBudget <= 0 || direction === null) return [];
      const cappedChange = Math.min(change, settings.auto_bid_guardrails.maxBudgetChangePercent / 100);
      const proposedBudget = roundBudget(clamp(
        row.dailyBudget * (1 + direction * cappedChange),
        settings.auto_bid_guardrails.minBudget,
        settings.auto_bid_guardrails.maxBudget
      ));
      if (proposedBudget === row.dailyBudget) return [];
      return {
        id: `budget:${row.campaignId}`,
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        currentBudget: row.dailyBudget,
        proposedBudget,
        deltaPercent: ((proposedBudget - row.dailyBudget) / row.dailyBudget) * 100,
        projectedProfitDelta: (row.profit / Math.max(row.cost, 1)) * (proposedBudget - row.dailyBudget) * 30,
        reason: `${preset} preset: ${row.reason}`,
        proposalOnly: true,
        remoteApplyAllowed: false,
      };
    });
}

function proposalDirection(row: BudgetPacingRow, settings: Settings): 1 | -1 | null {
  if (row.status === 'under' && row.profit > 0 && row.cpa !== null && row.cpa <= settings.target_cpa) return 1;
  if (row.status === 'over' && row.profit < 0) return -1;
  return null;
}

function buildProfitCurve(rows: BudgetPacingRow[], settings: Settings): ProfitCurvePoint[] {
  const baseCost = Math.max(rows.reduce((sum, row) => sum + row.cost, 0), 1);
  const baseRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const baseConversions = rows.reduce((sum, row) => sum + row.conversions, 0);
  return [0.5, 0.75, 1, 1.25, 1.5, 2].map((multiplier) => {
    const response = multiplier <= 1 ? multiplier : 1 + Math.log(multiplier) * 0.7;
    const cost = baseCost * multiplier;
    const revenue = baseRevenue * response;
    const conversions = baseConversions * response;
    const profit = revenue - cost;
    const cpa = conversions > 0 ? cost / conversions : null;
    const roi = cost > 0 ? (profit / cost) * 100 : null;
    return {
      cost,
      revenue,
      profit,
      cpa,
      roi,
      zone: profit < 0 ? 'loss' : cpa !== null && cpa <= settings.target_cpa && multiplier <= 1.5 ? 'optimal' : multiplier > 1.5 ? 'diminishing' : 'breakeven',
    };
  });
}

function aggregateVoluum(rows: VoluumRow[]): Map<string, { revenue: number; conversions: number }> {
  const map = new Map<string, { revenue: number; conversions: number }>();
  rows.forEach((row) => {
    const existing = map.get(row.campaign_id) ?? { revenue: 0, conversions: 0 };
    existing.revenue += row.revenue;
    existing.conversions += row.voluum_conversions;
    map.set(row.campaign_id, existing);
  });
  return map;
}

function rowsForActiveScope<T extends { account_id?: string; customer_id?: string; source_sheet_id?: string }>(rows: T[], settings: Settings): T[] {
  const scope = getActiveAccountScope(settings);
  if (!scope) return rows;
  return rows.filter((row) => matchesAccountScope(row, scope));
}

function latestPositiveBudget(rows: CampaignRow[]): number {
  return [...rows].reverse().find((row) => row.daily_budget > 0)?.daily_budget ?? 0;
}

function recommendedBudgetFor(dailyBudget: number, status: PacingStatus, cpa: number | null, profit: number, settings: Settings): number {
  if (dailyBudget <= 0) return 0;
  if (status === 'under' && profit > 0 && cpa !== null && cpa <= settings.target_cpa) return dailyBudget * 1.15;
  if (status === 'over' && profit < 0) return dailyBudget * 0.85;
  return dailyBudget;
}

function reasonFor(status: PacingStatus, cpa: number | null, profit: number, settings: Settings): string {
  if (status === 'over' && profit < 0) return 'Over pacing with negative profit; reduce proposal only.';
  if (status === 'under' && profit > 0 && cpa !== null && cpa <= settings.target_cpa) return 'Under pacing with profitable CPA; increase proposal only.';
  return 'Keep budget under review.';
}

function sum<T>(rows: T[], key: keyof T): number {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundBudget(value: number): number {
  return Math.round(value * 100) / 100;
}

function daysInCurrentMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function dayOfMonth(): number {
  return new Date().getDate();
}
