import type { AccountSource, Settings } from '../types';

const DEFAULT_TAB_NAME = 'GoogleExport';
const DEFAULT_TIMEZONE = 'Asia/Bangkok';

export type AccountSourceScope = {
  account_id: string;
  customer_id: string;
  source_sheet_id: string;
};

function stableId(parts: string[]): string {
  const source = parts.filter(Boolean).join(':') || 'account-source';
  return source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'account-source';
}

export function makeAccountSource(input: Partial<AccountSource>): AccountSource {
  const spreadsheetId = input.spreadsheet_id?.trim() ?? '';
  const accountId = input.account_id?.trim() ?? '';
  const customerId = input.customer_id?.trim() ?? '';

  return {
    id: input.id?.trim() || stableId([accountId, customerId, spreadsheetId]),
    account_id: accountId,
    customer_id: customerId,
    account_name: input.account_name?.trim() || accountId || customerId || 'Google Ads Account',
    spreadsheet_id: spreadsheetId,
    spreadsheet_url: input.spreadsheet_url?.trim() ?? '',
    sheet_tab_name: input.sheet_tab_name?.trim() || DEFAULT_TAB_NAME,
    timezone: input.timezone?.trim() || DEFAULT_TIMEZONE,
    currency: input.currency?.trim() || 'THB',
    enabled: input.enabled ?? true,
  };
}

function isConfigured(source: AccountSource): boolean {
  return Boolean(source.account_id && source.customer_id && source.spreadsheet_id);
}

export function normalizeAccountSources(settings: Settings): Settings {
  const sources = (settings.account_sources ?? [])
    .map(makeAccountSource)
    .filter(isConfigured);

  if (!sources.length && settings.account_id && settings.customer_id && settings.sheet_id) {
    sources.push(makeAccountSource({
      account_id: settings.account_id,
      customer_id: settings.customer_id,
      account_name: settings.account_id,
      spreadsheet_id: settings.sheet_id,
      spreadsheet_url: settings.sheet_id.startsWith('http') ? settings.sheet_id : '',
      currency: settings.currency,
    }));
  }

  const selectedExists = sources.some((source) => source.id === settings.selected_account_source_id);
  const selectedId = settings.selected_account_source_id && selectedExists ? settings.selected_account_source_id : '';

  return {
    ...settings,
    account_sources: sources,
    selected_account_source_id: selectedId,
  };
}

export function getActiveAccountSource(settings: Settings): AccountSource | null {
  const normalized = normalizeAccountSources(settings);
  return normalized.account_sources.find((source) =>
    source.id === normalized.selected_account_source_id
    && source.enabled
    && isConfigured(source)
  ) ?? null;
}

export function getActiveAccountScope(settings: Settings): AccountSourceScope | null {
  const source = getActiveAccountSource(settings);
  if (!source) return null;
  return {
    account_id: source.account_id,
    customer_id: source.customer_id,
    source_sheet_id: source.spreadsheet_id,
  };
}

export function getActiveSpreadsheetId(settings: Settings): string {
  return getActiveAccountSource(settings)?.spreadsheet_id ?? settings.sheet_id;
}

export type AccountScopedRow = {
  account_id?: string;
  customer_id?: string;
  source_sheet_id?: string;
};

export function addActiveAccountScope<T extends object>(rows: T[], settings: Settings): (T & AccountScopedRow)[] {
  const scope = getActiveAccountScope(settings);
  if (!scope) return rows as (T & AccountScopedRow)[];
  return rows.map((row) => ({ ...row, ...scope }));
}

export function asAccountSourceScope(settings: Settings): AccountSourceScope | null {
  const scope = getActiveAccountScope(settings);
  if (!scope) return null;
  return { ...scope };
}

export function matchesAccountScope(row: AccountScopedRow, scope: AccountSourceScope): boolean {
  return row.account_id === scope.account_id
    && row.customer_id === scope.customer_id
    && row.source_sheet_id === scope.source_sheet_id;
}

export function filterRowsByActiveAccount<T extends AccountScopedRow>(rows: T[], settings: Settings): T[] {
  const scope = getActiveAccountScope(settings);
  if (!scope) return [];
  return rows.filter((row) =>
    row.account_id === scope.account_id
    && row.customer_id === scope.customer_id
    && row.source_sheet_id === scope.source_sheet_id
  );
}
