import type {
  ImportedData, DataTableKey, TableMeta,
  CampaignRow, AdGroupRow, KeywordRow, SearchTermRow, HourDeviceRow,
  PolicyRow, AuctionCampaignRow, AuctionKeywordRow, VoluumRow, GoogleSyncLogRow,
  PmaxPerformanceRow, GeoPerformanceRow, PlacementPerformanceRow,
  ApprovalStatus,
} from '../types';

const DATA_KEY = 'gads_monitor_data';
const META_KEY = 'gads_monitor_meta';
const BID_APPROVALS_KEY = 'gads_monitor_bid_approvals';
const NEG_APPROVALS_KEY = 'gads_monitor_neg_approvals';

const EMPTY_DATA: ImportedData = {
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

// Chunk size for localStorage writes (avoid 5MB limit per key)
const MAX_ROWS_INLINE = 50000;

function migrateImportedData(data: ImportedData): ImportedData {
  const voluumSource = data.meta.voluum?.source ?? '';
  const isActiveApiImport = voluumSource.startsWith('voluum-api:last30/campaign:active:');
  const hasFilterCounters = voluumSource.includes(':report=') && voluumSource.includes(':active=') && voluumSource.includes(':filtered=');

  if (isActiveApiImport && !hasFilterCounters && data.voluum.length > 0) {
    return {
      ...data,
      voluum: [],
      meta: {
        ...data.meta,
        voluum: {
          rows: 0,
          importedAt: new Date().toISOString(),
          source: `${voluumSource}:resync-required`,
        },
      },
    };
  }

  return data;
}

export function loadData(): ImportedData {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return { ...EMPTY_DATA };
    return migrateImportedData({ ...EMPTY_DATA, ...JSON.parse(raw) });
  } catch {
    return { ...EMPTY_DATA };
  }
}

export function saveTableData<T>(
  tableKey: DataTableKey,
  rows: T[],
  source: string
): void {
  const stored = loadData();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (stored as any)[tableKey] = rows.slice(0, MAX_ROWS_INLINE);
  stored.meta[tableKey] = {
    rows: rows.length,
    importedAt: new Date().toISOString(),
    source,
  };
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(stored));
  } catch (e) {
    console.error('localStorage quota exceeded, try importing fewer rows.', e);
  }
}

export function clearTableData(tableKey: DataTableKey, source = 'cleared:missing-source'): void {
  const stored = loadData();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (stored as any)[tableKey] = [];
  stored.meta[tableKey] = {
    rows: 0,
    importedAt: new Date().toISOString(),
    source,
  };
  localStorage.setItem(DATA_KEY, JSON.stringify(stored));
}

export function loadTableMeta(): Partial<Record<DataTableKey, TableMeta>> {
  try {
    const d = loadData();
    return d.meta ?? {};
  } catch {
    return {};
  }
}

export function clearAllData(): void {
  localStorage.removeItem(DATA_KEY);
  localStorage.removeItem(META_KEY);
}

// Approval state persistence
export function loadBidApprovals(): Record<string, ApprovalStatus> {
  try {
    const raw = localStorage.getItem(BID_APPROVALS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveBidApprovals(approvals: Record<string, ApprovalStatus>): void {
  localStorage.setItem(BID_APPROVALS_KEY, JSON.stringify(approvals));
}

export function loadNegApprovals(): Record<string, ApprovalStatus> {
  try {
    const raw = localStorage.getItem(NEG_APPROVALS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveNegApprovals(approvals: Record<string, ApprovalStatus>): void {
  localStorage.setItem(NEG_APPROVALS_KEY, JSON.stringify(approvals));
}

// Type-specific loaders
export function getCampaigns(): CampaignRow[] { return loadData().campaigns; }
export function getAdGroups(): AdGroupRow[] { return loadData().adGroups; }
export function getKeywords(): KeywordRow[] { return loadData().keywords; }
export function getSearchTerms(): SearchTermRow[] { return loadData().searchTerms; }
export function getHourDevice(): HourDeviceRow[] { return loadData().hourDevice; }
export function getPolicyRows(): PolicyRow[] { return loadData().policy; }
export function getAuctionCampaigns(): AuctionCampaignRow[] { return loadData().auctionCampaigns; }
export function getAuctionKeywords(): AuctionKeywordRow[] { return loadData().auctionKeywords; }
export function getPmaxPerformance(): PmaxPerformanceRow[] { return loadData().pmaxPerformance ?? []; }
export function getGeoPerformance(): GeoPerformanceRow[] { return loadData().geoPerformance ?? []; }
export function getPlacementPerformance(): PlacementPerformanceRow[] { return loadData().placementPerformance ?? []; }
export function getVoluumRows(): VoluumRow[] { return loadData().voluum; }
export function getSyncLog(): GoogleSyncLogRow[] { return loadData().syncLog; }
