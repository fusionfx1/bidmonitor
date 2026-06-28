import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  type AccountSource,
  type BidActionFeedRow,
  type BidDecision,
  type KeywordRow,
  type Settings,
} from '../../types';
import {
  buildDryRunFeedRows,
  isV1CampaignDryRunFeedRow,
  publishDryRunFeedRows,
  scopedFeedQuery,
  type BidActionFeedInsert,
} from '../autoBidFeed';

const accountA: AccountSource = {
  id: 'source-a',
  account_id: 'acct-a',
  customer_id: '1111111111',
  account_name: 'Account A',
  spreadsheet_id: 'sheet-a',
  spreadsheet_url: '',
  sheet_tab_name: 'GoogleExport',
  timezone: 'Asia/Bangkok',
  currency: 'THB',
  enabled: true,
};

const accountB: AccountSource = {
  ...accountA,
  id: 'source-b',
  account_id: 'acct-b',
  customer_id: '2222222222',
  account_name: 'Account B',
  spreadsheet_id: 'sheet-b',
};

const baseDecision: BidDecision = {
  keyword_key: 'camp-1|ag-1|crit-1|exact',
  campaign: 'Campaign One',
  ad_group: 'Ad Group One',
  keyword: 'blue widget',
  match_type: 'EXACT',
  current_bid: 1,
  recommended_bid: 1.1,
  cost: 100,
  clicks: 50,
  google_conversions: 4,
  voluum_conversions: 0,
  used_conversions: 4,
  revenue: 200,
  profit: 100,
  roi: 100,
  cpa: 25,
  search_impression_share: 0.6,
  rank_lost: 0.35,
  absolute_top_rate: 0.2,
  bid_signal: 'rank_limited',
  action: 'INCREASE_BID',
  reason: 'Good CPA but rank-limited.',
  approval_status: 'APPROVED',
};

const baseKeyword: KeywordRow = {
  date: '2026-06-27',
  device: 'DESKTOP',
  keyword_key: baseDecision.keyword_key,
  campaign_id: 'camp-1',
  campaign_name: baseDecision.campaign,
  bidding_strategy_type: 'MANUAL_CPC',
  ad_group_id: 'ag-1',
  ad_group_name: baseDecision.ad_group,
  criterion_id: 'crit-1',
  keyword: baseDecision.keyword,
  match_type: baseDecision.match_type,
  keyword_status: 'ENABLED',
  keyword_cpc_bid: 1,
  impressions: 1000,
  clicks: 50,
  cost: 100,
  ctr: 0.05,
  avg_cpc: 2,
  conversions: 4,
  all_conversions: 4,
  conversion_value: 200,
};

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...DEFAULT_SETTINGS,
    action_mode: 'dry_run',
    auto_bid_guardrails: {
      ...DEFAULT_SETTINGS.auto_bid_guardrails,
      maxChangePercent: 25,
      dryRun: true,
      applyEnabled: false,
      ...overrides.auto_bid_guardrails,
    },
    account_id: 'acct-1',
    customer_id: '1234567890',
    sheet_id: 'sheet-1',
    account_sources: [accountA],
    selected_account_source_id: accountA.id,
    ...overrides,
  };
}

describe('buildDryRunFeedRows', () => {
  it('does not publish when action mode is review_only', () => {
    const result = buildDryRunFeedRows([baseDecision], [baseKeyword], settings({ action_mode: 'review_only' }));

    expect(result.rows).toEqual([]);
    expect(result.skipped[0]).toMatchObject({
      keyword_key: baseDecision.keyword_key,
      reason: 'Action mode is not dry_run.',
    });
  });

  it('does not build v1 feed rows from legacy bid decisions', () => {
    const result = buildDryRunFeedRows([baseDecision], [baseKeyword], settings());

    expect(result.rows).toEqual([]);
    expect(result.skipped[0]).toMatchObject({
      keyword_key: baseDecision.keyword_key,
      reason: 'Legacy bid decision feed is disabled; use the campaign proposal queue.',
    });
  });

  it('does not publish global rows when account scope is missing', () => {
    const result = buildDryRunFeedRows(
      [baseDecision],
      [baseKeyword],
      settings({ account_id: '', customer_id: '', sheet_id: '', account_sources: [], selected_account_source_id: '' })
    );

    expect(result.rows).toEqual([]);
    expect(result.skipped[0]).toMatchObject({
      keyword_key: baseDecision.keyword_key,
      reason: 'Account ID, customer ID, and source sheet ID are required.',
    });
  });

  it('scopes generated rows to the selected account source', () => {
    const result = buildDryRunFeedRows(
      [baseDecision],
      [baseKeyword],
      settings({ account_sources: [accountA, accountB], selected_account_source_id: accountB.id })
    );

    expect(result.rows).toEqual([]);
    expect(result.skipped[0]).toMatchObject({
      keyword_key: baseDecision.keyword_key,
      reason: 'Legacy bid decision feed is disabled; use the campaign proposal queue.',
    });
  });
});

