import type { ImportedData, Settings } from '../types';
import { buildBudgetOptimization } from './budgetOptimization';
import { buildKeywordAnalysis } from './keywordAnalysis';
import { buildTrendModel } from './trendsDiagnostics';
import { computeSyncHealth } from './syncHealth';

export type PromptCategory = 'Strategy' | 'Optimization' | 'Diagnostics' | 'Keywords' | 'Budget' | 'Creative';

export interface PromptCard {
  id: string;
  title: string;
  category: PromptCategory;
  requiredSources: string[];
  answers: string;
  tags: string[];
}

export interface GeneratedPrompt {
  card: PromptCard;
  prompt: string;
  metricCitations: string[];
  safetyConstraints: string[];
}

export interface PromptLibraryFilters {
  query?: string;
  category?: PromptCategory | 'All';
}

export interface PromptLibraryModel {
  cards: PromptCard[];
  categories: Array<PromptCategory | 'All'>;
  generated: GeneratedPrompt | null;
  freshness: string;
  accountContext: string;
}

export const PROMPT_CARDS: PromptCard[] = [
  card('smart_bidding', 'Smart Bidding Analysis', 'Optimization', ['Campaigns', 'Auction Signals', 'Voluum'], 'Whether bidding recommendations are supported by CPA, profit, impression share, and freshness.', ['bidding', 'cpa', 'profit', 'auction']),
  card('campaign_scaling', 'Campaign Scaling Readiness', 'Strategy', ['Campaigns', 'Trends', 'Budget'], 'Which campaigns are safe to scale, hold, or reduce using supplied trend and pacing metrics.', ['scale', 'winner', 'pacing']),
  card('negative_keywords', 'Negative Keyword Identification', 'Keywords', ['Search Terms', 'Keyword Analysis'], 'Which search terms look wasteful and should remain review/export-only negative candidates.', ['negative', 'search term', 'waste']),
  card('keyword_ngrams', 'Keyword / Search Term N-Gram Analysis', 'Keywords', ['Search Terms'], 'Recurring n-grams that explain cost, conversions, CPA, and waste clusters.', ['ngram', 'keyword', 'intent']),
  card('roas_cpa', 'ROAS / CPA Maximization', 'Optimization', ['Campaigns', 'Voluum'], 'How to improve true profit while staying inside target CPA and ROAS evidence.', ['roas', 'cpa', 'profit']),
  card('budget_optimization', 'Budget Optimization Review', 'Budget', ['Campaigns', 'Budget Optimizer'], 'Which proposal-only budget changes are justified and which guardrails should block them.', ['budget', 'pacing', 'proposal']),
  card('trend_comparison', 'Performance Trend / Period Comparison', 'Diagnostics', ['Campaigns', 'Sync Log'], 'What changed between recent periods and which metric drove the movement.', ['trend', 'period', 'diagnostic']),
  card('geo_performance', 'Geo Performance Investigation', 'Diagnostics', ['Campaigns', 'Hour / Device'], 'How to investigate geo or segment performance without applying modifiers.', ['geo', 'segment', 'diagnostic']),
  card('landing_page', 'Landing Page Improvement Brief', 'Creative', ['Search Terms', 'Campaigns'], 'Landing-page hypotheses from high-click, low-conversion terms and campaign context.', ['landing page', 'cvr', 'creative']),
];

const CATEGORIES: Array<PromptCategory | 'All'> = ['All', 'Strategy', 'Optimization', 'Diagnostics', 'Keywords', 'Budget', 'Creative'];

const SAFETY_CONSTRAINTS = [
  'AI drafts only; do not apply actions.',
  'Do not suggest direct Google Ads OAuth/API writes or browser/backend mutations.',
  'Keep recommendations review-only and cite supplied metrics by citation id.',
  'If freshness is STALE, ERROR, or UNKNOWN, fail closed and ask for a fresh sync before scaling.',
  'Budget or campaign update ideas must remain proposal-only unless separately approved through guardrails.',
  'Negative keyword and bid ideas are review/export-only in this version.',
];

