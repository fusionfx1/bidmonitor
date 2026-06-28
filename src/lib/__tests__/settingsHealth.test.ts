import { describe, expect, it } from 'vitest';
import type { ImportedData, Settings } from '../../types';
import { DEFAULT_SETTINGS } from '../../types';
import {
  COPY_SCRIPT_UPDATE_VERSION,
  DANGER_ACTIONS,
  buildScriptUpdateCopy,
  buildSettingsHealth,
  maskSensitiveValue,
  normalizeSafeActionMode,
} from '../settingsHealth';

const baseData: ImportedData = {
  campaigns: [],
  adGroups: [],
  keywords: [],
  searchTerms: [],
  hourDevice: [],
  policy: [],
  auctionCampaigns: [],
  auctionKeywords: [],
  voluum: [],
  syncLog: [],
  meta: {},
};

function settings(overrides: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

describe('settings health safe state', () => {
  it('normalizes unsupported modes back to review_only', () => {
    expect(normalizeSafeActionMode('review_only')).toBe('review_only');
    expect(normalizeSafeActionMode('disabled')).toBe('disabled');
    expect(normalizeSafeActionMode('semi_auto_ready')).toBe('review_only');
    expect(normalizeSafeActionMode(undefined)).toBe('review_only');
  });

  it('masks tokens and URLs without exposing the original value', () => {
    expect(maskSensitiveValue('')).toBe('not configured');
    expect(maskSensitiveValue('tok_1234567890_secret')).toBe('tok_...cret');
    expect(maskSensitiveValue('https://example.supabase.co/rest/v1')).toBe('https://exa...e.co/...');
  });

  it('summarizes accounts from local settings and imported data only', () => {
    const health = buildSettingsHealth(
      settings({
        action_mode: 'dry_run',
        sheet_id: 'https://docs.google.com/spreadsheets/d/abcdef1234567890/edit',
        sheet_auto_refresh: '15min',
        account_sources: [
          {
            id: 'source-a',
            account_id: 'acct-main',
            customer_id: '1234567890',
            account_name: 'Main Account',
            spreadsheet_id: 'sheet-secret-abcdef',
            spreadsheet_url: 'https://docs.google.com/spreadsheets/d/sheet-secret-abcdef/edit',
            sheet_tab_name: 'google_campaigns',
            timezone: 'Asia/Bangkok',
            currency: 'THB',
            enabled: true,
          },
        ],
        selected_account_source_id: 'source-a',
      }),
      {
        ...baseData,
        campaigns: [{ campaign_id: '1' } as never],
        syncLog: [
          {
            run_id: 'run-1',
            started_at: '2026-06-27T10:00:00.000Z',
            finished_at: '2026-06-27T10:01:00.000Z',
            status: 'SUCCESS',
            duration_seconds: 60,
            trigger_type: 'timer',
            lookback_days: 1,
            tabs_updated: 1,
            campaign_rows: 1,
            adgroup_rows: 0,
            keyword_rows: 0,
            search_term_rows: 0,
            hour_device_rows: 0,
            policy_rows: 0,
            auction_campaign_rows: 0,
            auction_keyword_rows: 0,
            voluum_rows: 0,
            error_message: '',
            script_version: 'tm1-script',
          },
        ],
        meta: {
          campaigns: {
            rows: 1,
            importedAt: '2026-06-27T10:01:00.000Z',
            source: 'sheet:abc/google_campaigns',
          },
        },
      }
    );

    expect(health.safeMode).toBe('review_only');
    expect(health.latestScriptVersion).toBe('tm1-script');
    expect(health.accountCards.find((card) => card.id === 'account_source_source-a')).toMatchObject({
      title: 'Main Account',
      status: 'Connected locally',
      values: expect.arrayContaining([
        { label: 'Customer ID', value: '1234567890' },
        { label: 'Account ID', value: 'acct-main' },
        { label: 'Schedule', value: '15min' },
      ]),
    });
    expect(JSON.stringify(health.accountCards)).not.toContain('sheet-secret-abcdef');
    expect(health.accountCards.find((card) => card.id === 'google_ads')?.values).toEqual(
      expect.arrayContaining([
        { label: 'Mode', value: 'Review only' },
        { label: 'Currency', value: 'THB' },
      ])
    );
    expect(health.dataSources.find((source) => source.key === 'campaigns')?.tone).toBe('ok');
  });

  it('keeps script update copy free of secret material', () => {
    const copy = buildScriptUpdateCopy(
      settings({ sheet_id: 'https://docs.google.com/spreadsheets/d/sheet-secret-token/edit' }),
      'tm1-script'
    );

    expect(copy).toContain(COPY_SCRIPT_UPDATE_VERSION);
    expect(copy).toContain('Keep Google Ads mutate calls disabled.');
    expect(copy).not.toContain('sheet-secret-token');
    expect(copy).not.toMatch(/service[-_ ]?role/i);
  });

  it('declares danger actions as local or placeholder only', () => {
    expect(DANGER_ACTIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'rotate_feed_token', backendCall: 'placeholder', localSettingsWrite: false }),
        expect.objectContaining({ id: 'disconnect_account', backendCall: 'placeholder', localSettingsWrite: false }),
        expect.objectContaining({ id: 'disable_automation', backendCall: 'none', localSettingsWrite: true }),
      ])
    );
  });
});
