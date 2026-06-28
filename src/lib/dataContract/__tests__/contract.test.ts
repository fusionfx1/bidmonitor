import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_CONFIG_SCHEMA,
  CONTRACT_TAB_NAMES,
  DATA_CONTRACT_VERSION,
  DATA_CONTRACT_WRITE_CAPABILITIES,
  DB_IMPORT_FIELDS,
  DEFAULT_ACCOUNT_CONFIG,
  GUARDRAIL_CONFIG_SCHEMA,
  TAB_CONTRACTS,
  getTabContract,
  validateAccountConfig,
  validateGuardrailConfig,
  validateTabHeaders,
  validateTabRow,
} from '../contract';

describe('data contract registry', () => {
  it('declares the stable Task 1 sheet/feed tabs', () => {
    expect(DATA_CONTRACT_VERSION).toMatch(/^tm1\./);
    expect(CONTRACT_TAB_NAMES).toEqual([
      'google_campaigns',
      'google_adgroups',
      'google_keywords',
      'google_search_terms',
      'google_hour_device',
      'google_ads_policy',
      'google_auction_proxy_campaigns',
      'google_auction_proxy_keywords',
      'voluum_performance',
      'google_sync_log',
      'google_pmax_performance',
      'google_geo_performance',
      'google_placement_performance',
      'google_budget_pacing',
      'google_conversion_actions',
      'voluum_true_profit',
      'audit_log',
      'account_config',
      'guardrail_config',
    ]);
  });

  it('exposes every tab through getTabContract', () => {
    for (const tabName of CONTRACT_TAB_NAMES) {
      expect(getTabContract(tabName).tabName).toBe(tabName);
    }
  });

  it('rejects unknown tab names', () => {
    expect(() => getTabContract('google_unknown')).toThrow('Unknown data contract tab');
  });

  it('validates exact headers for every tab', () => {
    for (const tab of TAB_CONTRACTS) {
      const headers = tab.fields.map((field) => field.name);
      expect(validateTabHeaders(tab.tabName, headers)).toEqual({
        valid: true,
        missingColumns: [],
        extraColumns: [],
        presentColumns: headers,
      });
    }
  });

  it('reports missing and extra headers', () => {
    const result = validateTabHeaders('google_campaigns', ['date', 'campaign_id', 'unexpected']);

    expect(result.valid).toBe(false);
    expect(result.missingColumns).toContain('campaign_name');
    expect(result.extraColumns).toEqual(['unexpected']);
  });

  it('validates declared scalar types and required values', () => {
    const valid = validateTabRow('google_budget_pacing', {
      date: '2026-06-27',
      account_id: '123',
      campaign_id: '456',
      campaign_name: 'Search Alpha',
      daily_budget: '100.50',
      cost_today: '24.25',
      budget_spent_percent: '24.1%',
      budget_lost_impression_share: '0.12',
      pacing_status: 'ON_TRACK',
      recommended_budget: '110',
      review_status: 'PENDING_REVIEW',
    });

    expect(valid.valid).toBe(true);

    const invalid = validateTabRow('google_budget_pacing', {
      date: 'not-a-date',
      account_id: '',
      campaign_id: '456',
      campaign_name: 'Search Alpha',
      daily_budget: 'not-number',
      cost_today: '24.25',
      budget_spent_percent: '24.1%',
      budget_lost_impression_share: '0.12',
      pacing_status: 'NOT_A_STATUS',
      recommended_budget: '110',
      review_status: 'PENDING_REVIEW',
    });

    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'date', code: 'invalid_type' }),
        expect.objectContaining({ field: 'account_id', code: 'required' }),
        expect.objectContaining({ field: 'daily_budget', code: 'invalid_type' }),
        expect.objectContaining({ field: 'pacing_status', code: 'invalid_enum' }),
      ])
    );
  });
});

describe('account config and guardrails', () => {
  it('keeps account action mode review_only by default', () => {
    expect(DEFAULT_ACCOUNT_CONFIG.action_mode).toBe('review_only');
    expect(ACCOUNT_CONFIG_SCHEMA.action_mode.allowedValues).toEqual([
      'review_only',
      'disabled',
    ]);
  });

  it('validates account config shape', () => {
    expect(validateAccountConfig(DEFAULT_ACCOUNT_CONFIG)).toEqual({ valid: true, errors: [] });
    expect(validateAccountConfig({ ...DEFAULT_ACCOUNT_CONFIG, action_mode: 'semi_auto_ready' })).toEqual({
      valid: false,
      errors: [
        {
          field: 'action_mode',
          code: 'invalid_enum',
          message: 'action_mode must be one of review_only, disabled',
        },
      ],
    });
  });

  it('rejects guardrail JSON that enables writes or mutate operations', () => {
    expect(GUARDRAIL_CONFIG_SCHEMA.defaultValue.allow_google_ads_mutate).toBe(false);
    expect(
      validateGuardrailConfig({
        ...GUARDRAIL_CONFIG_SCHEMA.defaultValue,
        allow_google_ads_mutate: true,
      })
    ).toEqual({
      valid: false,
      errors: [
        {
          field: 'allow_google_ads_mutate',
          code: 'write_path_enabled',
          message: 'Google Ads mutate paths must remain disabled for Task 1.',
        },
      ],
    });
  });

  it.each([
    {
      configJsonShape: 'stringified',
      flag: 'allow_google_ads_mutate',
      message: 'Google Ads mutate paths must remain disabled for Task 1.',
    },
    {
      configJsonShape: 'stringified',
      flag: 'allow_external_writes',
      message: 'External write paths must remain disabled for Task 1.',
    },
    {
      configJsonShape: 'object',
      flag: 'allow_google_ads_mutate',
      message: 'Google Ads mutate paths must remain disabled for Task 1.',
    },
    {
      configJsonShape: 'object',
      flag: 'allow_external_writes',
      message: 'External write paths must remain disabled for Task 1.',
    },
  ] as const)(
    'rejects $flag inside $configJsonShape guardrail config_json',
    ({ configJsonShape, flag, message }) => {
      const configJson = {
        ...GUARDRAIL_CONFIG_SCHEMA.defaultValue,
        [flag]: true,
      };

      expect(
        validateGuardrailConfig({
          account_id: 'default',
          config_json:
            configJsonShape === 'stringified' ? JSON.stringify(configJson) : configJson,
          allow_google_ads_mutate: false,
          allow_external_writes: false,
          max_bid_change_percent: 20,
          max_budget_change_percent: 20,
          updated_at: '2026-06-27T00:00:00.000Z',
        })
      ).toEqual({
        valid: false,
        errors: [
          {
            field: `config_json.${flag}`,
            code: 'write_path_enabled',
            message,
          },
        ],
      });
    }
  );

  it('declares no write capabilities in the Task 1 contract', () => {
    expect(DATA_CONTRACT_WRITE_CAPABILITIES).toEqual([]);
  });
});

describe('DB import fields', () => {
  it('declares import fields for every tab without write operations', () => {
    expect(Object.keys(DB_IMPORT_FIELDS).sort()).toEqual([...CONTRACT_TAB_NAMES].sort());
    for (const tabName of CONTRACT_TAB_NAMES) {
      expect(DB_IMPORT_FIELDS[tabName]).toEqual(
        expect.arrayContaining(['import_run_id', 'source_tab', 'source_row_number', 'imported_at'])
      );
    }
  });
});
