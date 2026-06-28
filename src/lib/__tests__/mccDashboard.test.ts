import { describe, expect, it } from 'vitest';
import type { CampaignRow, GoogleSyncLogRow, ImportedData, Settings, VoluumRow } from '../../types';
import { DEFAULT_SETTINGS } from '../../types';
import { buildMccDashboard } from '../mccDashboard';

const baseData: ImportedData = {
  campaigns: [],
  adGroups: [],
  keywords: [],
  searchTerms: [],
  hourDevice: [],
  policy: [],
  auctionCampaigns: [],
  auctionKeywords: [],
  voluum: [],
  syncLog: [],
  meta: {},
};

function settings(overrides: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, currency: 'THB', ...overrides };
}

function campaign(overrides: Partial<CampaignRow>): CampaignRow {
  return {
    account_id: 'acct-a',
    customer_id: 'cust-a',
    source_sheet_id: 'sheet-a',
    date: '2026-06-01',
    campaign_id: 'camp-a',
    campaign_name: 'Campaign A',
    campaign_status: 'ENABLED',
    serving_status: 'SERVING',
    channel: 'SEARCH',
    bidding_strategy_type: 'MANUAL_CPC',
    campaign_start_date: '',
    campaign_end_date: '',
    daily_budget: 100,
    impressions: 1000,
    clicks: 100,
    cost: 100,
    ctr: 0.1,
    avg_cpc: 1,
    conversions: 4,
    all_conversions: 4,
    conversion_value: 160,
    ...overrides,
  };
}

function voluum(overrides: Partial<VoluumRow>): VoluumRow {
  return {
    account_id: 'acct-a',
    customer_id: 'cust-a',
    source_sheet_id: 'sheet-a',
    date: '2026-06-01',
    keyword_key: 'kw-a',
    campaign_id: 'camp-a',
    ad_group_id: 'adg-a',
    criterion_id: 'crit-a',
    voluum_visits: 50,
    voluum_clicks: 40,
    voluum_conversions: 5,
    revenue: 250,
    profit: 150,
    roi: 150,
    ...overrides,
  };
}

function syncLog(overrides: Partial<GoogleSyncLogRow> = {}): GoogleSyncLogRow {
  const now = new Date().toISOString();
  return {
    account_id: 'acct-a',
    customer_id: 'cust-a',
    source_sheet_id: 'sheet-a',
    run_id: 'run-a',
    started_at: now,
    finished_at: now,
    status: 'SUCCESS',
    duration_seconds: 60,
    trigger_type: 'timer',
    lookback_days: 1,
    tabs_updated: 8,
    campaign_rows: 1,
    adgroup_rows: 0,
    keyword_rows: 0,
    search_term_rows: 0,
    hour_device_rows: 0,
    policy_rows: 0,
    auction_campaign_rows: 0,
    auction_keyword_rows: 0,
    voluum_rows: 1,
    error_message: '',
    script_version: 'tm3-test',
    ...overrides,
  };
}