describe('scopedFeedQuery', () => {
  it('filters feed queries by selected account scope and v1 feed contract', () => {
    const query = scopedFeedQuery('bid_action_feed', {
      account_id: 'acct-a',
      customer_id: '1111111111',
      source_sheet_id: 'sheet-a',
    });

    expect(query).toContain('account_id=eq.acct-a&customer_id=eq.1111111111&source_sheet_id=eq.sheet-a');
    expect(query).toContain('status=eq.ready');
    expect(query).toContain('mode=eq.dry_run');
    expect(query).toContain('entity_level=eq.campaign');
    expect(query).toContain('action=in.(SET_BUDGET,PAUSE_CAMPAIGN,ENABLE_CAMPAIGN,SET_CAMPAIGN_LABEL)');
  });

  it('filters log queries by selected account scope without feed-only gates', () => {
    const query = scopedFeedQuery('bid_action_log', {
      account_id: 'acct-b',
      customer_id: '2222222222',
      source_sheet_id: 'sheet-b',
    });

    expect(query).toContain('account_id=eq.acct-b&customer_id=eq.2222222222&source_sheet_id=eq.sheet-b');
    expect(query).not.toContain('status=eq.ready');
  });

  it('rejects legacy SET_BID rows from frontend feed reads', () => {
    const readyCampaignRow: BidActionFeedRow = {
      id: 'feed-1',
      account_id: 'acct-a',
      customer_id: '1111111111',
      source_sheet_id: 'sheet-a',
      entity_level: 'campaign',
      keyword_key: null,
      campaign_id: 'camp-1',
      ad_group_id: null,
      criterion_id: null,
      campaign_name: 'Campaign One',
      ad_group_name: null,
      keyword: null,
      match_type: null,
      action: 'SET_BUDGET',
      expected_current_bid: null,
      target_bid: null,
      expected_current_budget: 100,
      target_budget: 110,
      budget_is_shared: false,
      reason: 'safe budget dry-run',
      mode: 'dry_run',
      status: 'ready',
      created_at: '2026-06-28T00:00:00.000Z',
      picked_at: null,
      applied_at: null,
    };
    const legacySetBidRow = {
      ...readyCampaignRow,
      id: 'legacy-set-bid',
      entity_level: 'keyword',
      keyword_key: 'camp-1|ag-1|crit-1|exact',
      action: 'SET_BID',
      expected_current_bid: 1,
      target_bid: 1.1,
      expected_current_budget: null,
      target_budget: null,
    } as unknown as BidActionFeedRow;

    expect(isV1CampaignDryRunFeedRow(readyCampaignRow)).toBe(true);
    expect(isV1CampaignDryRunFeedRow(legacySetBidRow)).toBe(false);
  });

  it('refuses to publish runtime legacy SET_BID rows', async () => {
    const legacySetBidInsert = {
      account_id: 'acct-a',
      customer_id: '1111111111',
      source_sheet_id: 'sheet-a',
      entity_level: 'keyword',
      keyword_key: 'camp-1|ag-1|crit-1|exact',
      campaign_id: 'camp-1',
      ad_group_id: 'ag-1',
      criterion_id: 'crit-1',
      campaign_name: 'Campaign One',
      ad_group_name: 'Ad Group One',
      keyword: 'blue widget',
      match_type: 'EXACT',
      action: 'SET_BID',
      expected_current_bid: 1,
      target_bid: 1.1,
      expected_current_budget: null,
      target_budget: null,
      budget_is_shared: false,
      reason: 'legacy bid path',
      mode: 'dry_run',
      status: 'ready',
      picked_at: null,
      applied_at: null,
    } as unknown as BidActionFeedInsert;

    await expect(publishDryRunFeedRows([legacySetBidInsert])).rejects.toThrow(
      'Refusing to publish non-v1 dry-run campaign feed rows.'
    );
  });
});
