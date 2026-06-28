import type { AccountSourceScope } from './accountSources';

export type SyncRunStatus = 'success' | 'warning' | 'failed';
export type SyncIndicatorStatus = 'never_synced' | 'running' | 'success' | 'warning' | 'failed' | 'stale';

export interface SyncRunInput extends Omit<SyncRunRecord, 'run_id'> {
  run_id?: string;
}

export interface SyncRunRecord {
  run_id: string;
  account_id: string;
  customer_id: string;
  source_sheet_id: string;
  started_at: string;
  finished_at: string;
  status: SyncRunStatus;
  rows_imported: number;
  tabs_updated: number;
  error_message: string | null;
  trigger_type: 'manual' | 'auto';
  source: string;
}

export interface SyncRunIndicator {
  last_sync_at: string | null;
  sync_count_today: number;
  last_sync_status: SyncIndicatorStatus;
  last_error: string | null;
  source_sheet_id: string;
  customer_id: string;
  account_id: string;
}

const SYNC_RUN_STORAGE_KEY = 'gads_monitor_sync_runs';
const MAX_RUNS_PER_SCOPE = 120;
const STALE_MS = 90 * 60 * 1000;
const inMemoryRuns: SyncRunRecord[] = [];

function nowIsoDateAt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isStorageAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

function readAllRuns(): SyncRunRecord[] {
  if (!isStorageAvailable()) return [...inMemoryRuns];
  const raw = localStorage.getItem(SYNC_RUN_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => ({
        ...row,
        rows_imported: Number(row.rows_imported ?? 0),
        tabs_updated: Number(row.tabs_updated ?? 0),
      }))
      .filter(
        (row): row is SyncRunRecord =>
          Boolean(row?.run_id)
          && typeof row.account_id === 'string'
          && typeof row.customer_id === 'string'
          && typeof row.source_sheet_id === 'string'
      );
  } catch {
    return [];
  }
}

function writeAllRuns(rows: SyncRunRecord[]): void {
  if (!isStorageAvailable()) {
    inMemoryRuns.length = 0;
    inMemoryRuns.push(...rows);
    return;
  }
  try {
    localStorage.setItem(SYNC_RUN_STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // ignore quota / storage errors in local-first environment
  }
}

function isSameScope(a: SyncRunRecord, b: AccountSourceScope): boolean {
  return a.account_id === b.account_id
    && a.customer_id === b.customer_id
    && a.source_sheet_id === b.source_sheet_id;
}

function newRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sync_run_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeInput(input: SyncRunInput): SyncRunRecord {
  return {
    run_id: input.run_id || newRunId(),
    account_id: input.account_id.trim(),
    customer_id: input.customer_id.trim(),
    source_sheet_id: input.source_sheet_id.trim(),
    started_at: input.started_at,
    finished_at: input.finished_at,
    status: input.status,
    rows_imported: Number.isFinite(input.rows_imported) ? Math.max(0, Math.trunc(input.rows_imported)) : 0,
    tabs_updated: Number.isFinite(input.tabs_updated) ? Math.max(0, Math.trunc(input.tabs_updated)) : 0,
    error_message: input.error_message || null,
    trigger_type: input.trigger_type || 'manual',
    source: input.source || '',
  };
}

function latestStatus(runs: SyncRunRecord[]): SyncIndicatorStatus | null {
  const latest = runs[0];
  if (!latest) return null;
  if (latest.status === 'failed') return 'failed';
  if (latest.status === 'warning') return 'warning';
  return 'success';
}

function isStale(run: SyncRunRecord, now: Date): boolean {
  const finishedMs = new Date(run.finished_at).getTime();
  if (Number.isNaN(finishedMs)) return true;
  return now.getTime() - finishedMs > STALE_MS;
}

export function getSyncRuns(scope: AccountSourceScope): SyncRunRecord[] {
  return readAllRuns()
    .filter((run) => isSameScope(run, scope))
    .sort((a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime())
    .slice(0, MAX_RUNS_PER_SCOPE);
}

export function recordSyncRun(scope: AccountSourceScope, input: Omit<SyncRunInput, keyof AccountSourceScope>): SyncRunRecord {
  const normalizedScope = {
    account_id: scope.account_id.trim(),
    customer_id: scope.customer_id.trim(),
    source_sheet_id: scope.source_sheet_id.trim(),
  };

  const row = normalizeInput({
    ...input,
    ...normalizedScope,
    source: input.source || '',
    trigger_type: input.trigger_type || 'manual',
    error_message: input.error_message || null,
  } as SyncRunInput);

  const allRuns = readAllRuns().filter((run) => !isSameScope(run, normalizedScope));
  const updatedScopeRuns = [row, ...getSyncRuns(normalizedScope)];
  const nextRuns = [...allRuns, ...updatedScopeRuns]
    .sort((a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime())
    .slice(0, MAX_RUNS_PER_SCOPE * 5);
  writeAllRuns(nextRuns);
  return row;
}

export function clearSyncRuns(scope?: AccountSourceScope): void {
  if (!isStorageAvailable()) {
    if (!scope) {
      inMemoryRuns.length = 0;
      return;
    }
    const nextRuns = inMemoryRuns.filter((run) => !isSameScope(run, scope));
    inMemoryRuns.length = 0;
    inMemoryRuns.push(...nextRuns);
    return;
  }
  if (!scope) {
    localStorage.removeItem(SYNC_RUN_STORAGE_KEY);
    return;
  }
  const nextRuns = readAllRuns().filter((run) => !isSameScope(run, scope));
  writeAllRuns(nextRuns);
}

export function computeSyncRunIndicator(
  scope: AccountSourceScope,
  options: { now?: Date; running?: boolean } = {}
): SyncRunIndicator {
  const now = options.now ?? new Date();
  const runs = getSyncRuns(scope);

  if (options.running && runs.length > 0) {
    return {
      last_sync_at: runs[0].finished_at || null,
      sync_count_today: runs.filter((run) => nowIsoDateAt(new Date(run.started_at)) === nowIsoDateAt(now)).length,
      last_sync_status: 'running',
      last_error: null,
      source_sheet_id: scope.source_sheet_id,
      customer_id: scope.customer_id,
      account_id: scope.account_id,
    };
  }

  if (options.running && runs.length === 0) {
    return {
      last_sync_at: null,
      sync_count_today: 0,
      last_sync_status: 'running',
      last_error: null,
      source_sheet_id: scope.source_sheet_id,
      customer_id: scope.customer_id,
      account_id: scope.account_id,
    };
  }

  if (!runs.length) {
    return {
      last_sync_at: null,
      sync_count_today: 0,
      last_sync_status: 'never_synced',
      last_error: null,
      source_sheet_id: scope.source_sheet_id,
      customer_id: scope.customer_id,
      account_id: scope.account_id,
    };
  }

  const today = nowIsoDateAt(now);
  const sync_count_today = runs.filter((run) => nowIsoDateAt(new Date(run.started_at)) === today).length;
  const latest = runs[0];
  const statusFromData: SyncIndicatorStatus = latestStatus(runs) ?? 'never_synced';
  const stale = isStale(latest, now);

  return {
    last_sync_at: latest.finished_at || null,
    sync_count_today,
    last_sync_status: options.running ? 'running' : stale && statusFromData === 'success' ? 'stale' : statusFromData,
    last_error: statusFromData === 'warning' || statusFromData === 'failed' ? latest.error_message : null,
    source_sheet_id: scope.source_sheet_id,
    customer_id: scope.customer_id,
    account_id: scope.account_id,
  };
}
