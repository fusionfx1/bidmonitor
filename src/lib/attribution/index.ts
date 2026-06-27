import type { CampaignRow, VoluumRow } from '../../types';
import { bkkDateToLaDates, addDays, TZ_BKK } from '../timezone';

// ─── Profit Dashboard rows (all dates in Asia/Bangkok) ────────────────────────
// Cost attributed to Google Ads `date` (BKK).
// Revenue attributed to Voluum `date` = click/visit date (BKK).
// profit_date = visit_date — NOT postback date.

export interface ProfitRow {
  date_bkk:           string;
  cost:               number;
  impressions:        number;
  clicks_google:      number;
  conversions_google: number;
  visits_voluum:      number;
  clicks_voluum:      number;
  conversions_voluum: number;
  revenue:            number;
  profit:             number;
  roi:                number; // decimal: 1.0 = 100%
  cpa:                number; // 0 when no conversions
  epc:                number; // 0 when no clicks
  cost_tz:            typeof TZ_BKK;
  revenue_tz:         typeof TZ_BKK;
}

export function buildProfitRows(campaigns: CampaignRow[], voluum: VoluumRow[]): ProfitRow[] {
  const costMap = new Map<string, { cost: number; imp: number; clk: number; conv: number }>();
  for (const r of campaigns) {
    const p = costMap.get(r.date) ?? { cost: 0, imp: 0, clk: 0, conv: 0 };
    costMap.set(r.date, {
      cost: p.cost + r.cost,
      imp:  p.imp  + r.impressions,
      clk:  p.clk  + r.clicks,
      conv: p.conv + r.conversions,
    });
  }

  const revMap = new Map<string, { vis: number; clk: number; conv: number; rev: number }>();
  for (const r of voluum) {
    const p = revMap.get(r.date) ?? { vis: 0, clk: 0, conv: 0, rev: 0 };
    revMap.set(r.date, {
      vis:  p.vis  + r.voluum_visits,
      clk:  p.clk  + r.voluum_clicks,
      conv: p.conv + r.voluum_conversions,
      rev:  p.rev  + r.revenue,
    });
  }

  const dates = new Set([...costMap.keys(), ...revMap.keys()]);
  return Array.from(dates)
    .sort((a, b) => b.localeCompare(a)) // newest first
    .map((date) => {
      const c  = costMap.get(date) ?? { cost: 0, imp: 0, clk: 0, conv: 0 };
      const rv = revMap.get(date)  ?? { vis: 0, clk: 0, conv: 0, rev: 0 };
      const profit = rv.rev - c.cost;
      return {
        date_bkk:           date,
        cost:               c.cost,
        impressions:        c.imp,
        clicks_google:      c.clk,
        conversions_google: c.conv,
        visits_voluum:      rv.vis,
        clicks_voluum:      rv.clk,
        conversions_voluum: rv.conv,
        revenue:            rv.rev,
        profit,
        roi:   c.cost > 0 ? profit / c.cost : 0,
        cpa:   rv.conv > 0 ? c.cost / rv.conv : 0,
        epc:   rv.clk  > 0 ? rv.rev  / rv.clk  : 0,
        cost_tz:    TZ_BKK,
        revenue_tz: TZ_BKK,
      };
    });
}

// ─── Network Reconciliation rows ──────────────────────────────────────────────
// Shows BKK date alongside the LA calendar date(s) that overlap with it.
// `revenue_bkk`  = Voluum revenue attributed to click_date (BKK) — correct for profit.
// `revenue_la`   = estimated revenue if network had bucketed by their LA date.
// `difference`   = what a raw BKK-vs-LA comparison would incorrectly show.
// `has_tz_risk`  = true when a single BKK date spans TWO LA calendar dates.

export interface ReconciliationRow {
  bkk_date:    string;
  la_dates:    string[];   // 1 or 2 LA dates overlapping with bkk_date
  cost_bkk:    number;
  revenue_bkk: number;
  revenue_la:  number;
  difference:  number;     // revenue_bkk - revenue_la
  has_tz_risk: boolean;
}

