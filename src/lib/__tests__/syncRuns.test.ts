import { beforeEach, describe, expect, it } from 'vitest';
import { clearSyncRuns, computeSyncRunIndicator, getSyncRuns, recordSyncRun } from '../syncRuns';

const scopeA = {
  account_id: 'acct-a',
  customer_id: '1111111111',
  source_sheet_id: 'sheet-a',
};

const scopeB = {
  account_id: 'acct-b',
  customer_id: '2222222222',
  source_sheet_id: 'sheet-b',
};

beforeEach(() => {
  clearSyncRuns();
});

describe('syncRuns local model and indicators', () => {
  it('returns never_synced indicator when no runs exist', () => {
    const indicator = computeSyncRunIndicator(scopeA, { now: new Date('2026-06-27T00:00:00.000Z') });

    expect(indicator).toMatchObject({
      last_sync_at: null,
      sync_count_today: 0,
      last_sync_status: 'never_synced',
      last_error: null,
      source_sheet_id: 'sheet-a',
      customer_id: '1111111111',
      account_id: 'acct-a',
    });
  });

  it('keeps sync runs isolated by account/customer/source_sheet', () => {
    recordSyncRun(scopeA, {
      started_at: '2026-06-27T00:00:00.000Z',
      finished_at: '2026-06-27T00:01:00.000Z',
      status: 'success',
      rows_imported: 100,
      tabs_updated: 9,
      error_message: null,
      trigger_type: 'manual',
      source: 'sheet:sheet-a',
    });

    recordSyncRun(scopeB, {
      started_at: '2026-06-27T00:05:00.000Z',
      finished_at: '2026-06-27T00:06:00.000Z',
      status: 'failed',
      rows_imported: 20,
      tabs_updated: 1,
      error_message: 'Credential failure',
      trigger_type: 'manual',
      source: 'sheet:sheet-b',
    });

    expect(getSyncRuns(scopeA)).toHaveLength(1);
    expect(getSyncRuns(scopeB)).toHaveLength(1);
    expect(getSyncRuns(scopeA)[0]).toMatchObject({
      status: 'success',
      account_id: 'acct-a',
      source_sheet_id: 'sheet-a',
    });
    expect(getSyncRuns(scopeB)[0]).toMatchObject({
      status: 'failed',
      account_id: 'acct-b',
      source_sheet_id: 'sheet-b',
    });
  });

  it('computes sync indicator from latest scoped run and tracks daily count', () => {
    recordSyncRun(scopeA, {
      started_at: '2026-06-27T00:00:00.000Z',
      finished_at: '2026-06-27T00:01:00.000Z',
      status: 'success',
      rows_imported: 120,
      tabs_updated: 9,
      error_message: null,
      trigger_type: 'manual',
      source: 'sheet:sheet-a',
    });
    recordSyncRun(scopeA, {
      started_at: '2026-06-26T23:50:00.000Z',
      finished_at: '2026-06-26T23:51:00.000Z',
      status: 'warning',
      rows_imported: 60,
      tabs_updated: 4,
      error_message: 'Missing optional sheet',
      trigger_type: 'manual',
      source: 'sheet:sheet-a',
    });
    const indicator = computeSyncRunIndicator(scopeA, { now: new Date('2026-06-27T00:30:00.000Z') });

    expect(indicator.sync_count_today).toBe(1);
    expect(indicator.last_sync_status).toBe('success');
    expect(indicator.last_error).toBeNull();
    expect(indicator.last_sync_at).toBe('2026-06-27T00:01:00.000Z');
  });

  it('marks stale and failed states correctly', () => {
    recordSyncRun(scopeA, {
      started_at: '2026-06-27T00:00:00.000Z',
      finished_at: '2026-06-27T00:01:00.000Z',
      status: 'success',
      rows_imported: 10,
      tabs_updated: 1,
      error_message: null,
      trigger_type: 'manual',
      source: 'sheet:sheet-a',
    });
    recordSyncRun(scopeA, {
      started_at: '2026-06-27T00:10:00.000Z',
      finished_at: '2026-06-27T00:11:00.000Z',
      status: 'failed',
      rows_imported: 0,
      tabs_updated: 0,
      error_message: 'Manual sync failed',
      trigger_type: 'manual',
      source: 'sheet:sheet-a',
    });

    const stale = computeSyncRunIndicator(scopeA, { now: new Date('2026-06-27T12:00:00.000Z') });
    const failed = computeSyncRunIndicator(scopeA);

    expect(failed.last_sync_status).toBe('failed');
    expect(failed.last_error).toBe('Manual sync failed');
    expect(stale.last_sync_status).toBe('failed');
  });
});
