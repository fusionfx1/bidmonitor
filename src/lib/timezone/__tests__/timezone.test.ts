import { describe, it, expect } from 'vitest';
import {
  utcToLocalDate, attributeDates, bkkDateToLaDates,
  TZ_BKK, TZ_LA, TZ_UTC, getUtcOffsetMinutes, formatUtcOffset, addDays,
} from '../index';

// ─── Test 1: Click at 00:30 Asia/Bangkok maps to PREVIOUS date in Los Angeles ─
// BKK 2024-01-15 00:30 = UTC 2024-01-14 17:30:00 (BKK = UTC+7)
// LA (PST = UTC-8 in January): 2024-01-14 17:30 - 8h = 2024-01-14 09:30 → "2024-01-14"

describe('click at 00:30 Asia/Bangkok maps to previous LA date', () => {
  const bkkMidnightUtc = Date.UTC(2024, 0, 15) - 7 * 3_600_000; // UTC = BKK midnight - 7h
  const click00h30Utc  = bkkMidnightUtc + 30 * 60_000;           // + 30 min

  it('gives BKK date 2024-01-15', () => {
    expect(utcToLocalDate(click00h30Utc, TZ_BKK)).toBe('2024-01-15');
  });

  it('gives LA date 2024-01-14 (previous calendar day)', () => {
    expect(utcToLocalDate(click00h30Utc, TZ_LA)).toBe('2024-01-14');
  });

  it('bkkDateToLaDates includes the previous LA date', () => {
    const laDates = bkkDateToLaDates('2024-01-15');
    expect(laDates).toContain('2024-01-14');
  });
});

// ─── Test 2: Postback one day after click still attributes profit to visit_date_bkk ─
// Click: BKK 2024-01-15 10:00 = UTC 2024-01-15 03:00
// Postback: BKK 2024-01-16 09:00 = UTC 2024-01-16 02:00 (next day)
// Expected: profit_date_bkk = visit_date_bkk = "2024-01-15"
//           postback_date_bkk = "2024-01-16"

describe('postback D+1 still attributes revenue to visit_date_bkk', () => {
  const clickUtc    = Date.UTC(2024, 0, 15, 3, 0, 0);   // UTC 2024-01-15 03:00 = BKK 10:00
  const postbackUtc = Date.UTC(2024, 0, 16, 2, 0, 0);   // UTC 2024-01-16 02:00 = BKK 09:00 next day

  const attrs = attributeDates(clickUtc, postbackUtc);

  it('visit_date_bkk is 2024-01-15', () => {
    expect(attrs.visit_date_bkk).toBe('2024-01-15');
  });

  it('postback_date_bkk is 2024-01-16 (next day)', () => {
    expect(attrs.postback_date_bkk).toBe('2024-01-16');
  });

  it('profit_date_bkk equals visit_date_bkk (attributed to click, not postback)', () => {
    expect(attrs.profit_date_bkk).toBe(attrs.visit_date_bkk);
  });

  it('profit_date_bkk != postback_date_bkk (they differ)', () => {
    expect(attrs.profit_date_bkk).not.toBe(attrs.postback_date_bkk);
  });
});

// ─── Test 3: Same conversion appears under LA date in network_date_la field ───
// Click: BKK 2024-01-15 00:30 (UTC 2024-01-14 17:30) → visit_date_bkk = "2024-01-15"
// Postback: BKK 2024-01-15 06:00 (UTC 2024-01-14 23:00) → postback in LA = "2024-01-14"

describe('conversion appears under LA date in network_date_la', () => {
  const clickUtc    = Date.UTC(2024, 0, 14, 17, 30, 0); // BKK 2024-01-15 00:30
  const postbackUtc = Date.UTC(2024, 0, 14, 23,  0, 0); // BKK 2024-01-15 06:00

  const attrs = attributeDates(clickUtc, postbackUtc);

  it('visit_date_bkk is 2024-01-15', () => {
    expect(attrs.visit_date_bkk).toBe('2024-01-15');
  });

  it('network_date_la is 2024-01-14 (LA day of postback)', () => {
    // UTC 2024-01-14 23:00 in LA (PST, UTC-8) = 2024-01-14 15:00 → LA date "2024-01-14"
    expect(attrs.network_date_la).toBe('2024-01-14');
  });

  it('profit_date_bkk stays 2024-01-15 (ignores LA date)', () => {
    expect(attrs.profit_date_bkk).toBe('2024-01-15');
  });
});

// ─── Test 4: DST — America/Los_Angeles must use IANA, not a fixed UTC offset ──
// 2024 PDT ends: November 3, 2024 at 2:00 AM PDT (= 09:00 UTC)
// At 2024-11-03 07:30 UTC, PDT (UTC-7) is still active (fall-back hasn't happened yet).
// Correct (IANA PDT):  07:30 - 7h = 00:30 → "2024-11-03"
// Wrong  (fixed -8h):  07:30 - 8h = 23:30 → "2024-11-02"  ← proves fixed offset breaks DST

describe('DST: IANA Los_Angeles handles fall-back correctly', () => {
  // 2024-11-03 07:30 UTC — PDT still active (fall-back at 09:00 UTC)
  const utcMs = Date.UTC(2024, 10, 3, 7, 30, 0);

  it('Intl gives correct LA date 2024-11-03 (PDT active)', () => {
    expect(utcToLocalDate(utcMs, TZ_LA)).toBe('2024-11-03');
  });

  it('fixed UTC-8 would give wrong date 2024-11-02', () => {
    // Manually apply UTC-8 to prove fixed offset is incorrect during PDT
    const wrongDate = utcToLocalDate(utcMs - 8 * 3_600_000, TZ_UTC);
    expect(wrongDate).toBe('2024-11-02');
  });

  it('UTC offset for LA at this moment is -7 (PDT), not -8 (PST)', () => {
    expect(getUtcOffsetMinutes(utcMs, TZ_LA)).toBe(-7 * 60);
  });

  // Confirm PST is active AFTER fall-back (e.g., 10:00 UTC = 2:00 AM PST)
  it('UTC offset for LA after fall-back is -8 (PST)', () => {
    const afterFallback = Date.UTC(2024, 10, 3, 10, 30, 0); // 10:30 UTC = after 09:00
    expect(getUtcOffsetMinutes(afterFallback, TZ_LA)).toBe(-8 * 60);
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

describe('formatUtcOffset', () => {
  it('+07:00 for BKK', () => {
    const offset = getUtcOffsetMinutes(Date.UTC(2024, 0, 1), TZ_BKK);
    expect(formatUtcOffset(offset)).toBe('+07:00');
  });
  it('-08:00 for LA in January (PST)', () => {
    const offset = getUtcOffsetMinutes(Date.UTC(2024, 0, 1), TZ_LA);
    expect(formatUtcOffset(offset)).toBe('-08:00');
  });
});

describe('addDays', () => {
  it('adds days correctly across month boundary', () => {
    expect(addDays('2024-01-31', 1)).toBe('2024-02-01');
    expect(addDays('2024-02-28', 3)).toBe('2024-03-02');
  });
  it('subtracts days with negative n', () => {
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29'); // 2024 is leap year
  });
});

describe('attributeDates without postback', () => {
  it('returns null for postback fields when no postback provided', () => {
    const clickUtc = Date.UTC(2024, 0, 15, 3, 0, 0);
    const attrs = attributeDates(clickUtc);
    expect(attrs.postback_date_bkk).toBeNull();
    expect(attrs.network_date_la).toBeNull();
    expect(attrs.profit_date_bkk).toBe(attrs.visit_date_bkk);
  });
});
