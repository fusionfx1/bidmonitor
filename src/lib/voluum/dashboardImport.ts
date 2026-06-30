import type { CampaignRow, Settings, VoluumMatchMode, VoluumRow } from '../../types';
import type { AccountSourceScope } from '../accountSources';
import { fetchVoluumReport, resolveDateRange } from './api';
import { normalizeRows } from './normalize';
import type { NormalizedVoluumRow } from './types';

interface DashboardVoluumContext {
  campaigns?: CampaignRow[];
  settings?: Settings;
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9ก-๙]+/g, ' ').trim();
}

function compactDigits(value: string): string {
  return value.replace(/\D+/g, '');
}

function campaignMatches(row: NormalizedVoluumRow, campaign: CampaignRow): boolean {
  const voluumId = compactDigits(row.campaignId);
  const googleId = compactDigits(campaign.campaign_id);
  if (voluumId && googleId && voluumId === googleId) return true;

  const voluumName = norm(row.campaignName);
  const googleName = norm(campaign.campaign_name);
  if (!voluumName || !googleName) return false;
  return voluumName === googleName || voluumName.includes(googleName) || googleName.includes(voluumName);
}

function filterByCampaigns(
  rows: NormalizedVoluumRow[],
  campaigns: CampaignRow[],
  matchMode: VoluumMatchMode
): NormalizedVoluumRow[] {
  if (matchMode === 'all' || campaigns.length === 0) return rows;

  const matched = rows.filter((row) => campaigns.some((campaign) => campaignMatches(row, campaign)));
  if (matched.length > 0) return matched;

  // Single-campaign accounts commonly have Voluum campaign names that do not contain
  // the Google Ads campaign ID. Keep rows in auto mode so the account still gets a
  // usable dashboard, but strict mode stays fail-closed.
  const uniqueGoogleCampaigns = new Set(campaigns.map((campaign) => campaign.campaign_id).filter(Boolean));
  if (matchMode === 'auto' && uniqueGoogleCampaigns.size <= 1) return rows;
  return [];
}

function filterByConfiguredName(rows: NormalizedVoluumRow[], campaignFilter: string): NormalizedVoluumRow[] {
  const needle = norm(campaignFilter);
  if (!needle) return rows;
  return rows.filter((row) => norm(row.campaignName).includes(needle) || norm(row.campaignId).includes(needle));
}

function selectedConversions(row: NormalizedVoluumRow, settings?: Settings): number {
  if (settings?.voluum_conversion_metric === 'revenue_conversions') {
    return row.revenue > 0 ? row.conversions : 0;
  }
  return row.conversions;
}

export async function fetchVoluumRowsForDashboard(
  scope: AccountSourceScope,
  context: DashboardVoluumContext = {}
): Promise<VoluumRow[]> {
  const settings = context.settings;
  const { from, to } = resolveDateRange('last30');
  const raw = await fetchVoluumReport({
    from,
    to,
    groupBy: 'campaign',
    limit: 250,
    sort: 'conversions',
    direction: 'desc',
    ...(settings?.voluum_campaign_filter ? { campaignName: settings.voluum_campaign_filter } : {}),
  });

  const dateRange = `${from.slice(0, 10)} / ${to.slice(0, 10)}`;
  const reportDate = to.slice(0, 10);
  const normalized = normalizeRows(raw.rows ?? [], dateRange)
    .filter((row) => row.visits > 0 || row.clicks > 0 || row.conversions > 0 || row.revenue !== 0 || row.profit !== 0);

  const nameFiltered = filterByConfiguredName(normalized, settings?.voluum_campaign_filter ?? '');
  const accountFiltered = filterByCampaigns(
    nameFiltered,
    context.campaigns ?? [],
    settings?.voluum_match_mode ?? 'auto'
  );

  return accountFiltered.map((row): VoluumRow => ({
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
    voluum_conversions: selectedConversions(row, settings),
    revenue: row.revenue,
    profit: row.profit,
    roi: row.roi,
  }));
}
