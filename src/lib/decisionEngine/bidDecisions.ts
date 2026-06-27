import type {
  KeywordRow, AuctionKeywordRow, AuctionCampaignRow, VoluumRow,
  BidDecision, BidAction, ApprovalStatus, Settings,
} from '../../types';
import { calcCPA, calcROIPercent, calcProfit, fmtCurrency } from '../metrics/calculations';

interface AggregatedKeyword {
  keyword_key: string;
  campaign_name: string;
  ad_group_name: string;
  keyword: string;
  match_type: string;
  bidding_strategy_type: string;
  keyword_cpc_bid: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversion_value: number;
  impressions: number;
}

function aggregateKeywords(rows: KeywordRow[]): Map<string, AggregatedKeyword> {
  const map = new Map<string, AggregatedKeyword>();
  for (const r of rows) {
    const existing = map.get(r.keyword_key);
    if (existing) {
      existing.clicks += r.clicks;
      existing.cost += r.cost;
      existing.conversions += r.conversions;
      existing.conversion_value += r.conversion_value;
      existing.impressions += r.impressions;
      if (r.keyword_cpc_bid > 0) existing.keyword_cpc_bid = r.keyword_cpc_bid;
    } else {
      map.set(r.keyword_key, {
        keyword_key: r.keyword_key,
        campaign_name: r.campaign_name,
        ad_group_name: r.ad_group_name,
        keyword: r.keyword,
        match_type: r.match_type,
        bidding_strategy_type: r.bidding_strategy_type,
        keyword_cpc_bid: r.keyword_cpc_bid,
        clicks: r.clicks,
        cost: r.cost,
        conversions: r.conversions,
        conversion_value: r.conversion_value,
        impressions: r.impressions,
      });
    }
  }
  return map;
}

function aggregateAuctionKeywords(rows: AuctionKeywordRow[]): Map<string, AuctionKeywordRow> {
  const map = new Map<string, AuctionKeywordRow>();
  for (const r of rows) {
    const existing = map.get(r.keyword_key);
    if (!existing || r.search_impression_share > 0) {
      map.set(r.keyword_key, r);
    }
  }
  return map;
}

function aggregateVoluum(rows: VoluumRow[]): Map<string, { conversions: number; revenue: number; profit: number }> {
  const map = new Map<string, { conversions: number; revenue: number; profit: number }>();
  for (const r of rows) {
    const existing = map.get(r.keyword_key);
    if (existing) {
      existing.conversions += r.voluum_conversions;
      existing.revenue += r.revenue;
      existing.profit += r.profit;
    } else {
      map.set(r.keyword_key, {
        conversions: r.voluum_conversions,
        revenue: r.revenue,
        profit: r.profit,
      });
    }
  }
  return map;
}

function getCampaignBudgetLost(
  campaignName: string,
  auctionCampaigns: AuctionCampaignRow[]
): number {
  const matches = auctionCampaigns.filter((c) => c.campaign_name === campaignName);
  if (!matches.length) return 0;
  return matches.reduce((sum, c) => sum + c.search_budget_lost_impression_share, 0) / matches.length;
}

