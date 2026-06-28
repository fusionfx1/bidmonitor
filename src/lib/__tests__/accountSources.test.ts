import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type AccountSource, type Settings } from '../../types';
import {
  addActiveAccountScope,
  filterRowsByActiveAccount,
  getActiveAccountSource,
  getActiveAccountScope,
  makeAccountSource,
  normalizeAccountSources,
} from '../accountSources';

const accountA: AccountSource = {
  id: 'source-a',
  account_id: 'acct-a',
  customer_id: '1111111111',
  account_name: 'Account A',
  spreadsheet_id: 'sheet-a',
  spreadsheet_url: 'https://docs.google.com/spreadsheets/d/sheet-a',
  sheet_tab_name: 'GoogleExport',
  timezone: 'Asia/Bangkok',
  currency: 'THB',
  enabled: true,
};

const accountB: AccountSource = {
  ...accountA,
  id: 'source-b',
  account_id: 'acct-b',
  customer_id: '2222222222',
  account_name: 'Account B',
  spreadsheet_id: 'sheet-b',
};

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...DEFAULT_SETTINGS,
    account_sources: [accountA, accountB],
    selected_account_source_id: accountA.id,
    ...overrides,
  };
}

describe('account sources', () => {
  it('creates a complete account source model', () => {
    expect(makeAccountSource({
      account_id: 'acct-x',
      customer_id: '3333333333',
      account_name: 'Account X',
      spreadsheet_id: 'sheet-x',
    })).toMatchObject({
      account_id: 'acct-x',
      customer_id: '3333333333',
      account_name: 'Account X',
      spreadsheet_id: 'sheet-x',
      sheet_tab_name: 'GoogleExport',
      timezone: 'Asia/Bangkok',
      currency: 'THB',
      enabled: true,
    });
  });

  it('selects only enabled configured account sources', () => {
    expect(getActiveAccountSource(settings({ selected_account_source_id: accountB.id }))).toEqual(accountB);
    expect(getActiveAccountSource(settings({ account_sources: [{ ...accountA, enabled: false }] }))).toBeNull();
  });

  it('returns account scope from the selected source', () => {
    expect(getActiveAccountScope(settings({ selected_account_source_id: accountB.id }))).toEqual({
      account_id: 'acct-b',
      customer_id: '2222222222',
      source_sheet_id: 'sheet-b',
    });
  });

  it('migrates legacy single-sheet settings into one source', () => {
    const normalized = normalizeAccountSources({
      ...DEFAULT_SETTINGS,
      account_id: 'legacy-acct',
      customer_id: '9999999999',
      sheet_id: 'legacy-sheet',
      currency: 'USD',
    });

    expect(normalized.account_sources).toHaveLength(1);
    expect(normalized.selected_account_source_id).toBe('');
    expect(normalized.account_sources[0]).toMatchObject({
      account_id: 'legacy-acct',
      customer_id: '9999999999',
      spreadsheet_id: 'legacy-sheet',
      currency: 'USD',
      enabled: true,
    });
  });

  it('does not auto-select an account source when selection is empty', () => {
    const normalized = normalizeAccountSources(settings({ selected_account_source_id: '' }));

    expect(normalized.account_sources).toHaveLength(2);
    expect(normalized.selected_account_source_id).toBe('');
    expect(getActiveAccountSource(normalized)).toBeNull();
  });

  it('adds selected account scope to imported rows', () => {
    expect(addActiveAccountScope([{ keyword_key: 'k1' }], settings({ selected_account_source_id: accountB.id }))).toEqual([
      {
        keyword_key: 'k1',
        account_id: 'acct-b',
        customer_id: '2222222222',
        source_sheet_id: 'sheet-b',
      },
    ]);
  });

  it('filters mixed account rows to the selected source only', () => {
    const rows = [
      { keyword_key: 'a', account_id: 'acct-a', customer_id: '1111111111', source_sheet_id: 'sheet-a' },
      { keyword_key: 'b', account_id: 'acct-b', customer_id: '2222222222', source_sheet_id: 'sheet-b' },
      { keyword_key: 'global' },
    ];

    expect(filterRowsByActiveAccount(rows, settings({ selected_account_source_id: accountB.id }))).toEqual([
      { keyword_key: 'b', account_id: 'acct-b', customer_id: '2222222222', source_sheet_id: 'sheet-b' },
    ]);
    expect(filterRowsByActiveAccount(rows, settings({ selected_account_source_id: '' }))).toEqual([]);
  });
});
