import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type AccountSource, type ImportedData, type Settings } from '../../types';
import {
  buildProposalQueue,
  defaultProposalGuardrails,
  evaluateProposalGuardrails,
  rejectedOutOfScopeProposal,
  type ProposalQueueGuardrails,
} from '../proposalQueue';
import { computeSyncHealth } from '../syncHealth';

const account: AccountSource = {
  id: 'acct-source',
  account_id: 'acct-1',
  customer_id: '1234567890',
  account_name: 'Main account',
  spreadsheet_id: 'sheet-1',
  spreadsheet_url: '',
  sheet_tab_name: 'GoogleExport',
  timezone: 'Asia/Bangkok',
  currency: 'THB',
  enabled: true,
};

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...DEFAULT_SETTINGS,
    action_mode: 'dry_run',
    auto_bid_guardrails: {
      ...DEFAULT_SETTINGS.auto_bid_guardrails,
      dryRun: true,
      applyEnabled: false,
      maxBudgetChangePercent: 30,
    },
    max_daily_loss: 1000,
    account_sources: [account],
    selected_account_source_id: account.id,
    account_id: account.account_id,
    customer_id: account.customer_id,
    sheet_id: account.spreadsheet_id,
    ...overrides,
  };
}

function importedData(): ImportedData {
  const now = new Date().toISOString();
  return {
    campaigns: [
      {
        account_id: account.account_id,
        customer_id: account.customer_id,
        source_sheet_id: account.spreadsheet_id,
        date: now.slice(0, 10),
        campaign_id: 'camp-1',
        campaign_name: 'Profitable under-paced campaign',
        campaign_status: 'ENABLED',
        serving_status: 'SERVING',
        channel: 'SEARCH',
        bidding_strategy_type: 'MANUAL_CPC',
        campaign_start_date: now.slice(0, 10),
        campaign_end_date: '',
        daily_budget: 100,
        impressions: 1000,
        clicks: 50,
        cost: 50,
        ctr: 0.05,
        avg_cpc: 1,
        conversions: 5,
        all_conversions: 5,
        conversion_value: 250,
      },
    ],
    adGroups: [],
    keywords: [],
    searchTerms: [],
    hourDevice: [],
    policy: [],
    auctionCampaigns: [],
    auctionKeywords: [],
    voluum: [
      {
        account_id: account.account_id,
        customer_id: account.customer_id,
        source_sheet_id: account.spreadsheet_id,
        date: now.slice(0, 10),
        keyword_key: 'kw-1',
        campaign_id: 'camp-1',
        ad_group_id: 'adg-1',
        criterion_id: 'crit-1',
        voluum_visits: 100,
        voluum_clicks: 80,
        voluum_conversions: 8,
        revenue: 250,
        profit: 200,
        roi: 400,
      },
    ],
    syncLog: [
      {
        account_id: account.account_id,
        customer_id: account.customer_id,
        source_sheet_id: account.spreadsheet_id,
        run_id: 'run-1',
        started_at: now,
        finished_at: now,
        status: 'SUCCESS',
        duration_seconds: 12,
        trigger_type: 'manual',
        lookback_days: 7,
        tabs_updated: 1,
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
        script_version: 'test',
      },
    ],
    meta: {
      voluum: { rows: 1, importedAt: now, source: 'test' },
    },
  };
}

function guardrails(settingsValue: Settings, overrides: Partial<ProposalQueueGuardrails> = {}): ProposalQueueGuardrails {
  return {
    ...defaultProposalGuardrails(settingsValue),
    allowlistedCampaignIds: ['camp-1'],
    ...overrides,
  };
}