export function computeBidDecisions(
  keywords: KeywordRow[],
  auctionKeywords: AuctionKeywordRow[],
  auctionCampaigns: AuctionCampaignRow[],
  voluumRows: VoluumRow[],
  settings: Settings,
  savedApprovals: Record<string, ApprovalStatus>
): BidDecision[] {
  const kwMap = aggregateKeywords(keywords);
  const aucMap = aggregateAuctionKeywords(auctionKeywords);
  const volMap = aggregateVoluum(voluumRows);
  const hasVoluum = voluumRows.length > 0;

  const decisions: BidDecision[] = [];

  for (const [kk, kw] of kwMap) {
    const auc = aucMap.get(kk);
    const vol = volMap.get(kk);

    const googleConv = kw.conversions;
    const voluumConv = vol?.conversions ?? 0;
    const usedConversions = hasVoluum ? voluumConv : googleConv;

    const revenue = hasVoluum ? (vol?.revenue ?? 0) : kw.conversion_value;
    const cost = kw.cost;
    const profit = calcProfit(revenue, cost);
    const roi = calcROIPercent(revenue, cost);
    const cpa = calcCPA(cost, usedConversions);

    const currentBid = kw.keyword_cpc_bid;
    const rankLost = auc?.search_rank_lost_impression_share ?? 0;
    const absTop = auc?.absolute_top_impression_percentage ?? 0;
    const searchIS = auc?.search_impression_share ?? 0;
    const bidSignal = auc?.bid_signal ?? '';
    const budgetLost = getCampaignBudgetLost(kw.campaign_name, auctionCampaigns);

    const isManual = kw.bidding_strategy_type?.toUpperCase().includes('MANUAL');

    let action: BidAction = 'HOLD';
    let reason = 'Insufficient data to decide.';
    let recommendedBid: number | null = null;

    if (!isManual) {
      action = 'HOLD';
      reason = 'Smart bidding or non-manual bidding. Do not mutate keyword bid.';
    } else if (!currentBid || currentBid === 0) {
      action = 'HOLD';
      reason = 'No explicit keyword CPC bid. Likely inherited bid.';
    } else if (kw.clicks >= settings.min_clicks && cost >= settings.payout * 1.2 && usedConversions === 0) {
      action = 'PAUSE_CANDIDATE';
      reason = 'Cost exceeded 1.2x payout with zero conversions.';
    } else if (kw.clicks >= settings.min_clicks && cost >= settings.payout * 0.8 && usedConversions === 0) {
      action = 'DECREASE_BID';
      recommendedBid = Math.max(settings.min_bid, currentBid * (1 - settings.bid_decrease_percent / 100));
      reason = `Cost >= 80% payout with zero conversions. Decrease bid by ${settings.bid_decrease_percent}%.`;
    } else if (usedConversions >= 2 && cpa <= settings.target_cpa && rankLost >= 0.3) {
      action = 'INCREASE_BID';
      recommendedBid = Math.min(settings.max_bid, currentBid * (1 + settings.bid_increase_percent / 100));
      reason = `Good CPA (${fmtCurrency(cpa, settings.currency)}) but rank-limited (rank lost: ${(rankLost * 100).toFixed(1)}%). Increase bid.`;
    } else if (usedConversions >= 2 && cpa <= settings.target_cpa && budgetLost >= 0.2) {
      action = 'INCREASE_BUDGET_CANDIDATE';
      reason = `Good CPA but campaign is budget-limited (budget lost IS: ${(budgetLost * 100).toFixed(1)}%). Increase budget, not bid.`;
    } else if (usedConversions === 0 && absTop >= 0.5 && cost >= settings.payout * 0.7) {
      action = 'DECREASE_BID';
      recommendedBid = Math.max(settings.min_bid, currentBid * (1 - settings.bid_decrease_percent / 100));
      reason = `High absolute top position (${(absTop * 100).toFixed(1)}%) with zero conversions. Wasteful spend.`;
    } else {
      action = 'HOLD';
      reason = 'No automated rule triggered. Review manually.';
    }

    decisions.push({
      keyword_key: kk,
      campaign: kw.campaign_name,
      ad_group: kw.ad_group_name,
      keyword: kw.keyword,
      match_type: kw.match_type,
      current_bid: currentBid,
      recommended_bid: recommendedBid,
      cost,
      clicks: kw.clicks,
      google_conversions: googleConv,
      voluum_conversions: voluumConv,
      used_conversions: usedConversions,
      revenue,
      profit,
      roi,
      cpa,
      search_impression_share: searchIS,
      rank_lost: rankLost,
      absolute_top_rate: absTop,
      bid_signal: bidSignal,
      action,
      reason,
      approval_status: savedApprovals[kk] ?? 'PENDING_REVIEW',
    });
  }

  return decisions.sort((a, b) => b.cost - a.cost);
}
