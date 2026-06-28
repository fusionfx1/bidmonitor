import type { ImportedData, KeywordRow, SearchTermRow, Settings } from '../types';

export type KeywordAnalysisTab = 'keywords' | 'search_terms' | 'pmax_categories' | 'pmax_terms' | 'ngrams';
export type EntityBucket = 'Profitable' | 'Costly' | 'Fluke' | 'Meh' | 'Zero Conv' | 'Low Data';
export type CandidateType = 'NEGATIVE_KEYWORD_CANDIDATE' | 'PAUSE_CANDIDATE' | 'INCREASE_BID_CANDIDATE' | 'DECREASE_BID_CANDIDATE';

export interface KeywordFilters {
  campaign?: string;
  text?: string;
  minCost?: number;
  minClicks?: number;
  minConversions?: number;
  minCtr?: number;
  minCvr?: number;
}

export interface AnalysisEntity {
  id: string;
  tab: KeywordAnalysisTab;
  label: string;
  campaign: string;
  adGroup: string;
  matchType: string;
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
  value: number;
  ctr: number;
  cvr: number;
  cpa: number | null;
  roi: number | null;
  bucket: EntityBucket;
  badges: string[];
}

export interface ReviewOnlyCandidate {
  id: string;
  type: CandidateType;
  entityLabel: string;
  campaign: string;
  cost: number;
  reason: string;
  exportOnly: true;
  remoteApplyAllowed: false;
}

export interface NGramRow {
  ngram: string;
  tokens: number;
  count: number;
  cost: number;
  clicks: number;
  conversions: number;
  cpa: number | null;
  bucket: EntityBucket;
}

export interface KeywordAnalysisModel {
  tabs: Record<KeywordAnalysisTab, AnalysisEntity[]>;
  ngrams: NGramRow[];
  candidates: ReviewOnlyCandidate[];
  bucketMatrix: Record<EntityBucket, number>;
  campaigns: string[];
}

const BUCKETS: EntityBucket[] = ['Profitable', 'Costly', 'Fluke', 'Meh', 'Zero Conv', 'Low Data'];
const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'for', 'to', 'in', 'near', 'with', 'of', 'on']);

export function buildKeywordAnalysis(data: ImportedData, settings: Settings, filters: KeywordFilters = {}): KeywordAnalysisModel {
  const keywordEntities = aggregateKeywords(data.keywords, data.voluum.length > 0, data.voluum, settings);
  const searchTermEntities = aggregateSearchTerms(data.searchTerms, settings);
  const pmaxCategories = aggregatePmaxCategories(data.keywords, data.searchTerms, settings);
  const pmaxTerms = searchTermEntities
    .filter((row) => isPmax(row.campaign))
    .map((row) => ({ ...row, tab: 'pmax_terms' as const, badges: [...new Set([...row.badges, 'PMax'])] }));
  const ngrams = buildNgrams(data.searchTerms, settings).filter((row) => passesNgramFilters(row, filters));
  const tabs = {
    keywords: keywordEntities.filter((row) => passesFilters(row, filters)),
    search_terms: searchTermEntities.filter((row) => passesFilters(row, filters)),
    pmax_categories: pmaxCategories.filter((row) => passesFilters(row, filters)),
    pmax_terms: pmaxTerms.filter((row) => passesFilters(row, filters)),
    ngrams: [],
  };
  const candidates = buildCandidates([...keywordEntities, ...searchTermEntities], settings).filter((candidate) =>
    !filters.campaign || candidate.campaign === filters.campaign
  );
  const bucketMatrix = BUCKETS.reduce((acc, bucket) => ({ ...acc, [bucket]: 0 }), {} as Record<EntityBucket, number>);
  [...keywordEntities, ...searchTermEntities, ...pmaxCategories].forEach((row) => {
    bucketMatrix[row.bucket] += 1;
  });
  const campaigns = [...new Set([...keywordEntities, ...searchTermEntities].map((row) => row.campaign).filter(Boolean))].sort();

  return { tabs, ngrams, candidates, bucketMatrix, campaigns };
}

