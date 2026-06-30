import type { CampaignRow, Settings, VoluumMatchMode, VoluumRow } from '../../types';
import type { AccountSourceScope } from '../accountSources';
import { fetchVoluumCampaigns, fetchVoluumReport, resolveDateRange } from './api';
import { normalizeRows } from './normalize';
import type { NormalizedVoluumRow, VoluumCampaignMeta } from './types';

interface DashboardVoluumContext {
  campaigns?: CampaignRow[];
  settings?: Settings;
}

interface ActiveCampaignIndex {
  loaded: boolean;
  activeMetadataRows: number;
  allMetadataRows: number;
  ids: Set<string>;
  names: Set<string>;
}

export interface DashboardVoluumImportResult {
  rows: VoluumRow[];
  reportRows: number;
  activeCampaignRows: number;
  filteredInactiveRows: number;
  activeMetadataRows: number;
  allMetadataRows: number;
  metadataLoaded: boolean;
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9ก-๙]+/g, ' ').trim();
}

function compactDigits(value: string): string {
  return value.replace(/\D+/g, '');
}

function safeString(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function campaignMetaRows(payload: { rows?: VoluumCampaignMeta[]; campaigns?: VoluumCampaignMeta[]; items?: VoluumCampaignMeta[]; data?: VoluumCampaignMeta[] }): VoluumCampaignMeta[] {
  return payload.rows ?? payload.campaigns ?? payload.items ?? payload.data ?? [];
}

function campaignMetaId(row: VoluumCampaignMeta): string {
  return safeString(row.id || row.campaignId || row.campaign?.id);
}

function campaignMetaName(row: VoluumCampaignMeta): string {
  return safeString(row.name || row.campaignName || row.campaign?.name);
}

async function fetchActiveCampaignIndex(): Promise<ActiveCampaignIndex> {
  try {
    const [activeResponse, allResponse] = await Promise.all([
      fetchVoluumCampaigns('active'),
      fetchVoluumCampaigns('all'),
    ]);
    const activeRows = campaignMetaRows(activeResponse);
    const allRows = campaignMetaRows(allResponse);
    return {
      loaded: true,
      activeMetadataRows: activeRows.length,
      allMetadataRows: allRows.length || activeRows.length,
      ids: new Set(activeRows.map((row) => compactDigits(campaignMetaId(row))).filter(Boolean)),
      names: new Set(activeRows.map((row) => norm(campaignMetaName(row))).filter(Boolean)),
    };
  } catch (e) {
    console.warn('[BitMonitor] Active Voluum campaign metadata unavailable; using report rows:', e);
    return { loaded: false, activeMetadataRows: 0, allMetadataRows: 0, ids: new Set(), names: new Set() };
  }
}

function filterByActiveCampaigns(rows: NormalizedVoluumRow[], active: ActiveCampaignIndex): NormalizedVoluumRow[] {
  if (!active.loaded) return rows;
  return rows.filter((row) => {
    const rowId = compactDigits(row.campaignId);
    const rowName = norm(row.campaignName);
    return Boolean(
      (rowId && active.ids.has(rowId))
      || (rowName && active.names.has(rowName))
    );
  });
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

  // auto mode keeps active Voluum rows when Google Ads campaign names/IDs cannot be matched.
  // strict mode stays fail-closed for accounts that require explicit Google↔Voluum matching.
  return matchMode === 'auto' ? rows : [];
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

function toVoluumRow(row: NormalizedVoluumRow, scope: AccountSourceScope, reportDate: string, settings?: Settings): VoluumRow {
  return {
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
  };
}

export async function fetchVoluumDashboardImport(
  scope: AccountSourceScope,
  context: DashboardVoluumContext = {}
): Promise<DashboardVoluumImportResult> {
  const settings = context.settings;
  const { from, to } = resolveDateRange('last30');
  const [raw, activeCampaigns] = await Promise.all([
    fetchVoluumReport({
      from,
      to,
      groupBy: 'campaign',
      limit: 250,
      sort: 'conversions',
      direction: 'desc',
      ...(settings?.voluum_campaign_filter ? { campaignName: settings.voluum_campaign_filter } : {}),
    }),
    fetchActiveCampaignIndex(),
  ]);

  const dateRange = `${from.slice(0, 10)} / ${to.slice(0, 10)}`;
  const reportDate = to.slice(0, 10);
  const normalized = normalizeRows(raw.rows ?? [], dateRange)
    .filter((row) => row.visits > 0 || row.clicks > 0 || row.conversions > 0 || row.revenue !== 0 || row.profit !== 0);

  const activeOnly = filterByActiveCampaigns(normalized, activeCampaigns);
  const nameFiltered = filterByConfiguredName(activeOnly, settings?.voluum_campaign_filter ?? '');
  const accountFiltered = filterByCampaigns(
    nameFiltered,
    context.campaigns ?? [],
    settings?.voluum_match_mode ?? 'auto'
  );

  return {
    rows: accountFiltered.map((row) => toVoluumRow(row, scope, reportDate, settings)),
    reportRows: normalized.length,
    activeCampaignRows: activeOnly.length,
    filteredInactiveRows: Math.max(0, normalized.length - activeOnly.length),
    activeMetadataRows: activeCampaigns.activeMetadataRows,
    allMetadataRows: activeCampaigns.allMetadataRows,
    metadataLoaded: activeCampaigns.loaded,
  };
}

export async function fetchVoluumRowsForDashboard(
  scope: AccountSourceScope,
  context: DashboardVoluumContext = {}
): Promise<VoluumRow[]> {
  const result = await fetchVoluumDashboardImport(scope, context);
  return result.rows;
}
