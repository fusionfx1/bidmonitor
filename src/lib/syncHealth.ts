import type { GoogleSyncLogRow, ImportedData, SyncLogStatus } from '../types';

export type FreshnessStatus = 'OK' | 'STALE' | 'ERROR' | 'UNKNOWN';
export type VoluumFreshnessStatus = FreshnessStatus | 'OPTIONAL';

export interface SyncHealth {
  totalRuns: number;
  runsToday: number;
  expectedRunsToday: number;
  lastScriptRunAt: string | null;
  lastSuccessfulScriptRunAt: string | null;
  lastStatus: SyncLogStatus | null;
  lastDurationSeconds: number | null;
  lastErrorMessage: string | null;
  freshnessStatus: FreshnessStatus;
}

export interface VoluumFreshness {
  status: VoluumFreshnessStatus;
  rows: number;
  importedAt: string | null;
  staleFailClosed: boolean;
}

const STALE_MS = 90 * 60 * 1000; // 90 minutes

function hoursElapsedToday(): number {
  const now = new Date();
  return Math.max(1, now.getHours() + (now.getMinutes() >= 30 ? 1 : 0));
}

export function computeSyncHealth(rows: GoogleSyncLogRow[]): SyncHealth {
  if (!rows || rows.length === 0) {
    return {
      totalRuns: 0,
      runsToday: 0,
      expectedRunsToday: hoursElapsedToday(),
      lastScriptRunAt: null,
      lastSuccessfulScriptRunAt: null,
      lastStatus: null,
      lastDurationSeconds: null,
      lastErrorMessage: null,
      freshnessStatus: 'UNKNOWN',
    };
  }

  const sorted = [...rows].sort((a, b) => b.started_at.localeCompare(a.started_at));
  const latest = sorted[0];
  const todayDate = new Date().toISOString().slice(0, 10);
  const runsToday = rows.filter((r) => r.started_at.slice(0, 10) === todayDate).length;
  const expectedRunsToday = Math.max(hoursElapsedToday(), runsToday);

  const lastSuccessful = sorted.find((r) => r.status === 'SUCCESS' || r.status === 'PARTIAL') ?? null;

  let freshnessStatus: FreshnessStatus;
  if (latest.status === 'FAILED') {
    freshnessStatus = 'ERROR';
  } else if (!lastSuccessful) {
    freshnessStatus = 'UNKNOWN';
  } else {
    const elapsed = Date.now() - new Date(lastSuccessful.started_at).getTime();
    freshnessStatus = elapsed <= STALE_MS ? 'OK' : 'STALE';
  }

  return {
    totalRuns: rows.length,
    runsToday,
    expectedRunsToday,
    lastScriptRunAt: latest.started_at,
    lastSuccessfulScriptRunAt: lastSuccessful?.started_at ?? null,
    lastStatus: latest.status,
    lastDurationSeconds: latest.duration_seconds > 0 ? latest.duration_seconds : null,
    lastErrorMessage: latest.error_message || null,
    freshnessStatus,
  };
}

export function computeVoluumFreshness(
  data: Pick<ImportedData, 'voluum' | 'meta'>,
  staleMs = STALE_MS
): VoluumFreshness {
  const rows = data.voluum.length;
  const importedAt = data.meta.voluum?.importedAt ?? null;

  if (rows === 0) {
    return { status: 'OPTIONAL', rows, importedAt, staleFailClosed: false };
  }

  if (!importedAt) {
    return { status: 'UNKNOWN', rows, importedAt, staleFailClosed: true };
  }

  const importedAtMs = new Date(importedAt).getTime();
  if (Number.isNaN(importedAtMs)) {
    return { status: 'UNKNOWN', rows, importedAt, staleFailClosed: true };
  }

  const elapsed = Date.now() - importedAtMs;
  const status: FreshnessStatus = elapsed <= staleMs ? 'OK' : 'STALE';
  return { status, rows, importedAt, staleFailClosed: status !== 'OK' };
}

export function relativeTime(isoStr: string): string {
  const diffMs = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