describe('MCC dashboard model', () => {
  it('builds account rows and summary cards from scoped Google and Voluum data', () => {
    const model = buildMccDashboard(
      {
        ...baseData,
        campaigns: [
          campaign({ date: '2026-06-01', cost: 100, conversions: 2, conversion_value: 80 }),
          campaign({ date: '2026-06-02', cost: 200, conversions: 3, conversion_value: 120 }),
        ],
        voluum: [voluum({ revenue: 450, voluum_conversions: 9 })],
        syncLog: [syncLog()],
        meta: { voluum: { rows: 1, importedAt: new Date().toISOString(), source: 'test' } },
      },
      settings({ target_cpa: 40 })
    );

    expect(model.visibleActionMode).toBe('review_only');
    expect(model.hasVoluum).toBe(true);
    expect(model.accountRows).toHaveLength(1);
    expect(model.accountRows[0]).toMatchObject({
      accountId: 'acct-a',
      customerId: 'cust-a',
      sourceSheetId: 'sheet-a',
      cost: 300,
      conversions: 9,
      revenue: 450,
      cpa: 300 / 9,
    });
    expect(model.summaryCards.find((card) => card.id === 'true_value')?.displayValue).toBe('THB 450.00');
    expect(model.summaryCards.find((card) => card.id === 'projected_month_spend')?.value).toBe(4500);
    expect(model.freshness.find((item) => item.id === 'voluum')).toMatchObject({ status: 'OK', tone: 'ok' });
  });

  it('fails closed on stale Google sync and exposes diagnostics drill links', () => {
    const staleStartedAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const model = buildMccDashboard(
      {
        ...baseData,
        campaigns: [campaign({ cost: 120, conversions: 0, conversion_value: 0 })],
        syncLog: [syncLog({ started_at: staleStartedAt, finished_at: staleStartedAt })],
      },
      settings({ min_cost_to_decide: 25 })
    );

    expect(model.freshness.find((item) => item.id === 'google')).toMatchObject({
      status: 'STALE',
      tone: 'warn',
    });
    expect(model.accountRows[0].alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'stale_google_sync', drillHref: '/diagnostics' }),
        expect.objectContaining({ id: 'cost_no_conversion', drillHref: '/search-terms' }),
      ])
    );
  });

  it('limits sparklines to the latest 30 sorted daily cost points', () => {
    const rows = Array.from({ length: 35 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 4, index + 1)).toISOString().slice(0, 10);
      return campaign({ date, cost: index + 1 });
    });
    const model = buildMccDashboard({ ...baseData, campaigns: rows, syncLog: [syncLog()] }, settings());

    expect(model.accountRows[0].sparkline).toHaveLength(30);
    expect(model.accountRows[0].sparkline[0]).toEqual({ date: '2026-05-06', cost: 6 });
    expect(model.accountRows[0].sparkline[29]).toEqual({ date: '2026-06-04', cost: 35 });
  });

  it('flags missing account scope and keeps model free of secret-like settings values', () => {
    const model = buildMccDashboard(
      {
        ...baseData,
        campaigns: [campaign({ account_id: undefined, customer_id: undefined, source_sheet_id: undefined })],
        syncLog: [syncLog()],
      },
      settings({ sheet_id: '', account_id: '', customer_id: '' })
    );
    const serialized = JSON.stringify(model);

    expect(model.accountRows[0].alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'missing_scope', drillHref: '/settings' }),
      ])
    );
    expect(serialized).not.toMatch(/service[-_ ]?role|refresh[-_ ]?token|client[-_ ]?secret/i);
  });

  it('surfaces Voluum as optional when rows are absent', () => {
    const model = buildMccDashboard(
      { ...baseData, campaigns: [campaign({ cost: 50, conversions: 2, conversion_value: 120 })], syncLog: [syncLog()] },
      settings()
    );

    expect(model.freshness.find((item) => item.id === 'voluum')).toMatchObject({
      status: 'OPTIONAL',
      rows: 0,
      tone: 'safe',
    });
    expect(model.accountRows[0].alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'no_voluum', drillHref: '/voluum' }),
      ])
    );
  });

  it('fails closed on stale Voluum import metadata when Voluum rows exist', () => {
    const staleImportedAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const model = buildMccDashboard(
      {
        ...baseData,
        campaigns: [campaign({ cost: 120, conversions: 4, conversion_value: 140 })],
        voluum: [voluum({ revenue: 280, voluum_conversions: 7 })],
        syncLog: [syncLog()],
        meta: {
          voluum: {
            rows: 1,
            importedAt: staleImportedAt,
            source: 'csv',
          },
        },
      },
      settings()
    );

    expect(model.freshness.find((item) => item.id === 'voluum')).toMatchObject({
      status: 'STALE',
      rows: 1,
      tone: 'warn',
      lastAt: staleImportedAt,
    });
    expect(model.accountRows[0].alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'stale_voluum_sync', drillHref: '/diagnostics' }),
      ])
    );
  });

  it('fails closed when Voluum rows are stale or missing import metadata', () => {
    const staleImportedAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const staleModel = buildMccDashboard(
      {
        ...baseData,
        campaigns: [campaign({ cost: 100, conversions: 2, conversion_value: 120 })],
        voluum: [voluum({ revenue: 500, voluum_conversions: 10 })],
        syncLog: [syncLog()],
        meta: { voluum: { rows: 1, importedAt: staleImportedAt, source: 'test' } },
      },
      settings()
    );
    const unknownModel = buildMccDashboard(
      {
        ...baseData,
        campaigns: [campaign({ cost: 100, conversions: 2, conversion_value: 120 })],
        voluum: [voluum({ revenue: 500, voluum_conversions: 10 })],
        syncLog: [syncLog()],
      },
      settings()
    );

    expect(staleModel.freshness.find((item) => item.id === 'voluum')).toMatchObject({
      status: 'STALE',
      tone: 'warn',
    });
    expect(staleModel.accountRows[0]).toMatchObject({ conversions: 2, revenue: 120 });
    expect(staleModel.accountRows[0].alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'stale_voluum_sync', drillHref: '/diagnostics' }),
      ])
    );
    expect(unknownModel.freshness.find((item) => item.id === 'voluum')).toMatchObject({
      status: 'UNKNOWN',
      tone: 'missing',
    });
  });
});
