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

export function getVoluumLiveImportStatus(data: ImportedData): LiveApiImportStatus {
  const meta = data.meta.voluum;
  const rows = data.voluum.length || meta?.rows || 0;
  const source = meta?.source ?? '';
  const importedAt = meta?.importedAt ?? null;
  const isApi = source.startsWith('voluum-api:');

  return {
    key: 'voluum',
    label: 'Voluum Campaign Report',
    description: 'Live campaign data used by Overview for conversions, revenue, CPA, ROI, and ROAS.',
    rows: isApi ? rows : 0,
    importedAt,
    source,
    sourceLabel: isApi ? 'Voluum API / last30 / campaign' : source ? 'Google Sheet fallback / voluum_performance' : 'Not imported yet',
    status: isApi && rows > 0 ? 'synced' : source ? 'fallback' : 'missing',
  };
}