export function buildReconciliationRows(
  campaigns: CampaignRow[],
  voluum: VoluumRow[],
): ReconciliationRow[] {
  const costByBkk  = new Map<string, number>();
  const revByBkk   = new Map<string, number>();

  for (const r of campaigns) costByBkk.set(r.date, (costByBkk.get(r.date) ?? 0) + r.cost);
  for (const r of voluum)    revByBkk.set(r.date,  (revByBkk.get(r.date)  ?? 0) + r.revenue);

  // Redistribute BKK revenue proportionally across the LA dates it spans.
  // With daily aggregates we can't do an exact split, so equal share per overlapping LA date.
  const revByLa = new Map<string, number>();
  for (const [bkkDate, rev] of revByBkk) {
    const laDates = bkkDateToLaDates(bkkDate);
    const share   = rev / laDates.length;
    for (const la of laDates) revByLa.set(la, (revByLa.get(la) ?? 0) + share);
  }

  const dates = new Set([...costByBkk.keys(), ...revByBkk.keys()]);
  return Array.from(dates)
    .sort((a, b) => b.localeCompare(a))
    .map((bkkDate) => {
      const laDates    = bkkDateToLaDates(bkkDate);
      const costBkk    = costByBkk.get(bkkDate) ?? 0;
      const revBkk     = revByBkk.get(bkkDate)  ?? 0;
      const revLa      = laDates.reduce((s, la) => s + (revByLa.get(la) ?? 0), 0);
      return {
        bkk_date:    bkkDate,
        la_dates:    laDates,
        cost_bkk:    costBkk,
        revenue_bkk: revBkk,
        revenue_la:  revLa,
        difference:  revBkk - revLa,
        has_tz_risk: laDates.length > 1,
      };
    });
}

// ─── Cohort Profit rows ───────────────────────────────────────────────────────
// Cohort = all clicks on click_date_bkk.
// D0 = revenue attributed to click_date (same day as click).
// D1/D3/D7 = revenue that arrived on click_date+1/+3/+7 (delayed postbacks).
//
// NOTE: With daily-aggregated Voluum data each row's revenue has already been
// summed to the visit date, so D1/D3/D7 will only be non-zero if you have
// separate Voluum data for those offset dates in your imported dataset.

export interface CohortRow {
  click_date_bkk: string;
  cost:           number;
  clicks:         number;
  revenue_d0:     number;
  revenue_d1:     number;
  revenue_d3:     number;
  revenue_d7:     number;
  final_revenue:  number;
  final_profit:   number;
  final_roi:      number; // decimal
}

export function buildCohortRows(campaigns: CampaignRow[], voluum: VoluumRow[]): CohortRow[] {
  const costByDate = new Map<string, { cost: number; clicks: number }>();
  for (const r of campaigns) {
    const p = costByDate.get(r.date) ?? { cost: 0, clicks: 0 };
    costByDate.set(r.date, { cost: p.cost + r.cost, clicks: p.clicks + r.clicks });
  }

  const revByDate = new Map<string, number>();
  for (const r of voluum) revByDate.set(r.date, (revByDate.get(r.date) ?? 0) + r.revenue);

  const dates = new Set([...costByDate.keys(), ...revByDate.keys()]);
  return Array.from(dates)
    .sort((a, b) => b.localeCompare(a))
    .map((clickDate) => {
      const { cost = 0, clicks = 0 } = costByDate.get(clickDate) ?? {};
      const d0 = revByDate.get(clickDate)           ?? 0;
      const d1 = revByDate.get(addDays(clickDate, 1)) ?? 0;
      const d3 = revByDate.get(addDays(clickDate, 3)) ?? 0;
      const d7 = revByDate.get(addDays(clickDate, 7)) ?? 0;
      const finalRevenue = d0 + d1 + d3 + d7;
      const finalProfit  = finalRevenue - cost;
      return {
        click_date_bkk: clickDate,
        cost,
        clicks,
        revenue_d0: d0,
        revenue_d1: d1,
        revenue_d3: d3,
        revenue_d7: d7,
        final_revenue:  finalRevenue,
        final_profit:   finalProfit,
        final_roi:      cost > 0 ? finalProfit / cost : 0,
      };
    });
}

// ─── Summary totals ───────────────────────────────────────────────────────────

export interface ProfitTotals {
  cost: number; revenue: number; profit: number; roi: number;
  impressions: number; clicks_google: number; conversions_voluum: number;
  cpa: number; epc: number;
}

export function sumProfitRows(rows: ProfitRow[]): ProfitTotals {
  const cost    = rows.reduce((s, r) => s + r.cost,    0);
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const profit  = revenue - cost;
  const conv    = rows.reduce((s, r) => s + r.conversions_voluum, 0);
  const clkV    = rows.reduce((s, r) => s + r.clicks_voluum,      0);
  return {
    cost, revenue, profit,
    roi:              cost > 0 ? profit / cost : 0,
    impressions:      rows.reduce((s, r) => s + r.impressions,   0),
    clicks_google:    rows.reduce((s, r) => s + r.clicks_google, 0),
    conversions_voluum: conv,
    cpa:  conv  > 0 ? cost    / conv  : 0,
    epc:  clkV  > 0 ? revenue / clkV  : 0,
  };
}