export function keywordAnalysisToCsv(rows: AnalysisEntity[], candidates: ReviewOnlyCandidate[]): string {
  const header = 'kind,label,campaign,ad_group,cost,clicks,conversions,cpa,roi,bucket,badges,export_only,remote_apply_allowed,reason';
  const entityRows = rows.map((row) => [
    row.tab,
    csv(row.label),
    csv(row.campaign),
    csv(row.adGroup),
    row.cost.toFixed(2),
    row.clicks,
    row.conversions.toFixed(2),
    row.cpa?.toFixed(2) ?? '',
    row.roi?.toFixed(2) ?? '',
    row.bucket,
    csv(row.badges.join('|')),
    '',
    '',
    '',
  ].join(','));
  const candidateRows = candidates.map((row) => [
    row.type,
    csv(row.entityLabel),
    csv(row.campaign),
    '',
    row.cost.toFixed(2),
    '',
    '',
    '',
    '',
    '',
    '',
    'true',
    'false',
    csv(row.reason),
  ].join(','));
  return [header, ...entityRows, ...candidateRows].join('\n');
}

function aggregateKeywords(rows: KeywordRow[], hasVoluum: boolean, voluumRows: ImportedData['voluum'], settings: Settings): AnalysisEntity[] {
  const voluum = new Map<string, { conversions: number; value: number }>();
  voluumRows.forEach((row) => {
    const existing = voluum.get(row.keyword_key) ?? { conversions: 0, value: 0 };
    existing.conversions += row.voluum_conversions;
    existing.value += row.revenue;
    voluum.set(row.keyword_key, existing);
  });
  const map = new Map<string, KeywordRow[]>();
  rows.forEach((row) => map.set(row.keyword_key, [...(map.get(row.keyword_key) ?? []), row]));
  return [...map.entries()].map(([id, group]) => {
    const totals = totalsFrom(group);
    const v = voluum.get(id);
    return entity({
      id,
      tab: 'keywords',
      label: group[0]?.keyword ?? id,
      campaign: group[0]?.campaign_name ?? '',
      adGroup: group[0]?.ad_group_name ?? '',
      matchType: group[0]?.match_type ?? '',
      totals: { ...totals, conversions: hasVoluum ? (v?.conversions ?? 0) : totals.conversions, value: hasVoluum ? (v?.value ?? 0) : totals.value },
      settings,
    });
  }).sort((a, b) => b.cost - a.cost);
}

function aggregateSearchTerms(rows: SearchTermRow[], settings: Settings): AnalysisEntity[] {
  const map = new Map<string, SearchTermRow[]>();
  rows.forEach((row) => {
    const key = `${row.search_term}__${row.campaign_id}__${row.ad_group_id}`;
    map.set(key, [...(map.get(key) ?? []), row]);
  });
  return [...map.entries()].map(([id, group]) => entity({
    id,
    tab: 'search_terms',
    label: group[0]?.search_term ?? id,
    campaign: group[0]?.campaign_name ?? '',
    adGroup: group[0]?.ad_group_name ?? '',
    matchType: '',
    totals: totalsFrom(group),
    settings,
  })).sort((a, b) => b.cost - a.cost);
}

function aggregatePmaxCategories(keywords: KeywordRow[], searchTerms: SearchTermRow[], settings: Settings): AnalysisEntity[] {
  const terms = [
    ...keywords.map((row) => ({ label: intentGroup(row.keyword), campaign: row.campaign_name, row })),
    ...searchTerms.map((row) => ({ label: intentGroup(row.search_term), campaign: row.campaign_name, row })),
  ].filter((item) => isPmax(item.campaign));
  const map = new Map<string, Array<KeywordRow | SearchTermRow>>();
  terms.forEach((item) => {
    const key = `${item.campaign}__${item.label}`;
    map.set(key, [...(map.get(key) ?? []), item.row]);
  });
  return [...map.entries()].map(([key, group]) => {
    const [campaign, label] = key.split('__');
    return entity({
    id: `pmax:${key}`,
    tab: 'pmax_categories',
    label,
    campaign,
    adGroup: '',
    matchType: '',
    totals: totalsFrom(group),
    settings,
    extraBadges: ['PMax', 'Intent group'],
  });
  }).sort((a, b) => b.cost - a.cost);
}

