import type { DataTableKey } from '../../types';
import { getCurrentImportTabs } from '../dataContract/contract';

export const REQUIRED_COLUMNS: Record<DataTableKey, string[]> = Object.fromEntries(
  getCurrentImportTabs().map((tab) => [tab.key, tab.requiredColumns])
) as Record<DataTableKey, string[]>;

export interface ValidationResult {
  valid: boolean;
  missingColumns: string[];
  presentColumns: string[];
}

export function validateHeaders(
  rows: Record<string, unknown>[],
  tableKey: DataTableKey
): ValidationResult {
  if (!rows.length) return { valid: false, missingColumns: [], presentColumns: [] };
  const presentColumns = Object.keys(rows[0]).map((k) => k.toLowerCase());
  const required = REQUIRED_COLUMNS[tableKey];
  const missingColumns = required.filter((col) => !presentColumns.includes(col));
  return {
    valid: missingColumns.length === 0,
    missingColumns,
    presentColumns,
  };
}
