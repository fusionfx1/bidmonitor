// Pure calculation functions — fully testable, no side effects

export function calcCPA(cost: number, conversions: number): number {
  if (conversions === 0) return 0;
  return cost / conversions;
}

export function calcROI(revenue: number, cost: number): number {
  if (cost === 0) return 0;
  return (revenue - cost) / cost;
}

export function calcROIPercent(revenue: number, cost: number): number {
  return calcROI(revenue, cost) * 100;
}

export function calcCTR(clicks: number, impressions: number): number {
  if (impressions === 0) return 0;
  return clicks / impressions;
}

export function calcAvgCPC(cost: number, clicks: number): number {
  if (clicks === 0) return 0;
  return cost / clicks;
}

export function calcProfit(revenue: number, cost: number): number {
  return revenue - cost;
}

export function fmtCurrency(value: number, currency = 'THB'): string {
  // Use th-TH locale so THB renders as ฿ instead of the ISO code "THB"
  const locale = currency === 'THB' ? 'th-TH' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function fmtBid(value: number, currency = 'THB'): string {
  return fmtCurrency(value, currency);
}

export function fmtPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function fmtNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Aggregate helper — sum a numeric field across rows
export function sumField<T>(rows: T[], field: keyof T): number {
  return rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
}
