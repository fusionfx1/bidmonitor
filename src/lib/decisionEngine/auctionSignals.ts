import type {
  AuctionCampaignRow, AuctionKeywordRow,
  AuctionSignalRow, AuctionSignalLabel,
} from '../../types';

export function interpretAuctionLabel(
  impressionShare: number,
  rankLost: number,
  budgetLost: number,
  absTop: number,
  conversions: number
): { label: AuctionSignalLabel; description: string } {
  const isLow = impressionShare > 0 && impressionShare < 0.5;

  if (impressionShare >= 0.7 && rankLost < 0.1 && conversions === 0 && absTop >= 0.5) {
    return {
      label: 'HIGH_POSITION_NO_CONV_REDUCE_BID_CANDIDATE',
      description: 'High IS and top position, but zero conversions. Likely over-bidding.',
    };
  }

  if (impressionShare >= 0.5 && rankLost >= 0.2) {
    return {
      label: 'WINNER_RANK_LIMITED',
      description: 'Good IS but losing to rank. Consider bid increase or quality improvement.',
    };
  }

  if (impressionShare >= 0.5 && budgetLost >= 0.2) {
    return {
      label: 'WINNER_BUDGET_LIMITED',
      description: 'Good IS but losing to budget cap. Increase budget, not bid.',
    };
  }

  if (isLow && rankLost > budgetLost && conversions === 0) {
    return {
      label: 'NO_CONV_RANK_LOST_DO_NOT_SCALE',
      description: 'Low IS due to rank, and no conversions. Do not scale — fix quality first.',
    };
  }

  if (isLow && rankLost > budgetLost) {
    return {
      label: 'LOW_IS_RANK_LOST',
      description: 'Low impression share primarily due to rank lost.',
    };
  }

  if (isLow && budgetLost > rankLost) {
    return {
      label: 'LOW_IS_BUDGET_LOST',
      description: 'Low impression share primarily due to budget lost.',
    };
  }

  return {
    label: 'HOLD_REVIEW',
    description: 'No automated signal. Review manually.',
  };
}

export function computeAuctionSignals(
  auctionCampaigns: AuctionCampaignRow[],
  auctionKeywords: AuctionKeywordRow[]
): AuctionSignalRow[] {
  const rows: AuctionSignalRow[] = [];

  // Aggregate campaigns by campaign_id
  const campMap = new Map<string, AuctionCampaignRow & { count: number }>();
  for (const c of auctionCampaigns) {
    const existing = campMap.get(c.campaign_id);
    if (existing) {
      existing.impressions += c.impressions;
      existing.conversions += c.conversions;
      existing.search_impression_share =
        (existing.search_impression_share * existing.count + c.search_impression_share) / (existing.count + 1);
      existing.search_rank_lost_impression_share =
        (existing.search_rank_lost_impression_share * existing.count + c.search_rank_lost_impression_share) / (existing.count + 1);
      existing.search_budget_lost_impression_share =
        (existing.search_budget_lost_impression_share * existing.count + c.search_budget_lost_impression_share) / (existing.count + 1);
      existing.absolute_top_impression_percentage =
        (existing.absolute_top_impression_percentage * existing.count + c.absolute_top_impression_percentage) / (existing.count + 1);
      existing.top_impression_percentage =
        (existing.top_impression_percentage * existing.count + c.top_impression_percentage) / (existing.count + 1);
      existing.count += 1;
    } else {
      campMap.set(c.campaign_id, { ...c, count: 1 });
    }
  }

  for (const c of campMap.values()) {
    const { label, description } = interpretAuctionLabel(
      c.search_impression_share,
      c.search_rank_lost_impression_share,
      c.search_budget_lost_impression_share,
      c.absolute_top_impression_percentage,
      c.conversions
    );
    rows.push({
      type: 'campaign',
      id: c.campaign_id,
      name: c.campaign_name,
      campaign_name: c.campaign_name,
      search_impression_share: c.search_impression_share,
      rank_lost: c.search_rank_lost_impression_share,
      budget_lost: c.search_budget_lost_impression_share,
      top_impression_pct: c.top_impression_percentage,
      abs_top_impression_pct: c.absolute_top_impression_percentage,
      top_is: c.search_top_impression_share,
      abs_top_is: c.search_absolute_top_impression_share,
      bid_signal: c.bid_signal,
      conversions: c.conversions,
      label,
      description,
    });
  }

  // Aggregate keywords
  const kwMap = new Map<string, AuctionKeywordRow & { count: number }>();
  for (const k of auctionKeywords) {
    const existing = kwMap.get(k.keyword_key);
    if (existing) {
      existing.impressions += k.impressions;
      existing.conversions += k.conversions;
      existing.search_impression_share =
        (existing.search_impression_share * existing.count + k.search_impression_share) / (existing.count + 1);
      existing.search_rank_lost_impression_share =
        (existing.search_rank_lost_impression_share * existing.count + k.search_rank_lost_impression_share) / (existing.count + 1);
      existing.absolute_top_impression_percentage =
        (existing.absolute_top_impression_percentage * existing.count + k.absolute_top_impression_percentage) / (existing.count + 1);
      existing.count += 1;
    } else {
      kwMap.set(k.keyword_key, { ...k, count: 1 });
    }
  }

  for (const k of kwMap.values()) {
    const { label, description } = interpretAuctionLabel(
      k.search_impression_share,
      k.search_rank_lost_impression_share,
      0,
      k.absolute_top_impression_percentage,
      k.conversions
    );
    rows.push({
      type: 'keyword',
      id: k.keyword_key,
      name: k.keyword,
      campaign_name: k.campaign_name,
      search_impression_share: k.search_impression_share,
      rank_lost: k.search_rank_lost_impression_share,
      budget_lost: 0,
      top_impression_pct: k.top_impression_percentage,
      abs_top_impression_pct: k.absolute_top_impression_percentage,
      top_is: k.search_top_impression_share,
      abs_top_is: k.search_absolute_top_impression_share,
      bid_signal: k.bid_signal,
      conversions: k.conversions,
      label,
      description,
    });
  }

  return rows;
}
