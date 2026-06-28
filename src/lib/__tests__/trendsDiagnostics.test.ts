import { describe, expect, it } from 'vitest';
import type { AuctionCampaignRow, CampaignRow, GoogleSyncLogRow, ImportedData, Settings } from '../../types';
import { DEFAULT_SETTINGS } from '../../types';
import { buildDiagnosticsModel, buildTrendModel } from '../trendsDiagnostics';

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
  return { ...DEFAULT_SETTINGS, target_cpa: 25, min_clicks: 10, min_cost_to_decide: 50, ...overrides };
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

function syncLog(overrides: Partial<GoogleSyncLogRow> = {}): GoogleSyncLogRow {
  const now = new Date().toISOString();
  return {
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
    voluum_rows: 0,
    error_message: '',
    script_version: 'tm4-test',
    ...overrides,
  };
}

describe('trends diagnostics model', () => {
  it('computes daily rows, metric cards, moving averages, and pacing', () => {
    const campaigns = Array.from({ length: 30 }, (_, index) =>
      campaign({
        date: new Date(Date.UTC(2026, 5, index + 1)).toISOString().slice(0, 10),
        cost: 10,
        clicks: 20,
        conversions: 2,
        conversion_value: 50,
      })
    );
    const model = buildTrendModel(
      {
        ...baseData,
        campaigns,
        auctionCampaigns: [
          { search_rank_lost_impression_share: 0.3, search_budget_lost_impression_share: 0.1 } as AuctionCampaignRow,
          { search_rank_lost_impression_share: 0.1, search_budget_lost_impression_share: 0.4 } as AuctionCampaignRow,
        ],
      },
      settings(),
      { preset: '30d', includeAllCampaigns: true }
    );

    expect(model.dailyRows).toHaveLength(30);
    expect(model.dailyRows[6].costMa7).toBe(10);
    expect(model.dailyRows[27].costMa28).toBe(10);
    expect(model.metricCards.find((card) => card.id === 'cpa')?.displayValue).toBe('THB 5.00');
    expect(model.pacing.projectedMonthSpend).toBe(300);
    expect(model.pacing.rankLostCampaigns).toBe(1);
    expect(model.pacing.budgetLostCampaigns).toBe(1);
  });

  it('classifies campaign winners, losers, and insufficient data', () => {
    const model = buildTrendModel(
      {
        ...baseData,
        campaigns: [
          campaign({ campaign_id: 'winner', campaign_name: 'Winner', cost: 100, clicks: 100, conversions: 10, conversion_value: 500 }),
          campaign({ campaign_id: 'loser', campaign_name: 'Loser', cost: 100, clicks: 100, conversions: 1, conversion_value: 10 }),
          campaign({ campaign_id: 'thin', campaign_name: 'Thin', cost: 5, clicks: 1, conversions: 0, conversion_value: 0 }),
        ],
      },
      settings()
    );

    expect(model.campaignSummaries.find((row) => row.campaignId === 'winner')?.verdict).toBe('winner');
    expect(model.campaignSummaries.find((row) => row.campaignId === 'loser')?.verdict).toBe('loser');
    expect(model.campaignSummaries.find((row) => row.campaignId === 'thin')?.verdict).toBe('insufficient');
  });

  it('builds diagnostics prompt/debug packet and fails closed on stale sync', () => {
    const staleAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const campaigns = Array.from({ length: 14 }, (_, index) =>
      campaign({
        date: new Date(Date.UTC(2026, 5, index + 1)).toISOString().slice(0, 10),
        cost: index < 7 ? 10 : 20,
        clicks: 20,
        conversions: index < 7 ? 2 : 0,
        conversion_value: index < 7 ? 80 : 0,
      })
    );

    const model = buildDiagnosticsModel(
      { ...baseData, campaigns, syncLog: [syncLog({ started_at: staleAt, finished_at: staleAt })] },
      settings()
    );

    expect(model.staleFailClosed).toBe(true);
    expect(model.recommendedAction).toContain('Stop scaling decisions');
    expect(model.copyPrompt).toContain('Do not suggest direct Google Ads API writes');
    expect(model.debugPacket).toContain('"action_mode": "review_only"');
    expect(model.debugPacket).not.toMatch(/service[-_ ]?role|refresh[-_ ]?token|client[-_ ]?secret/i);
  });
});
