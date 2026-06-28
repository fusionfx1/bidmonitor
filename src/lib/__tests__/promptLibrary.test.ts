import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type CampaignRow, type ImportedData, type SearchTermRow, type Settings } from '../../types';
import { buildPromptLibrary, generatePrompt, PROMPT_CARDS } from '../promptLibrary';

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
  return {
    ...DEFAULT_SETTINGS,
    currency: 'THB',
    target_cpa: 25,
    action_mode: 'review_only',
    ...overrides,
  };
}

function campaign(overrides: Partial<CampaignRow> = {}): CampaignRow {
  return {
    date: '2026-06-20',
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
    clicks: 80,
    cost: 120,
    ctr: 0.08,
    avg_cpc: 1.5,
    conversions: 4,
    all_conversions: 4,
    conversion_value: 240,
    ...overrides,
  };
}

function searchTerm(overrides: Partial<SearchTermRow> = {}): SearchTermRow {
  return {
    date: '2026-06-20',
    campaign_id: 'camp-a',
    campaign_name: 'Campaign A',
    ad_group_id: 'ag-a',
    ad_group_name: 'Ad Group A',
    search_term: 'free support login',
    search_term_status: 'ADDED',
    impressions: 500,
    clicks: 40,
    cost: 80,
    ctr: 0.08,
    avg_cpc: 2,
    conversions: 0,
    all_conversions: 0,
    conversion_value: 0,
    ...overrides,
  };
}

function importedData(): ImportedData {
  const now = new Date().toISOString();
  return {
    ...baseData,
    campaigns: [
      campaign({ date: '2026-06-18', cost: 60, conversions: 2, conversion_value: 120 }),
      campaign({ date: '2026-06-20', cost: 120, conversions: 4, conversion_value: 240 }),
    ],
    searchTerms: [searchTerm()],
    syncLog: [
      {
        run_id: 'run-1',
        started_at: now,
        finished_at: now,
        status: 'SUCCESS',
        duration_seconds: 10,
        trigger_type: 'manual',
        lookback_days: 7,
        tabs_updated: 2,
        campaign_rows: 2,
        adgroup_rows: 0,
        keyword_rows: 0,
        search_term_rows: 1,
        hour_device_rows: 0,
        policy_rows: 0,
        auction_campaign_rows: 0,
        auction_keyword_rows: 0,
        voluum_rows: 0,
        error_message: '',
        script_version: 'test',
      },
    ],
  };
}

describe('prompt library', () => {
  it('filters prompt cards by category and text search', () => {
    const categoryModel = buildPromptLibrary(importedData(), settings(), 'negative_keywords', { category: 'Keywords' });
    const searchModel = buildPromptLibrary(importedData(), settings(), 'budget_optimization', { query: 'budget' });

    expect(categoryModel.cards.every((card) => card.category === 'Keywords')).toBe(true);
    expect(searchModel.cards.map((card) => card.id)).toContain('budget_optimization');
  });

  it('generates prompts with account context, metric citations, and safety constraints', () => {
    const card = PROMPT_CARDS.find((item) => item.id === 'negative_keywords');
    expect(card).toBeDefined();

    const generated = generatePrompt(card!, importedData(), settings());

    expect(generated.prompt).toContain('Metric table (cite these ids in every conclusion):');
    expect(generated.prompt).toContain('[M1]');
    expect(generated.prompt).toContain('[M5]');
    expect(generated.prompt).toContain('AI drafts only; do not apply actions.');
    expect(generated.prompt).toContain('Negative keyword and bid ideas are review/export-only');
    expect(generated.prompt).toContain('remoteApplyAllowed=false');
  });

  it('injects freshness fail-closed rules into every generated prompt', () => {
    const model = buildPromptLibrary(importedData(), settings(), 'trend_comparison');

    expect(model.generated?.prompt).toContain('Freshness: OK');
    expect(model.generated?.safetyConstraints).toEqual(
      expect.arrayContaining([
        expect.stringContaining('fail closed'),
        expect.stringContaining('review-only'),
      ])
    );
  });

  it('keeps the library as prompt cards rather than a chat/action surface', () => {
    const model = buildPromptLibrary(importedData(), settings());

    expect(model.cards.length).toBeGreaterThan(5);
    expect(JSON.stringify(model)).not.toMatch(/applyEnabled":true|remoteApplyAllowed":true|GoogleAdsApp|AdsApp/);
  });

  it('omits spreadsheet identifiers from copied prompt context', () => {
    const model = buildPromptLibrary(
      importedData(),
      settings({
        account_sources: [
          {
            id: 'source-a',
            account_id: 'acct-a',
            customer_id: 'cust-a',
            account_name: 'Account A',
            spreadsheet_id: 'sheet-secret-abcdef123456',
            spreadsheet_url: 'https://docs.google.com/spreadsheets/d/sheet-secret-abcdef123456/edit',
            sheet_tab_name: 'GoogleExport',
            timezone: 'Asia/Bangkok',
            currency: 'THB',
            enabled: true,
          },
        ],
        selected_account_source_id: 'source-a',
        sheet_id: 'https://docs.google.com/spreadsheets/d/sheet-secret-token/edit',
      })
    );

    expect(model.accountContext).toContain('source_sheet=configured');
    expect(model.accountContext).not.toContain('sheet-secret-abcdef123456');
    expect(model.accountContext).not.toContain('docs.google.com/spreadsheets');
    expect(model.generated?.prompt).toContain('source_sheet=configured');
    expect(model.generated?.prompt).not.toContain('sheet-secret-abcdef123456');
    expect(model.generated?.prompt).not.toContain('sheet-secret-token');
    expect(model.generated?.prompt).not.toContain('docs.google.com/spreadsheets');
  });
});
