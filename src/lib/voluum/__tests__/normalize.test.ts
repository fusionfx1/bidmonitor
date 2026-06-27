import { describe, it, expect } from 'vitest';
import { normalizeRow, computeTotals, safeNum, fmtMoney, fmtOrDash } from '../normalize';
import type { VoluumRawRow } from '../types';

describe('safeNum', () => {
  it('returns 0 for null/undefined/empty', () => {
    expect(safeNum(null)).toBe(0);
    expect(safeNum(undefined)).toBe(0);
    expect(safeNum('')).toBe(0);
  });
  it('strips % and commas', () => {
    expect(safeNum('12.5%')).toBe(12.5);
    expect(safeNum('1,234.56')).toBe(1234.56);
  });
  it('returns 0 for NaN strings', () => {
    expect(safeNum('abc')).toBe(0);
  });
});

describe('normalizeRow', () => {
  const base: VoluumRawRow = {
    campaignId: 'c1', campaignName: 'Test Campaign',
    visits: 1000, clicks: 500, conversions: 10,
    cost: 100, revenue: 350,
  };

  it('computes profit from revenue - cost when not provided', () => {
    const row = normalizeRow(base, '2024-01-01/2024-01-07');
    expect(row.profit).toBe(250);
  });

  it('computes ROI without divide-by-zero', () => {
    const row = normalizeRow({ ...base, cost: 0 }, 'demo');
    expect(row.roi).toBe(0);
  });

  it('computes CPA without divide-by-zero', () => {
    const row = normalizeRow({ ...base, conversions: 0 }, 'demo');
    expect(row.cpa).toBe(0);
  });

  it('computes CVR without divide-by-zero', () => {
    const row = normalizeRow({ ...base, clicks: 0 }, 'demo');
    expect(row.cvr).toBe(0);
  });

  it('handles nested campaign field', () => {
    const nested: VoluumRawRow = { campaign: { id: 'n1', name: 'Nested Cam' }, visits: 10, clicks: 5 };
    const row = normalizeRow(nested, 'demo');
    expect(row.campaignName).toBe('Nested Cam');
    expect(row.campaignId).toBe('n1');
  });

  it('handles all-null fields without crashing', () => {
    const row = normalizeRow({
      campaignId: null as unknown as string,
      visits: null, clicks: null, conversions: null,
      cost: null, revenue: null, profit: null,
    }, 'demo');
    expect(row.profit).toBe(0);
    expect(row.roi).toBe(0);
    expect(row.cpa).toBe(0);
  });

  it('marks source correctly', () => {
    const real = normalizeRow(base, 'demo', 'voluum');
    expect(real.source).toBe('voluum');
    const mock = normalizeRow(base, 'demo', 'voluum-mock');
    expect(mock.source).toBe('voluum-mock');
  });
});

describe('computeTotals', () => {
  it('sums rows correctly', () => {
    const r1 = normalizeRow({ visits: 100, clicks: 50, conversions: 5, cost: 50, revenue: 175 }, 'demo');
    const r2 = normalizeRow({ visits: 200, clicks: 100, conversions: 10, cost: 100, revenue: 350 }, 'demo');
    const t = computeTotals([r1, r2]);
    expect(t.visits).toBe(300);
    expect(t.cost).toBe(150);
    expect(t.profit).toBe(375);
  });

  it('returns zero totals for empty array', () => {
    const t = computeTotals([]);
    expect(t.roi).toBe(0);
    expect(t.cpa).toBe(0);
  });
});

describe('formatters', () => {
  it('fmtMoney formats correctly', () => {
    expect(fmtMoney(1234.5)).toBe('฿1234.50');
    expect(fmtMoney(0)).toBe('฿0.00');
  });

  it('fmtOrDash returns dash for zero', () => {
    expect(fmtOrDash(0)).toBe('—');
    expect(fmtOrDash(9.99)).toBe('฿9.99');
  });
});
