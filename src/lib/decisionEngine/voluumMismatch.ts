import type { VoluumRow, CampaignRow, VoluumMismatchRow, VoluumMismatchFlag } from '../../types';

export function computeVoluumMismatch(
  voluumRows: VoluumRow[],
  campaigns: CampaignRow[]
): VoluumMismatchRow[] {
  if (voluumRows.length === 0) {
    // Aggregate campaigns and flag all as NO_VOLUUM_DATA
    const campMap = new Map<string, { clicks: number; conversions: number; cost: number }>();
    for (const c of campaigns) {
      const existing = campMap.get(c.campaign_id);
      if (existing) {
        existing.clicks += c.clicks;
        existing.conversions += c.conversions;
        existing.cost += c.cost;
      } else {
        campMap.set(c.campaign_id, {
          clicks: c.clicks,
          conversions: c.conversions,
          cost: c.cost,
        });
      }
    }
    return Array.from(campMap.entries()).map(([id, v]) => ({
      campaign_id: id,
      keyword_key: '',
      google_clicks: v.clicks,
      voluum_visits: 0,
      google_conversions: v.conversions,
      voluum_conversions: 0,
      google_cost: v.cost,
      voluum_revenue: 0,
      voluum_profit: 0,
      flag: 'NO_VOLUUM_DATA' as VoluumMismatchFlag,
      description: 'Voluum data not imported. Using Google data only.',
    }));
  }

  // Aggregate voluum by keyword_key
  const volMap = new Map<string, VoluumRow[]>();
  for (const v of voluumRows) {
    const key = v.keyword_key || v.campaign_id;
    const existing = volMap.get(key);
    if (existing) {
      existing.push(v);
    } else {
      volMap.set(key, [v]);
    }
  }

  const rows: VoluumMismatchRow[] = [];

  for (const [key, volList] of volMap) {
    const totalVoluumVisits = volList.reduce((s, v) => s + v.voluum_visits, 0);
    const totalVoluumConv = volList.reduce((s, v) => s + v.voluum_conversions, 0);
    const totalRevenue = volList.reduce((s, v) => s + v.revenue, 0);
    const totalProfit = volList.reduce((s, v) => s + v.profit, 0);
    const campaignId = volList[0].campaign_id;

    // Find matching google campaign data
    const matchCamp = campaigns.filter((c) => c.campaign_id === campaignId);
    const googleClicks = matchCamp.reduce((s, c) => s + c.clicks, 0);
    const googleConv = matchCamp.reduce((s, c) => s + c.conversions, 0);
    const googleCost = matchCamp.reduce((s, c) => s + c.cost, 0);

    let flag: VoluumMismatchFlag = 'OK';
    let description = 'Data looks consistent.';

    if (googleClicks > 0 && totalVoluumVisits === 0) {
      flag = 'TRACKING_MISMATCH';
      description = `Google recorded ${googleClicks} clicks but Voluum has 0 visits. Check tracking pixel.`;
    } else if (googleClicks > 0 && totalVoluumVisits / googleClicks < 0.8) {
      flag = 'LOW_VISIT_CAPTURE';
      const rate = ((totalVoluumVisits / googleClicks) * 100).toFixed(1);
      description = `Voluum only captures ${rate}% of Google clicks. Possible tracking gap.`;
    } else if (
      googleConv > 0 &&
      totalVoluumConv > 0 &&
      Math.abs(googleConv - totalVoluumConv) / googleConv > 0.3
    ) {
      flag = 'CONVERSION_MISMATCH';
      description = `Google: ${googleConv} conv vs Voluum: ${totalVoluumConv} conv (>${30}% difference).`;
    }

    rows.push({
      campaign_id: campaignId,
      keyword_key: key,
      google_clicks: googleClicks,
      voluum_visits: totalVoluumVisits,
      google_conversions: googleConv,
      voluum_conversions: totalVoluumConv,
      google_cost: googleCost,
      voluum_revenue: totalRevenue,
      voluum_profit: totalProfit,
      flag,
      description,
    });
  }

  return rows.sort((a, b) => {
    const order: Record<VoluumMismatchFlag, number> = {
      TRACKING_MISMATCH: 0,
      LOW_VISIT_CAPTURE: 1,
      CONVERSION_MISMATCH: 2,
      NO_VOLUUM_DATA: 3,
      OK: 4,
    };
    return order[a.flag] - order[b.flag];
  });
}
