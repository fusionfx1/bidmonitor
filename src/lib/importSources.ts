import type { DataTableKey, ImportedData, TableMeta } from '../types';

export const LIVE_API_KEYS: DataTableKey[] = ['voluum'];

export interface LiveApiImportStatus {
  key: DataTableKey;
  label: string;
  description: string;
  rows: number;
  importedAt: string | null;
  source: string;
  sourceLabel: string;
  status: 'synced' | 'fallback' | 'missing';
  reportRows: number | null;
  activeCampaignRows: number | null;
  filteredInactiveRows: number | null;
  activeMetadataRows: number | null;
  allMetadataRows: number | null;
  metadataLoaded: boolean;
}

export function isLiveApiKey(key: DataTableKey): boolean {
  return LIVE_API_KEYS.includes(key);
}

export function isLiveVoluumSource(meta?: TableMeta): boolean {
  return Boolean(meta?.source?.startsWith('voluum-api:'));
}

export function sourceTabName(source?: string): string | null {
  if (!source?.startsWith('sheet:')) return null;
  const parts = source.split('/');
  return parts[parts.length - 1] || null;
}

function readNumber(source: string, key: string): number | null {
  const part = source.split(':').find((item) => item.startsWith(`${key}=`));
  if (!part) return null;
  const value = Number(part.slice(key.length + 1));
  return Number.isFinite(value) ? value : null;
}

function readBoolean(source: string, key: string): boolean {
  const part = source.split(':').find((item) => item.startsWith(`${key}=`));
  return part === `${key}=1` || part === `${key}=true`;
}

function voluumSourceLabel(source: string, isApi: boolean): string {
  if (!source) return 'Not imported yet';
  if (!isApi) return 'Google Sheet fallback / voluum_performance';
  const activeLabel = source.includes(':active:') ? ' / active only' : '';
  const matchLabel = source.includes(':strict:') ? 'strict match' : source.includes(':all:') ? 'all rows' : 'auto match';
  if (source.includes('empty-or-filtered')) return `Voluum API / last30 / campaign${activeLabel} / empty or filtered`;
  return `Voluum API / last30 / campaign${activeLabel} / ${matchLabel}`;
}

export function getVoluumLiveImportStatus(data: ImportedData): LiveApiImportStatus {
  const meta = data.meta.voluum;
  const rows = data.voluum.length || meta?.rows || 0;
  const source = meta?.source ?? '';
  const importedAt = meta?.importedAt ?? null;
  const isApi = source.startsWith('voluum-api:');
  const hasApiRows = isApi && rows > 0;

  return {
    key: 'voluum',
    label: 'Voluum Campaign Report',
    description: 'Live campaign data used by Overview for conversions, revenue, CPA, ROI, and ROAS.',
    rows: hasApiRows ? rows : 0,
    importedAt,
    source,
    sourceLabel: voluumSourceLabel(source, isApi),
    status: hasApiRows ? 'synced' : !isApi && source ? 'fallback' : 'missing',
    reportRows: readNumber(source, 'report'),
    activeCampaignRows: readNumber(source, 'active'),
    filteredInactiveRows: readNumber(source, 'filtered'),
    activeMetadataRows: readNumber(source, 'metaActive'),
    allMetadataRows: readNumber(source, 'metaAll'),
    metadataLoaded: readBoolean(source, 'metaLoaded'),
  };
}
