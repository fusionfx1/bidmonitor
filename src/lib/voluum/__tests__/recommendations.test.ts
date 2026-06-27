import { describe, it, expect } from 'vitest';
import { getRecommendation, buildRecommendations, THRESHOLDS } from '../recommendations';
import { normalizeRow } from '../normalize';
import type { VoluumRawRow } from '../types';

function row(overrides: Partial<VoluumRawRow>) {
  return normalizeRow({ visits: 500, clicks: 100, conversions: 0, cost: 0, revenue: 0, ...overrides }, 'demo');
}

describe('getRecommendation', () => {
  it('returns CUT when spend > threshold and zero conversions', () => {
    const rec = getRecommendation(row({ cost: THRESHOLDS.minSpendCut + 5, conversions: 0 }));
    expect(rec.action).toBe('CUT');
    expect(rec.confidence).toBe('HIGH');
  });

  it('returns CUT when ROI is strongly negative with enough data', () => {
    const rec = getRecommendation(row({
      clicks: THRESHOLDS.minClicksCut + 20,
      cost: THRESHOLDS.minSpendCut + 20,
      revenue: 1, // tiny revenue → strongly negative ROI
    }));
    expect(rec.action).toBe('CUT');
  });

  it('returns SCALE when profitable with good ROI and conversions', () => {
    const rec = getRecommendation(row({
      conversions: 5,
      cost: 50,
      revenue: 150, // ROI = 2.0 > threshold
    }));
    expect(rec.action).toBe('SCALE');
    expect(['MEDIUM', 'HIGH']).toContain(rec.confidence);
  });

  it('returns INVESTIGATE for high clicks but no CVR', () => {
    const rec = getRecommendation(row({
      clicks: THRESHOLDS.minClicksInvestigate + 10,
      conversions: 0,
      cost: 0,
    }));
    expect(rec.action).toBe('INVESTIGATE');
  });

  it('returns WATCH when insufficient data', () => {
    const rec = getRecommendation(row({ clicks: 3, cost: 2, conversions: 0 }));
    expect(rec.action).toBe('WATCH');
  });

  it('never exposes internal error for zero-cost row', () => {
    expect(() => getRecommendation(row({ cost: 0, clicks: 0, conversions: 0 }))).not.toThrow();
  });
});

describe('buildRecommendations', () => {
  it('filters out rows below minSpend threshold', () => {
    const rows = [
      row({ cost: 1, conversions: 0 }),   // below threshold
      row({ cost: 50, conversions: 0 }),  // above threshold
    ];
    const recs = buildRecommendations(rows, { minSpend: 10, minClicks: 0 });
    expect(recs).toHaveLength(1);
    expect(recs[0].action).toBe('CUT');
  });

  it('produces one recommendation per row above threshold', () => {
    const rows = [
      row({ cost: 20, clicks: 50, conversions: 3, revenue: 100 }),
      row({ cost: 20, clicks: 50, conversions: 0 }),
    ];
    const recs = buildRecommendations(rows, { minSpend: 10, minClicks: 0 });
    expect(recs).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(buildRecommendations([])).toHaveLength(0);
  });

  it('includes metrics in each recommendation', () => {
    const rows = [row({ cost: 20, clicks: 20, conversions: 0 })];
    const recs = buildRecommendations(rows, { minSpend: 10, minClicks: 0 });
    expect(recs[0].metrics).toMatchObject({ clicks: 20, conversions: 0 });
  });
});