export function buildPromptLibrary(
  data: ImportedData,
  settings: Settings,
  selectedCardId = PROMPT_CARDS[0].id,
  filters: PromptLibraryFilters = {}
): PromptLibraryModel {
  const cards = filterCards(PROMPT_CARDS, filters);
  const selected = PROMPT_CARDS.find((item) => item.id === selectedCardId) ?? cards[0] ?? PROMPT_CARDS[0];
  const generated = selected ? generatePrompt(selected, data, settings) : null;
  return {
    cards,
    categories: CATEGORIES,
    generated,
    freshness: computeSyncHealth(data.syncLog).freshnessStatus,
    accountContext: accountContext(settings),
  };
}

export function generatePrompt(cardItem: PromptCard, data: ImportedData, settings: Settings): GeneratedPrompt {
  const context = buildPromptContext(data, settings);
  const metricCitations = citationsFor(cardItem, context);
  const prompt = [
    `Prompt card: ${cardItem.title}`,
    `Category: ${cardItem.category}`,
    `What this answers: ${cardItem.answers}`,
    '',
    'Account context:',
    `- ${context.account}`,
    `- Date range: ${context.dateRange}`,
    `- Currency: ${settings.currency}`,
    `- Action mode: ${settings.action_mode}`,
    `- Freshness: ${context.freshness}`,
    '',
    'Metric table (cite these ids in every conclusion):',
    ...metricCitations.map((line) => `- ${line}`),
    '',
    'Safety constraints:',
    ...SAFETY_CONSTRAINTS.map((line) => `- ${line}`),
    '',
    'Output format:',
    '1. Executive summary with cited metrics.',
    '2. Findings table: issue, evidence citation, risk, review-only recommendation.',
    '3. Guardrail checks and data gaps.',
    '4. Next human review steps; no live apply instructions.',
  ].join('\n');

  return { card: cardItem, prompt, metricCitations, safetyConstraints: SAFETY_CONSTRAINTS };
}

function buildPromptContext(data: ImportedData, settings: Settings) {
  const trend = buildTrendModel(data, settings, { includeAllCampaigns: true, preset: '30d' });
  const budget = buildBudgetOptimization(data, settings, 'balanced');
  const keywords = buildKeywordAnalysis(data, settings);
  const health = computeSyncHealth(data.syncLog);
  const dates = data.campaigns.map((row) => row.date.slice(0, 10)).filter(Boolean).sort();
  const topCampaign = trend.campaignSummaries[0];
  const topKeywordCandidate = keywords.candidates[0];
  const topNgram = keywords.ngrams[0];
  const totals = trend.metricCards.reduce<Record<string, string>>((acc, item) => {
    acc[item.id] = item.displayValue;
    return acc;
  }, {});

  return {
    account: accountContext(settings),
    dateRange: dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : 'No campaign date rows supplied',
    freshness: health.freshnessStatus,
    metrics: {
      spend: totals.cost ?? 'N/A',
      conversions: totals.conversions ?? 'N/A',
      cpa: totals.cpa ?? 'N/A',
      roi: totals.roi ?? 'N/A',
      roas: totals.roas ?? 'N/A',
      topCampaign: topCampaign
        ? `${topCampaign.campaignName}: cost ${money(topCampaign.cost, settings.currency)}, conversions ${topCampaign.conversions.toFixed(1)}, CPA ${topCampaign.cpa === null ? 'N/A' : money(topCampaign.cpa, settings.currency)}, verdict ${topCampaign.verdict}`
        : 'No campaign summary supplied',
      budgetProposal: budget.proposals[0]
        ? `${budget.proposals[0].campaignName}: ${money(budget.proposals[0].currentBudget, settings.currency)} -> ${money(budget.proposals[0].proposedBudget, settings.currency)}, remoteApplyAllowed=false`
        : 'No budget proposal supplied',
      keywordCandidate: topKeywordCandidate
        ? `${topKeywordCandidate.type}: ${topKeywordCandidate.entityLabel}, cost ${money(topKeywordCandidate.cost, settings.currency)}, remoteApplyAllowed=false`
        : 'No keyword/search-term candidate supplied',
      ngram: topNgram
        ? `${topNgram.ngram}: cost ${money(topNgram.cost, settings.currency)}, clicks ${topNgram.clicks}, conversions ${topNgram.conversions.toFixed(1)}`
        : 'No n-gram supplied',
      sync: `last=${health.lastScriptRunAt ?? 'none'}, status=${health.lastStatus ?? 'none'}, rows=${data.syncLog.length}`,
    },
  };
}

