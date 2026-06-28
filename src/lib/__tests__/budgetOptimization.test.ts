import { describe, expect, it } from 'vitest';
import type { AccountSource, CampaignRow, ImportedData, Settings, VoluumRow } from '../../types';
import { DEFAULT_SETTINGS } from '../../types';
import { buildBudgetOptimization } from '../budgetOptimization';

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
  return { ...DEFAULT_SETTINGS, target_cpa: 25, ...overrides };
}

function campaign(overrides: Partial<CampaignRow>): CampaignRow {
  return {
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
    conversions: 5,
    all_conversions: 5,
    conversion_value: 250,
    ...overrides,
  };
}

function accountSource(overrides: Partial<AccountSource> = {}): AccountSource {
  return {
    id: 'acct-a',
    account_id: 'acct-a',
    customer_id: 'cust-a',
    account_name: 'Account A',
    spreadsheet_id: 'sheet-a',
    spreadsheet_url: '',
    sheet_tab_name: 'GoogleExport',
    timezone: 'Asia/Bangkok',
    currency: 'THB',
    enabled: true,
    ...overrides,
  };
}

function voluum(overrides: Partial<VoluumRow> = {}): VoluumRow {
  return {
    date: '2026-06-01',
    keyword_key: 'kw-a',
    campaign_id: 'camp-a',
    ad_group_id: 'adg-a',
    criterion_id: 'crit-a',
    voluum_visits: 100,
    voluum_clicks: 90,
    voluum_conversions: 8,
    revenue: 400,
    profit: 300,
    roi: 300,
    ...overrides,
  };
}

function freshVoluumData(data: ImportedData): ImportedData {
  return {
    ...data,
    meta: {
      ...data.meta,
      voluum: { rows: data.voluum.length, importedAt: new Date().toISOString(), source: 'test' },
    },
  };
}