function buildNgrams(rows: SearchTermRow[], settings: Settings): NGramRow[] {
  const grams = new Map<string, { count: number; rows: SearchTermRow[]; tokens: number }>();
  rows.forEach((row) => {
    const words = tokenize(row.search_term);
    [1, 2, 3].forEach((size) => {
      for (let index = 0; index <= words.length - size; index += 1) {
        const ngram = words.slice(index, index + size).join(' ');
        const existing = grams.get(ngram) ?? { count: 0, rows: [], tokens: size };
        existing.count += 1;
        existing.rows.push(row);
        grams.set(ngram, existing);
      }
    });
  });
  return [...grams.entries()].map(([ngram, value]) => {
    const totals = totalsFrom(value.rows);
    const bucket = bucketFor(totals, settings);
    return {
      ngram,
      tokens: value.tokens,
      count: value.count,
      cost: totals.cost,
      clicks: totals.clicks,
      conversions: totals.conversions,
      cpa: totals.conversions > 0 ? totals.cost / totals.conversions : null,
      bucket,
    };
  }).filter((row) => row.count > 0).sort((a, b) => b.cost - a.cost);
}

function buildCandidates(rows: AnalysisEntity[], settings: Settings): ReviewOnlyCandidate[] {
  return rows.flatMap((row) => {
    const candidates: ReviewOnlyCandidate[] = [];
    if (row.tab === 'search_terms' && row.cost >= settings.min_cost_to_decide && row.conversions === 0) {
      candidates.push(candidate(row, 'NEGATIVE_KEYWORD_CANDIDATE', `Cost ${row.cost.toFixed(2)} with zero conversions.`));
    }
    if (row.tab === 'keywords' && row.cost >= settings.payout * 1.2 && row.conversions === 0) {
      candidates.push(candidate(row, 'PAUSE_CANDIDATE', 'Keyword spent above payout threshold with zero conversions.'));
    }
    if (row.tab === 'keywords' && row.conversions >= 2 && row.cpa !== null && row.cpa <= settings.target_cpa) {
      candidates.push(candidate(row, 'INCREASE_BID_CANDIDATE', 'Profitable keyword candidate for human review/export only.'));
    }
    if (row.tab === 'keywords' && row.clicks >= settings.min_clicks && row.conversions === 0) {
      candidates.push(candidate(row, 'DECREASE_BID_CANDIDATE', 'High-click zero-conversion keyword candidate.'));
    }
    return candidates;
  }).sort((a, b) => b.cost - a.cost);
}

function entity(input: {
  id: string;
  tab: KeywordAnalysisTab;
  label: string;
  campaign: string;
  adGroup: string;
  matchType: string;
  totals: Totals;
  settings: Settings;
  extraBadges?: string[];
}): AnalysisEntity {
  const { totals, settings } = input;
  const cpa = totals.conversions > 0 ? totals.cost / totals.conversions : null;
  const roi = totals.cost > 0 ? ((totals.value - totals.cost) / totals.cost) * 100 : null;
  const bucket = bucketFor(totals, settings);
  return {
    id: input.id,
    tab: input.tab,
    label: input.label,
    campaign: input.campaign,
    adGroup: input.adGroup,
    matchType: input.matchType,
    cost: totals.cost,
    clicks: totals.clicks,
    impressions: totals.impressions,
    conversions: totals.conversions,
    value: totals.value,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
    cvr: totals.clicks > 0 ? totals.conversions / totals.clicks : 0,
    cpa,
    roi,
    bucket,
    badges: badgesFor(totals, bucket, settings, input.extraBadges),
  };
}

type Totals = { impressions: number; clicks: number; cost: number; conversions: number; value: number };