function citationsFor(cardItem: PromptCard, context: ReturnType<typeof buildPromptContext>): string[] {
  const common = [
    `[M1] Account/date/freshness: ${context.account}; ${context.dateRange}; freshness=${context.freshness}`,
    `[M2] Spend/conversions/CPA: spend=${context.metrics.spend}; conversions=${context.metrics.conversions}; cpa=${context.metrics.cpa}`,
    `[M3] Profitability: roi=${context.metrics.roi}; roas=${context.metrics.roas}`,
    `[M4] Top campaign: ${context.metrics.topCampaign}`,
  ];
  const byCard: Record<string, string[]> = {
    smart_bidding: ['[M5] Auction/bidding proxy: review impression-share and CPA together; no bid apply is allowed.'],
    campaign_scaling: [`[M5] Budget proposal evidence: ${context.metrics.budgetProposal}`],
    negative_keywords: [`[M5] Review/export-only candidate: ${context.metrics.keywordCandidate}`],
    keyword_ngrams: [`[M5] N-gram evidence: ${context.metrics.ngram}`],
    roas_cpa: [`[M5] True-value check: ${context.metrics.topCampaign}; ${context.metrics.budgetProposal}`],
    budget_optimization: [`[M5] Budget proposal evidence: ${context.metrics.budgetProposal}`],
    trend_comparison: [`[M5] Sync evidence: ${context.metrics.sync}`],
    geo_performance: ['[M5] Segment caution: geo/device/hour modifiers are later-phase only and must stay review-only.'],
    landing_page: [`[M5] Landing-page hypothesis source: ${context.metrics.keywordCandidate}`],
  };
  return [...common, ...(byCard[cardItem.id] ?? [])];
}

function filterCards(cards: PromptCard[], filters: PromptLibraryFilters): PromptCard[] {
  const query = filters.query?.trim().toLowerCase();
  return cards.filter((item) =>
    (!filters.category || filters.category === 'All' || item.category === filters.category)
    && (!query || [item.title, item.category, item.answers, item.requiredSources.join(' '), item.tags.join(' ')]
      .some((value) => value.toLowerCase().includes(query)))
  );
}

function card(id: string, title: string, category: PromptCategory, requiredSources: string[], answers: string, tags: string[]): PromptCard {
  return { id, title, category, requiredSources, answers, tags };
}

function accountContext(settings: Settings): string {
  const active = settings.account_sources.find((source) => source.id === settings.selected_account_source_id);
  if (active) {
    return `${active.account_name || active.account_id} / account_id=${active.account_id || 'missing'} / customer_id=${active.customer_id || 'missing'} / source_sheet=${sourceSheetStatus(active.spreadsheet_id || active.spreadsheet_url)}`;
  }
  return `account_id=${settings.account_id || 'missing'} / customer_id=${settings.customer_id || 'missing'} / source_sheet=${sourceSheetStatus(settings.sheet_id)}`;
}

function sourceSheetStatus(value: string | null | undefined): string {
  return value?.trim() ? 'configured' : 'not configured';
}

function money(value: number, currencyCode: string): string {
  return `${currencyCode || 'THB'} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
