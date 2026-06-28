import { describe, expect, it } from 'vitest';
import { buildAdvancedViews } from '../advancedViews';
import { DEFAULT_SETTINGS } from '../../types';
import type { CampaignRow, GeoPerformanceRow, ImportedData, PlacementPerformanceRow } from '../../types';

const baseData: ImportedData = {
  campaigns: [],
  adGroups: [],
  keywords: [],
  searchTerms: [],
  hourDevice: [],
  policy: [],
  auctionCampaigns: [],
  auctionKeywords: [],
  pmaxPerformance: [],
  geoPerformance: [],
  placementPerformance: [],
  voluum: [],
  syncLog: [],
  meta: {},
};

const campaign = (overrides: Partial<CampaignRow>): CampaignRow => ({
  account_id: 'acct-a',
  customer_id: '1111111111',
  source_sheet_id: 'sheet-a',
  date: '2026-06-01',
  campaign_id: 'c1',
  campaign_name: 'Search Thailand',
  campaign_status: 'ENABLED',
  serving_status: 'SERVING',
  channel: 'SEARCH',
  bidding_strategy_type: 'MAXIMIZE_CONVERSIONS',
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
});

const geo = (overrides: Partial<GeoPerformanceRow>): GeoPerformanceRow => ({
  account_id: 'acct-a',
  customer_id: '1111111111',
  source_sheet_id: 'sheet-a',
  date: '2026-06-01',
  campaign_id: 'c1',
  campaign_name: 'Search Thailand',
  country_criterion_id: '2764',
  country_code: 'TH',
  region: 'Bangkok',
  city: '',
  impressions: 100,
  clicks: 40,
  cost: 60,
  conversions: 0,
  conversion_value: 0,
  profit: -60,
  roi: -100,
  geo_signal: 'exclude_review',
  review_status: 'PENDING_REVIEW',
  ...overrides,
});

const placement = (overrides: Partial<PlacementPerformanceRow>): PlacementPerformanceRow => ({
  account_id: 'acct-a',
  customer_id: '1111111111',
  source_sheet_id: 'sheet-a',
  date: '2026-06-01',
  campaign_id: 'c2',
  campaign_name: 'PMax Thailand',
  ad_group_id: '',
  ad_group_name: '',
  placement: 'youtube.com/example',
  placement_type: 'YOUTUBE_CHANNEL',
  impressions: 500,
  clicks: 30,
  cost: 50,
  conversions: 0,
  conversion_value: 0,
  profit: -50,
  placement_signal: 'exclude_review',
  review_status: 'PENDING_REVIEW',
  ...overrides,
});

describe('buildAdvancedViews', () => {
  it('builds allocation, geo, placement, and treemap rows', () => {
    const model = buildAdvancedViews({
      ...baseData,
      campaigns: [
        campaign({ campaign_id: 'c1', campaign_name: 'Search Thailand', cost: 100, conversions: 5, conversion_value: 250 }),
        campaign({ campaign_id: 'c2', campaign_name: 'PMax Thailand', channel: 'PERFORMANCE_MAX', cost: 300, conversions: 1, conversion_value: 40 }),
      ],
      geoPerformance: [geo({})],
      placementPerformance: [placement({})],
    }, DEFAULT_SETTINGS);

    expect(model.allocation.map((row) => row.campaign)).toEqual(['PMax Thailand', 'Search Thailand']);
    expect(model.geo[0]).toMatchObject({ type: 'geo', proposalOnly: true, remoteApplyAllowed: false });
    expect(model.placements[0]).toMatchObject({ type: 'placement', proposalOnly: true, remoteApplyAllowed: false });
    expect(model.treemap.some((row) => row.level === 'campaign')).toBe(true);
  });

  it('keeps geo and placement exclusions proposal-only', () => {
    const model = buildAdvancedViews({
      ...baseData,
      campaigns: [campaign({ cost: 400, conversions: 0, conversion_value: 0 })],
      geoPerformance: [geo({ cost: 75, conversions: 0 })],
      placementPerformance: [placement({ cost: 80, conversions: 0 })],
    }, DEFAULT_SETTINGS);

    expect(model.proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'GEO_EXCLUSION_CANDIDATE', proposalOnly: true, remoteApplyAllowed: false }),
      expect.objectContaining({ kind: 'PLACEMENT_EXCLUSION_CANDIDATE', proposalOnly: true, remoteApplyAllowed: false }),
      expect.objectContaining({ kind: 'BUDGET_ALLOCATION_REVIEW', proposalOnly: true, remoteApplyAllowed: false }),
    ]));
    expect(model.proposals.every((row) => row.remoteApplyAllowed === false)).toBe(true);
  });
});
