import type { SearchTermRow, NegativeCandidate, ApprovalStatus, Settings } from '../../types';
import { fmtCurrency } from '../metrics/calculations';

const WASTE_WORDS = [
  'login', 'customer service', 'phone number', 'address', 'job', 'career',
  'free', 'app download', 'support', 'scam', 'complaint', 'review', 'reddit',
  'meaning', 'definition', 'customer service number', 'phone', 'contact',
  'lawsuit', 'bbb',
];

export function containsWasteWord(term: string): string | null {
  const lower = term.toLowerCase();
  for (const w of WASTE_WORDS) {
    if (lower.includes(w)) return w;
  }
  return null;
}

interface AggregatedTerm {
  search_term: string;
  campaign: string;
  ad_group: string;
  clicks: number;
  cost: number;
  conversions: number;
}

function aggregateSearchTerms(rows: SearchTermRow[]): AggregatedTerm[] {
  const map = new Map<string, AggregatedTerm>();
  for (const r of rows) {
    const key = `${r.search_term}__${r.campaign_id}__${r.ad_group_id}`;
    const existing = map.get(key);
    if (existing) {
      existing.clicks += r.clicks;
      existing.cost += r.cost;
      existing.conversions += r.conversions;
    } else {
      map.set(key, {
        search_term: r.search_term,
        campaign: r.campaign_name,
        ad_group: r.ad_group_name,
        clicks: r.clicks,
        cost: r.cost,
        conversions: r.conversions,
      });
    }
  }
  return Array.from(map.values());
}

export function computeNegativeCandidates(
  searchTerms: SearchTermRow[],
  settings: Settings,
  savedApprovals: Record<string, ApprovalStatus>
): NegativeCandidate[] {
  const aggregated = aggregateSearchTerms(searchTerms);
  const candidates: NegativeCandidate[] = [];

  for (const term of aggregated) {
    if (term.conversions > 0) continue;

    const wasteWord = containsWasteWord(term.search_term);
    const key = `${term.search_term}__${term.campaign}__${term.ad_group}`;

    if (wasteWord) {
      candidates.push({
        search_term: term.search_term,
        campaign: term.campaign,
        ad_group: term.ad_group,
        clicks: term.clicks,
        cost: term.cost,
        conversions: term.conversions,
        negative_type: 'NEGATIVE_PHRASE_CANDIDATE',
        reason: `Contains waste word: "${wasteWord}"`,
        approval_status: savedApprovals[key] ?? 'PENDING_REVIEW',
      });
      continue;
    }

    if (term.cost >= settings.payout * 0.7 && term.conversions === 0) {
      candidates.push({
        search_term: term.search_term,
        campaign: term.campaign,
        ad_group: term.ad_group,
        clicks: term.clicks,
        cost: term.cost,
        conversions: term.conversions,
        negative_type: 'NEGATIVE_EXACT_CANDIDATE',
        reason: `Cost ${fmtCurrency(term.cost, settings.currency)} >= 70% of payout (${fmtCurrency(settings.payout * 0.7, settings.currency)}) with 0 conversions`,
        approval_status: savedApprovals[key] ?? 'PENDING_REVIEW',
      });
      continue;
    }

    if (term.clicks >= settings.min_clicks && term.conversions === 0) {
      candidates.push({
        search_term: term.search_term,
        campaign: term.campaign,
        ad_group: term.ad_group,
        clicks: term.clicks,
        cost: term.cost,
        conversions: term.conversions,
        negative_type: 'NEGATIVE_EXACT_CANDIDATE',
        reason: `${term.clicks} clicks with 0 conversions (min: ${settings.min_clicks})`,
        approval_status: savedApprovals[key] ?? 'PENDING_REVIEW',
      });
    }
  }

  return candidates.sort((a, b) => b.cost - a.cost);
}
