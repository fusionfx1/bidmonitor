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

function voluumSourceLabel(source: string, isApi: boolean): string {
  if (!source) return 'Not imported yet';
  if (!isApi) return 'Google Sheet fallback / voluum_performance';
  if (source.includes('empty-or-filtered')) return 'Voluum API / last30 / campaign / empty or filtered';
  if (source.includes('strict')) return 'Voluum API / last30 / campaign / strict match';
  if (source.includes('all')) return 'Voluum API / last30 / campaign / all rows';
  return 'Voluum API / last30 / campaign / auto match';
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
  };
}