describe('proposalQueue guardrails', () => {
  it('builds only v1 campaign feed preview rows when guardrails pass', () => {
    const settingsValue = settings();
    const model = buildProposalQueue(importedData(), settingsValue, guardrails(settingsValue));

    expect(model.readyCount).toBe(1);
    expect(model.blockedCount).toBe(0);
    expect(model.feedPreview).toEqual([
      expect.objectContaining({
        account_id: 'acct-1',
        customer_id: '1234567890',
        source_sheet_id: 'sheet-1',
        action: 'SET_BUDGET',
        campaign_id: 'camp-1',
        mode: 'dry_run',
        token_hint: 'redacted',
        status: 'ready',
      }),
    ]);
    expect(model.proposals[0]).toMatchObject({
      remoteApplyAllowed: false,
      auditState: 'ready',
      rollbackValue: 100,
    });
  });

  it('requires a campaign allowlist before feed eligibility', () => {
    const settingsValue = settings();
    const model = buildProposalQueue(importedData(), settingsValue, defaultProposalGuardrails(settingsValue));

    expect(model.feedPreview).toEqual([]);
    expect(model.proposals[0].auditState).toBe('skipped_not_allowlisted');
  });

  it('lets denylist beat allowlist', () => {
    const settingsValue = settings();
    const model = buildProposalQueue(
      importedData(),
      settingsValue,
      guardrails(settingsValue, { denylistedCampaignIds: ['camp-1'] })
    );

    expect(model.feedPreview).toEqual([]);
    expect(model.proposals[0].auditState).toBe('skipped_denylisted');
  });

  it('fails closed when data is stale or action mode is disabled', () => {
    const settingsValue = settings();
    const staleData = importedData();
    staleData.syncLog[0].started_at = '2026-01-01T00:00:00.000Z';
    staleData.syncLog[0].finished_at = '2026-01-01T00:00:01.000Z';

    expect(buildProposalQueue(staleData, settingsValue, guardrails(settingsValue)).proposals[0].auditState)
      .toBe('skipped_stale_data');
    expect(buildProposalQueue(importedData(), settings({ action_mode: 'disabled' }), guardrails(settingsValue)).killSwitchOn)
      .toBe(true);
  });

  it('fails closed when Voluum profit data is stale or missing import metadata', () => {
    const settingsValue = settings();
    const staleVoluumData = importedData();
    staleVoluumData.meta.voluum = {
      rows: 1,
      importedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      source: 'test',
    };
    const unknownVoluumData = importedData();
    unknownVoluumData.meta = {};

    expect(buildProposalQueue(staleVoluumData, settingsValue, guardrails(settingsValue))).toMatchObject({
      freshnessStatus: 'STALE',
      readyCount: 0,
      feedPreview: [],
      voluumFreshnessStatus: 'STALE',
      proposals: [],
    });
    expect(buildProposalQueue(unknownVoluumData, settingsValue, guardrails(settingsValue))).toMatchObject({
      freshnessStatus: 'UNKNOWN',
      readyCount: 0,
      feedPreview: [],
      voluumFreshnessStatus: 'UNKNOWN',
      proposals: [],
    });
  });

  it('fails closed when imported Voluum data is stale', () => {
    const settingsValue = settings();
    const staleImportedAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const data = importedData();
    data.voluum = [
      {
        account_id: account.account_id,
        customer_id: account.customer_id,
        source_sheet_id: account.spreadsheet_id,
        date: new Date().toISOString().slice(0, 10),
        keyword_key: 'kw-1',
        campaign_id: 'camp-1',
        ad_group_id: 'adg-1',
        criterion_id: 'crit-1',
        voluum_visits: 50,
        voluum_clicks: 40,
        voluum_conversions: 6,
        revenue: 260,
        profit: 210,
        roi: 420,
      },
    ];
    data.meta = {
      voluum: {
        rows: 1,
        importedAt: staleImportedAt,
        source: 'csv',
      },
    };

    const model = buildProposalQueue(data, settingsValue, guardrails(settingsValue));

    expect(model.freshnessStatus).toBe('STALE');
    expect(model.voluumFreshnessStatus).toBe('STALE');
    expect(model.feedPreview).toEqual([]);
    expect(model.proposals).toEqual([]);
    expect(model.debugPacket).toContain('"voluum_freshness": "STALE"');
    expect(model.debugPacket).toContain('"voluum_stale_fail_closed": true');
  });

  it('fails closed when imported Voluum data has no import timestamp', () => {
    const settingsValue = settings();
    const data = importedData();
    data.meta = {};
    data.voluum = [
      {
        account_id: account.account_id,
        customer_id: account.customer_id,
        source_sheet_id: account.spreadsheet_id,
        date: new Date().toISOString().slice(0, 10),
        keyword_key: 'kw-1',
        campaign_id: 'camp-1',
        ad_group_id: 'adg-1',
        criterion_id: 'crit-1',
        voluum_visits: 50,
        voluum_clicks: 40,
        voluum_conversions: 6,
        revenue: 260,
        profit: 210,
        roi: 420,
      },
    ];

    const model = buildProposalQueue(data, settingsValue, guardrails(settingsValue));

    expect(model.freshnessStatus).toBe('UNKNOWN');
    expect(model.voluumFreshnessStatus).toBe('UNKNOWN');
    expect(model.feedPreview).toEqual([]);
    expect(model.proposals).toEqual([]);
    expect(model.debugPacket).toContain('"voluum_freshness": "UNKNOWN"');
  });

  it('requires dry-run mode with apply disabled for feed eligibility', () => {
    const settingsValue = settings();
    const syncHealth = computeSyncHealth(importedData().syncLog);
    const baseProposal = {
      id: 'manual',
      action: 'SET_BUDGET' as const,
      campaignId: 'camp-1',
      campaignName: 'Campaign',
      oldValue: 100,
      newValue: 110,
      expectedCurrentValue: 100,
      reason: 'manual test',
      risk: 'low' as const,
      approvalStatus: 'approved' as const,
      expiresAt: new Date().toISOString(),
      budgetIsShared: false,
      rollbackValue: 100,
      source: 'manual_review' as const,
      dryRunPreview: 'preview',
    };

    expect(evaluateProposalGuardrails(
      baseProposal,
      settings({ action_mode: 'manual_apply' }),
      syncHealth,
      guardrails(settingsValue)
    ).reasons[0]).toContain('dry_run is required');
    expect(evaluateProposalGuardrails(
      baseProposal,
      settings({ auto_bid_guardrails: { ...settingsValue.auto_bid_guardrails, applyEnabled: true } }),
      syncHealth,
      guardrails(settingsValue)
    ).reasons[0]).toContain('must remain disabled');
    expect(evaluateProposalGuardrails(
      baseProposal,
      settingsValue,
      syncHealth,
      guardrails(settingsValue),
      {
        google: 'OK',
        voluum: {
          status: 'STALE',
          rows: 1,
          importedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          staleFailClosed: true,
        },
        overall: 'STALE',
      }
    ).reasons[0]).toContain('Voluum freshness is STALE');
  });

  it('does not preview feed rows in manual apply mode or when apply is enabled', () => {
    const settingsValue = settings();

    expect(
      buildProposalQueue(
        importedData(),
        settings({ action_mode: 'manual_apply' }),
        guardrails(settingsValue)
      ).feedPreview
    ).toEqual([]);
    expect(
      buildProposalQueue(
        importedData(),
        settings({ auto_bid_guardrails: { ...settingsValue.auto_bid_guardrails, applyEnabled: true } }),
        guardrails(settingsValue)
      ).feedPreview
    ).toEqual([]);
  });

  it('rejects bid and negative-keyword actions from the v1 feed', () => {
    const rejectedBid = rejectedOutOfScopeProposal('SET_BID', 'Bid changes are not a campaign update v1 action.');
    const rejectedNegative = rejectedOutOfScopeProposal('ADD_NEGATIVE_KEYWORD', 'Task 5 candidates remain export-only.');

    expect(rejectedBid.guardrail.feedEligible).toBe(false);
    expect(rejectedBid.dryRunPreview).toContain('never written');
    expect(rejectedNegative.guardrail.reasons[0]).toContain('outside v1 apply scope');
  });

  it('caps budget delta, total delta, and actions per campaign', () => {
    const settingsValue = settings();
    const syncHealth = computeSyncHealth(importedData().syncLog);
    const baseProposal = {
      id: 'manual',
      action: 'SET_BUDGET' as const,
      campaignId: 'camp-1',
      campaignName: 'Campaign',
      oldValue: 100,
      newValue: 160,
      expectedCurrentValue: 100,
      reason: 'manual test',
      risk: 'high' as const,
      approvalStatus: 'approved' as const,
      expiresAt: new Date().toISOString(),
      budgetIsShared: false,
      rollbackValue: 100,
      source: 'manual_review' as const,
      dryRunPreview: 'preview',
    };

    expect(evaluateProposalGuardrails(baseProposal, settingsValue, syncHealth, guardrails(settingsValue)).state)
      .toBe('skipped_guardrail');
    expect(evaluateProposalGuardrails(
      { ...baseProposal, newValue: 110 },
      settingsValue,
      syncHealth,
      guardrails(settingsValue, { existingBudgetDeltaToday: 995 })
    ).state).toBe('skipped_guardrail');
    expect(evaluateProposalGuardrails(
      { ...baseProposal, newValue: 110 },
      settingsValue,
      syncHealth,
      guardrails(settingsValue, { existingActionsByCampaign: { 'camp-1': 10 } })
    ).state).toBe('skipped_guardrail');
  });
});
