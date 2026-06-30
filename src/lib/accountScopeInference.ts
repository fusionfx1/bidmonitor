import type { Settings } from '../types';
import { makeAccountSource } from './accountSources';
import type { AccountSourceScope } from './accountSources';

type RawRow = Record<string, unknown>;

function clean(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function firstValue(rows: RawRow[], keys: string[]): string {
  for (const row of rows) {
    for (const key of keys) {
      const value = clean(row[key]);
      if (value) return value;
    }
  }
  return '';
}

export function inferAccountScopeFromRows(rows: RawRow[], spreadsheetId: string): AccountSourceScope | null {
  const customerId = firstValue(rows, ['customer_id', 'google_ads_customer_id', 'customer']);
  const accountId = firstValue(rows, ['account_id', 'customer_id', 'google_ads_customer_id', 'customer']);

  if (!customerId || !accountId || !spreadsheetId) return null;

  return {
    account_id: accountId,
    customer_id: customerId,
    source_sheet_id: spreadsheetId,
  };
}

export function applyAccountScope<T extends object>(rows: T[], scope: AccountSourceScope): (T & AccountSourceScope)[] {
  return rows.map((row) => ({ ...row, ...scope }));
}

export function ensureAccountSourceForScope(
  settings: Settings,
  scope: AccountSourceScope,
  rawSheetInput: string
): Settings {
  const existing = settings.account_sources.find((source) =>
    source.account_id === scope.account_id
    && source.customer_id === scope.customer_id
    && source.spreadsheet_id === scope.source_sheet_id
  );

  const source = existing ?? makeAccountSource({
    account_id: scope.account_id,
    customer_id: scope.customer_id,
    account_name: `Account ${scope.customer_id}`,
    spreadsheet_id: scope.source_sheet_id,
    spreadsheet_url: rawSheetInput.startsWith('http') ? rawSheetInput : '',
    currency: settings.currency,
    enabled: true,
  });

  return {
    ...settings,
    account_id: source.account_id,
    customer_id: source.customer_id,
    sheet_id: source.spreadsheet_id,
    account_sources: [
      ...settings.account_sources.filter((candidate) => candidate.id !== source.id),
      source,
    ],
    selected_account_source_id: source.id,
  };
}
