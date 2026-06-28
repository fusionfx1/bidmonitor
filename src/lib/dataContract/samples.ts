import { CONTRACT_TAB_NAMES, TAB_CONTRACTS, getTabContract } from './contract';
import type { ContractField, ContractTabName } from './contract';

export type SampleRows = Record<ContractTabName, Record<string, string | number | boolean>>;

export const SAMPLE_ROWS = Object.fromEntries(
  TAB_CONTRACTS.map((tab) => [
    tab.tabName,
    Object.fromEntries(tab.fields.map((field) => [field.name, sampleValue(field)])),
  ])
) as SampleRows;

export function sampleRowToCSV(tabName: ContractTabName): string {
  if (!CONTRACT_TAB_NAMES.includes(tabName)) {
    throw new Error(`Unknown data contract tab: ${tabName}`);
  }

  const tab = getTabContract(tabName);
  const row = SAMPLE_ROWS[tabName];
  const headers = tab.fields.map((field) => field.name);
  const values = headers.map((header) => csvCell(row[header]));
  return `${headers.join(',')}\n${values.join(',')}`;
}

function sampleValue(field: ContractField): string | number | boolean {
  if (field.allowedValues?.length) return field.allowedValues[0];

  switch (field.type) {
    case 'date':
      return '2026-06-27';
    case 'datetime':
      return '2026-06-27T00:00:00.000Z';
    case 'number':
      return 12.5;
    case 'integer':
      return 12;
    case 'boolean':
      return false;
    case 'json':
      return JSON.stringify({ enabled: false });
    case 'string':
    case 'enum':
    default:
      return `${field.name}_sample`;
  }
}

function csvCell(value: string | number | boolean): string {
  const raw = String(value);
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}
