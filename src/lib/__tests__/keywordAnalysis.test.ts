import { describe, expect, it } from 'vitest';
import type { ImportedData, KeywordRow, SearchTermRow, Settings } from '../../types';
import { DEFAULT_SETTINGS } from '../../types';
import { buildKeywordAnalysis, keywordAnalysisToCsv } from '../keywordAnalysis';

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
  return { ...DEFAULT_SETTINGS, target_cpa: 25, min_clicks: 10, min_cost_to_decide: 50, payout: 35, ...overrides };
}

function keyword(overrides: Partial<KeywordRow>): KeywordRow {
  return {
    date: '2026-06-01',
    device: 'DESKTOP',
    keyword_key: 'kw-a',
    campaign_id: 'camp-a',
    campaign_name: 'Search Campaign',
    bidding_strategy_type: 'MANUAL_CPC',
    ad_group_id: 'adg-a',
    ad_group_name: 'Ad Group',
    criterion_id: 'crit-a',
    keyword: 'buy course',
    match_type: 'PHRASE',
    keyword_status: 'ENABLED',
    keyword_cpc_bid: 1,
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

function searchTerm(overrides: Partial<SearchTermRow>): SearchTermRow {
  return {
    date: '2026-06-01',
    campaign_id: 'camp-a',
    campaign_name: 'Search Campaign',
    ad_group_id: 'adg-a',
    ad_group_name: 'Ad Group',
    search_term: 'free course login',
    search_term_status: 'NONE',
    impressions: 100,
    clicks: 20,
    cost: 80,
    ctr: 0.2,
    avg_cpc: 4,
    conversions: 0,
    all_conversions: 0,
    conversion_value: 0,
    ...overrides,
  };
}

describe('keyword analysis model', () => {
  it('builds tabs, buckets, ngrams, and review-only candidates', () => {
    const model = buildKeywordAnalysis(
      {
        ...baseData,
        keywords: [
          keyword({ keyword_key: 'winner', keyword: 'buy course', cost: 100, conversions: 5, conversion_value: 250 }),
          keyword({ keyword_key: 'zero', keyword: 'bad course', cost: 60, clicks: 20, conversions: 0, conversion_value: 0 }),
        ],
        searchTerms: [searchTerm({ search_term: 'free course login', cost: 80, clicks: 20 })],
      },
      settings()
    );

    expect(model.tabs.keywords).toHaveLength(2);
    expect(model.tabs.search_terms[0].bucket).toBe('Zero Conv');
    expect(model.ngrams.find((row) => row.ngram === 'course')).toMatchObject({ count: 1, cost: 80 });
    expect(model.bucketMatrix.Profitable).toBeGreaterThan(0);
    expect(model.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'NEGATIVE_KEYWORD_CANDIDATE', exportOnly: true, remoteApplyAllowed: false }),
        expect.objectContaining({ type: 'PAUSE_CANDIDATE', exportOnly: true, remoteApplyAllowed: false }),
      ])
    );
  });

  it('derives PMax intent categories and applies filters', () => {
    const model = buildKeywordAnalysis(
      {
        ...baseData,
        keywords: [keyword({ keyword_key: 'pmax-1', campaign_name: 'Performance Max Thailand', keyword: 'buy course thailand' })],
        searchTerms: [searchTerm({ campaign_name: 'Performance Max Thailand', search_term: 'how course price bangkok', conversions: 1, conversion_value: 100 })],
      },
      settings(),
      { campaign: 'Performance Max Thailand', text: 'location' }
    );

    expect(model.tabs.pmax_categories.map((row) => row.label)).toContain('location');
    expect(model.tabs.pmax_terms.every((row) => row.campaign === 'Performance Max Thailand')).toBe(true);
  });

  it('exports candidates as export-only and never remote-apply allowed', () => {
    const model = buildKeywordAnalysis(
      { ...baseData, searchTerms: [searchTerm({ search_term: 'free support', cost: 90 })] },
      settings()
    );
    const csv = keywordAnalysisToCsv(model.tabs.search_terms, model.candidates);

    expect(csv).toContain('export_only,remote_apply_allowed');
    expect(csv).toContain('true,false');
    expect(csv).not.toMatch(/remote[_ -]?apply.*true/i);
  });
});