function totalsFrom(rows: Array<KeywordRow | SearchTermRow>): Totals {
  return rows.reduce((total, row) => ({
    impressions: total.impressions + row.impressions,
    clicks: total.clicks + row.clicks,
    cost: total.cost + row.cost,
    conversions: total.conversions + row.conversions,
    value: total.value + row.conversion_value,
  }), { impressions: 0, clicks: 0, cost: 0, conversions: 0, value: 0 });
}

function bucketFor(totals: Totals, settings: Settings): EntityBucket {
  const profit = totals.value - totals.cost;
  const cpa = totals.conversions > 0 ? totals.cost / totals.conversions : null;
  if (totals.clicks < settings.min_clicks && totals.cost < settings.min_cost_to_decide) return 'Low Data';
  if (totals.conversions === 0) return 'Zero Conv';
  if (profit > 0 && cpa !== null && cpa <= settings.target_cpa) return 'Profitable';
  if (profit < 0 || (cpa !== null && cpa > settings.target_cpa)) return 'Costly';
  if (totals.conversions === 1 && totals.cost < settings.min_cost_to_decide) return 'Fluke';
  return 'Meh';
}

function badgesFor(totals: Totals, bucket: EntityBucket, settings: Settings, extra: string[] = []): string[] {
  const badges = [...extra, bucket];
  if (totals.cost >= settings.min_cost_to_decide && totals.conversions === 0) badges.push('Wasted spend');
  if (totals.conversions > 0 && totals.cost / totals.conversions <= settings.target_cpa) badges.push('Top CPA');
  if (totals.clicks < settings.min_clicks) badges.push('Low data');
  if (bucket === 'Costly' && totals.conversions > 0) badges.push('Conflict');
  return [...new Set(badges)];
}

function candidate(row: AnalysisEntity, type: CandidateType, reason: string): ReviewOnlyCandidate {
  return {
    id: `${type}:${row.id}`,
    type,
    entityLabel: row.label,
    campaign: row.campaign,
    cost: row.cost,
    reason,
    exportOnly: true,
    remoteApplyAllowed: false,
  };
}

function passesFilters(row: AnalysisEntity, filters: KeywordFilters): boolean {
  const text = filters.text?.trim().toLowerCase();
  return (!filters.campaign || row.campaign === filters.campaign)
    && (!text || [row.label, row.campaign, row.adGroup, row.badges.join(' ')].some((value) => value.toLowerCase().includes(text)))
    && (filters.minCost === undefined || row.cost >= filters.minCost)
    && (filters.minClicks === undefined || row.clicks >= filters.minClicks)
    && (filters.minConversions === undefined || row.conversions >= filters.minConversions)
    && (filters.minCtr === undefined || row.ctr >= filters.minCtr)
    && (filters.minCvr === undefined || row.cvr >= filters.minCvr);
}

function passesNgramFilters(row: NGramRow, filters: KeywordFilters): boolean {
  const text = filters.text?.trim().toLowerCase();
  return (!text || row.ngram.includes(text))
    && (filters.minCost === undefined || row.cost >= filters.minCost)
    && (filters.minClicks === undefined || row.clicks >= filters.minClicks)
    && (filters.minConversions === undefined || row.conversions >= filters.minConversions);
}

function intentGroup(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes('brand')) return 'brand';
  if (lower.includes('near') || lower.includes('bangkok') || lower.includes('thai')) return 'location';
  if (lower.includes('vs') || lower.includes('alternative')) return 'competitor';
  if (lower.includes('free') || lower.includes('login') || lower.includes('support')) return 'irrelevant';
  if (lower.includes('buy') || lower.includes('price') || lower.includes('quote')) return 'high intent';
  if (lower.includes('how') || lower.includes('what') || lower.includes('?')) return 'question';
  return 'generic';
}

function isPmax(value: string): boolean {
  return /pmax|performance max/i.test(value);
}

function tokenize(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter((word) => word && !STOP_WORDS.has(word));
}

function csv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
