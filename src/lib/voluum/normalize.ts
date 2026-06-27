import type {
  VoluumRawRow, NormalizedVoluumRow, VoluumTotals,
} from './types';

/** Safe numeric coercion — strips %, commas; returns 0 for null/empty/NaN. */
export function safeNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const s = String(v).replace(/[%,\s]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Safe string coercion. */
function safeStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

/** Resolve campaign name/id from both flat and nested Voluum response shapes. */
function resolveName(r: VoluumRawRow): string {
  return (
    safeStr(r.campaignName) ||
    safeStr((r.campaign as { name?: string } | undefined)?.name) ||
    safeStr(r.name) ||
    'Unknown'
  );
}

function resolveId(r: VoluumRawRow): string {
  return (
    safeStr(r.campaignId) ||
    safeStr((r.campaign as { id?: string } | undefined)?.id) ||
    safeStr(r.id) ||
    ''
  );
}

export function normalizeRow(
  r: VoluumRawRow,
  dateRange: string,
  source: NormalizedVoluumRow['source'] = 'voluum'
): NormalizedVoluumRow {
  const clicks      = safeNum(r.clicks);
  const conversions = safeNum(r.conversions);
  const cost        = safeNum(r.cost);
  const revenue     = safeNum(r.revenue);

  // Prefer API-provided profit/roi/ctr/cvr; fall back to computed values
  const profit = r.profit !== null && r.profit !== undefined
    ? safeNum(r.profit)
    : revenue - cost;

  const roi = r.roi !== null && r.roi !== undefined
    ? safeNum(r.roi)
    : cost > 0 ? (revenue - cost) / cost : 0;

  const ctr = r.ctr !== null && r.ctr !== undefined
    ? safeNum(r.ctr)
    : safeNum(r.visits) > 0 ? clicks / safeNum(r.visits) : 0;

  const cvr = r.cvr !== null && r.cvr !== undefined
    ? safeNum(r.cvr)
    : clicks > 0 ? conversions / clicks : 0;

  const epc = r.epc !== null && r.epc !== undefined
    ? safeNum(r.epc)
    : clicks > 0 ? revenue / clicks : 0;

  const cpa = r.cpa !== null && r.cpa !== undefined
    ? safeNum(r.cpa)
    : conversions > 0 ? cost / conversions : 0;

  return {
    campaignId:   resolveId(r),
    campaignName: resolveName(r),
    visits:       safeNum(r.visits),
    clicks,
    conversions,
    cost,
    revenue,
    profit,
    roi,
    ctr,
    cvr,
    epc,
    cpa,
    dateRange,
    source,
  };
}

export function normalizeRows(
  rows: VoluumRawRow[],
  dateRange: string,
  source: NormalizedVoluumRow['source'] = 'voluum'
): NormalizedVoluumRow[] {
  return rows.map((r) => normalizeRow(r, dateRange, source));
}

export function computeTotals(rows: NormalizedVoluumRow[]): VoluumTotals {
  const visits      = rows.reduce((s, r) => s + r.visits, 0);
  const clicks      = rows.reduce((s, r) => s + r.clicks, 0);
  const conversions = rows.reduce((s, r) => s + r.conversions, 0);
  const cost        = rows.reduce((s, r) => s + r.cost, 0);
  const revenue     = rows.reduce((s, r) => s + r.revenue, 0);
  const profit      = revenue - cost;
  const roi         = cost > 0 ? profit / cost : 0;
  const ctr         = visits > 0 ? clicks / visits : 0;
  const cvr         = clicks > 0 ? conversions / clicks : 0;
  const epc         = clicks > 0 ? revenue / clicks : 0;
  const cpa         = conversions > 0 ? cost / conversions : 0;
  return { visits, clicks, conversions, cost, revenue, profit, roi, ctr, cvr, epc, cpa };
}

/** Format a decimal ratio as a percentage string, e.g. 0.1234 → "12.34%" */
export function fmtPct(v: number, decimals = 2): string {
  return `${(v * 100).toFixed(decimals)}%`;
}

/** Format money safely, never divides by zero. */
export function fmtMoney(v: number): string {
  return v === 0 ? '฿0.00' : `฿${v.toFixed(2)}`;
}

/** Display value or dash when zero (used for CPA, EPC). */
export function fmtOrDash(v: number, fmt: (n: number) => string = fmtMoney): string {
  return v === 0 ? '—' : fmt(v);
}

// ─── Google Ads name matching ─────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function matchVoluumToGoogle(
  voluumName: string,
  googleNames: string[]
): { googleName: string; method: 'exact' | 'contains' | 'normalized' | 'none'; confidence: number } {
  const exact = googleNames.find((g) => g === voluumName);
  if (exact) return { googleName: exact, method: 'exact', confidence: 1 };

  const contains = googleNames.find(
    (g) => g.toLowerCase().includes(voluumName.toLowerCase()) ||
           voluumName.toLowerCase().includes(g.toLowerCase())
  );
  if (contains) return { googleName: contains, method: 'contains', confidence: 0.8 };

  const norm = normalizeName(voluumName);
  const normalized = googleNames.find((g) => normalizeName(g) === norm);
  if (normalized) return { googleName: normalized, method: 'normalized', confidence: 0.6 };

  return { googleName: '', method: 'none', confidence: 0 };
}
