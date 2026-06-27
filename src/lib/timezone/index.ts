// ─── Timezone constants ───────────────────────────────────────────────────────

export const TZ_BKK = 'Asia/Bangkok'            as const; // UTC+7, no DST
export const TZ_LA  = 'America/Los_Angeles'     as const; // UTC-8/UTC-7, has DST
export const TZ_UTC = 'UTC'                     as const;

export type TzKey = typeof TZ_BKK | typeof TZ_LA | typeof TZ_UTC;

export const TZ_LABELS: Record<string, string> = {
  [TZ_BKK]: 'Asia/Bangkok (UTC+7)',
  [TZ_LA]:  'America/Los_Angeles (PST/PDT)',
  [TZ_UTC]: 'UTC',
};

// ─── Core: UTC ms → local YYYY-MM-DD ─────────────────────────────────────────
// Uses Intl IANA database — handles DST correctly for all timezones.
// `formatToParts` is used instead of a locale string so the format is
// guaranteed YYYY-MM-DD regardless of runtime locale.

export function utcToLocalDate(utcMs: number, tz: string): string {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year:  'numeric',
    month: '2-digit',
    day:   '2-digit',
  }).formatToParts(utcMs);
  const m: Record<string, string> = {};
  for (const part of p) m[part.type] = part.value;
  return `${m.year}-${m.month}-${m.day}`;
}

// ─── UTC offset (minutes) for a timezone at a given moment — DST-aware ────────

export function getUtcOffsetMinutes(utcMs: number, tz: string): number {
  // Reconstruct the local datetime components, then compare the epoch values.
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(utcMs);
  const m: Record<string, string> = {};
  for (const part of p) m[part.type] = part.value;
  const localMs = Date.UTC(
    +m.year, +m.month - 1, +m.day,
    m.hour === '24' ? 0 : +m.hour,
    +m.minute, +m.second,
  );
  return Math.round((localMs - utcMs) / 60_000);
}

export function formatUtcOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

// ─── Date arithmetic ──────────────────────────────────────────────────────────

export function addDays(dateStr: string, n: number): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const ms = Date.UTC(y, mo - 1, d) + n * 86_400_000;
  return utcToLocalDate(ms, TZ_UTC);
}

export function parseDateUtcMs(dateStr: string): number {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, mo - 1, d);
}

// ─── Multi-field attribution ──────────────────────────────────────────────────

export interface AttributedDates {
  visit_date_bkk:    string;           // click timestamp → BKK date
  postback_date_bkk: string | null;    // postback timestamp → BKK date
  network_date_la:   string | null;    // postback timestamp → LA date (affiliate network)
  profit_date_bkk:   string;           // ALWAYS = visit_date_bkk (attribution to click, not postback)
}

export function attributeDates(clickUtcMs: number, postbackUtcMs?: number): AttributedDates {
  const visit    = utcToLocalDate(clickUtcMs, TZ_BKK);
  const pbBkk    = postbackUtcMs !== undefined ? utcToLocalDate(postbackUtcMs, TZ_BKK) : null;
  const pbLa     = postbackUtcMs !== undefined ? utcToLocalDate(postbackUtcMs, TZ_LA)  : null;
  return {
    visit_date_bkk:    visit,
    postback_date_bkk: pbBkk,
    network_date_la:   pbLa,
    profit_date_bkk:   visit, // revenue is always attributed to the CLICK date
  };
}

// ─── BKK date ↔ LA date overlap ───────────────────────────────────────────────
// BKK is UTC+7 (no DST). BKK midnight = UTC prev-day 17:00.
// LA has DST, so the overlap with BKK dates shifts seasonally.
// Returns the LA calendar date(s) that contain any portion of this BKK date.

export function bkkDateToLaDates(bkkDate: string): string[] {
  const [y, mo, d] = bkkDate.split('-').map(Number);
  // BKK midnight of this date in UTC: UTC = BKK - 7h
  const bkkMidnightUtc = Date.UTC(y, mo - 1, d) - 7 * 3_600_000;
  // BKK 23:59:59.999 in UTC
  const bkkEndUtc = bkkMidnightUtc + 86_400_000 - 1;

  const laStart = utcToLocalDate(bkkMidnightUtc, TZ_LA);
  const laEnd   = utcToLocalDate(bkkEndUtc,       TZ_LA);
  return laStart === laEnd ? [laStart] : [laStart, laEnd];
}

// ─── Timezone mismatch warning ────────────────────────────────────────────────

export interface TzMismatchWarning {
  hasMismatch: boolean;
  message:     string;
}

export function checkTzMismatch(costTz: string, revenueTz: string): TzMismatchWarning {
  if (costTz === revenueTz) return { hasMismatch: false, message: '' };
  return {
    hasMismatch: true,
    message:
      `Cost dates use ${TZ_LABELS[costTz] ?? costTz} but revenue dates use ` +
      `${TZ_LABELS[revenueTz] ?? revenueTz}. ` +
      `Day boundaries differ — edge-day performance figures may be misattributed.`,
  };
}
