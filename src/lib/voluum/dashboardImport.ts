import type { VoluumRow } from '../../types';
import type { AccountSourceScope } from '../accountSources';
import { fetchVoluumReport, resolveDateRange } from './api';
import { normalizeRows } from './normalize';

export async function fetchVoluumRowsForDashboard(scope: AccountSourceScope): Promise<VoluumRow[]> {
  const { from, to } = resolveDateRange('last30');
  const raw = await fetchVoluumReport({
    from,
    to,
    groupBy: 'campaign',
    limit: 250,
    sort: 'conversions',
    direction: 'desc',
  });

  const dateRange = `${from.slice(0, 10)} / ${to.slice(0, 10)}`;
  const reportDate = to.slice(0, 10);
  const rows = normalizeRows(raw.rows ?? [], dateRange)
    .filter((row) => row.visits > 0 || row.clicks > 0 || row.conversions > 0 || row.revenue !== 0 || row.profit !== 0)
    .map((row): VoluumRow => ({
      account_id: scope.account_id,
      customer_id: scope.customer_id,
      source_sheet_id: scope.source_sheet_id,
      date: reportDate,
      keyword_key: row.campaignId || row.campaignName,
      campaign_id: row.campaignId,
      ad_group_id: '',
      criterion_id: '',
      voluum_visits: row.visits,
      voluum_clicks: row.clicks,
      voluum_conversions: row.conversions,
      revenue: row.revenue,
      profit: row.profit,
      roi: row.roi,
    }));

  return rows;
}