describe('budget optimization model', () => {
  it('computes pacing rows, forecasts, and true-profit from Voluum revenue', () => {
    const model = buildBudgetOptimization(
      freshVoluumData({ ...baseData, campaigns: [campaign({ cost: 50 }), campaign({ date: '2026-06-02', cost: 70 })], voluum: [voluum()] }),
      settings(),
      'balanced'
    );

    expect(model.rows[0]).toMatchObject({
      campaignId: 'camp-a',
      cost: 120,
      revenue: 400,
      profit: 280,
    });
    expect(model.next30Forecast).toBeGreaterThan(0);
    expect(model.profitCurve.length).toBeGreaterThan(0);
    expect(model.voluumFreshnessStatus).toBe('OK');
  });

  it('emits budget proposals only and never remote-apply rows', () => {
    const model = buildBudgetOptimization(
      freshVoluumData({
        ...baseData,
        campaigns: [campaign({ cost: 20, daily_budget: 100, conversion_value: 200, conversions: 10 })],
        voluum: [voluum({ revenue: 220, voluum_conversions: 12 })],
      }),
      settings(),
      'aggressive'
    );

    expect(model.proposals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ proposalOnly: true, remoteApplyAllowed: false }),
      ])
    );
    expect(JSON.stringify(model.proposals)).not.toMatch(/remoteApplyAllowed":true/);
  });

  it('only emits budget proposals when profit safety rules allow a change', () => {
    const unsafeScale = buildBudgetOptimization(
      freshVoluumData({
        ...baseData,
        campaigns: [campaign({ cost: 20, daily_budget: 100, conversion_value: 200, conversions: 1 })],
        voluum: [voluum({ revenue: 200, voluum_conversions: 1 })],
      }),
      settings({ target_cpa: 10 }),
      'aggressive'
    );

    expect(unsafeScale.rows[0]).toMatchObject({
      status: 'under',
      recommendedBudget: 100,
      reason: 'Keep budget under review.',
    });
    expect(unsafeScale.proposals).toEqual([]);

    const profitableOverPacing = buildBudgetOptimization(
      freshVoluumData({
        ...baseData,
        campaigns: [campaign({ cost: 200, daily_budget: 100, conversion_value: 500, conversions: 10 })],
        voluum: [voluum({ revenue: 500, voluum_conversions: 10 })],
      }),
      settings(),
      'aggressive'
    );

    expect(profitableOverPacing.rows[0]).toMatchObject({
      status: 'over',
      recommendedBudget: 100,
      reason: 'Keep budget under review.',
    });
    expect(profitableOverPacing.proposals).toEqual([]);
  });

  it('caps profitable scale-up proposals by budget guardrails', () => {
    const model = buildBudgetOptimization(
      freshVoluumData({
        ...baseData,
        campaigns: [campaign({ cost: 20, daily_budget: 100, conversion_value: 300, conversions: 10 })],
        voluum: [voluum({ revenue: 300, voluum_conversions: 10 })],
      }),
      settings({
        auto_bid_guardrails: {
          ...DEFAULT_SETTINGS.auto_bid_guardrails,
          maxBudgetChangePercent: 12,
        },
      }),
      'aggressive'
    );

    expect(model.proposals).toHaveLength(1);
    expect(model.proposals[0]).toMatchObject({
      currentBudget: 100,
      proposedBudget: 112,
      deltaPercent: 12,
      proposalOnly: true,
      remoteApplyAllowed: false,
    });
  });

  it('fails closed and suppresses proposals when Voluum import metadata is stale or unknown', () => {
    const staleImportedAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const staleModel = buildBudgetOptimization(
      {
        ...baseData,
        campaigns: [campaign({ cost: 20, daily_budget: 100, conversion_value: 10, conversions: 1 })],
        voluum: [voluum({ revenue: 300, voluum_conversions: 10 })],
        meta: { voluum: { rows: 1, importedAt: staleImportedAt, source: 'test' } },
      },
      settings(),
      'aggressive'
    );
    const unknownModel = buildBudgetOptimization(
      { ...baseData, campaigns: [campaign({ cost: 20 })], voluum: [voluum({ revenue: 300, voluum_conversions: 10 })] },
      settings(),
      'aggressive'
    );

    expect(staleModel.voluumFreshnessStatus).toBe('STALE');
    expect(staleModel.staleFailClosed).toBe(true);
    expect(staleModel.proposals).toEqual([]);
    expect(staleModel.rows[0]).toMatchObject({ revenue: 10, profit: -10 });
    expect(unknownModel.voluumFreshnessStatus).toBe('UNKNOWN');
    expect(unknownModel.proposals).toEqual([]);
  });

  it('filters campaign and Voluum rows to the selected account source', () => {
    const sourceA = accountSource();
    const sourceB = accountSource({
      id: 'acct-b',
      account_id: 'acct-b',
      customer_id: 'cust-b',
      account_name: 'Account B',
      spreadsheet_id: 'sheet-b',
    });
    const scopedSettings = settings({
      account_sources: [sourceA, sourceB],
      selected_account_source_id: sourceA.id,
    });

    const model = buildBudgetOptimization(
      freshVoluumData({
        ...baseData,
        campaigns: [
          campaign({
            account_id: 'acct-a',
            customer_id: 'cust-a',
            source_sheet_id: 'sheet-a',
            campaign_id: 'shared-campaign',
            cost: 50,
            conversion_value: 125,
          }),
          campaign({
            account_id: 'acct-b',
            customer_id: 'cust-b',
            source_sheet_id: 'sheet-b',
            campaign_id: 'shared-campaign',
            cost: 500,
            conversion_value: 1000,
          }),
        ],
        voluum: [
          voluum({
            account_id: 'acct-b',
            customer_id: 'cust-b',
            source_sheet_id: 'sheet-b',
            campaign_id: 'shared-campaign',
            revenue: 9999,
            voluum_conversions: 99,
          }),
        ],
      }),
      scopedSettings
    );

    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]).toMatchObject({
      campaignId: 'shared-campaign',
      cost: 50,
      revenue: 125,
      profit: 75,
    });
  });

  it('keeps profit curve zones and breakeven CPA model local', () => {
    const model = buildBudgetOptimization(
      { ...baseData, campaigns: [campaign({ cost: 100, conversions: 4, conversion_value: 160 })] },
      settings({ target_cpa: 30 })
    );

    expect(model.profitCurve.some((point) => point.zone === 'optimal' || point.zone === 'breakeven')).toBe(true);
    expect(model.optimalCost).toBeGreaterThan(0);
  });
});
