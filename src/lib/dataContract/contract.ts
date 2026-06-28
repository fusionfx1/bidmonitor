import type { DataTableKey } from '../../types';

export const DATA_CONTRACT_VERSION = 'tm1.0.0';

export type ContractFieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'json'
  | 'enum';

export interface ContractField {
  name: string;
  type: ContractFieldType;
  required?: boolean;
  allowedValues?: readonly string[];
}

export interface TabContract {
  tabName: string;
  key: string;
  label: string;
  optional?: boolean;
  currentImportKey?: DataTableKey;
  fields: readonly ContractField[];
}

export interface CurrentImportTab {
  tabName: string;
  key: DataTableKey;
  label: string;
  optional?: boolean;
  requiredColumns: string[];
}

export interface HeaderValidationResult {
  valid: boolean;
  missingColumns: string[];
  extraColumns: string[];
  presentColumns: string[];
}

export type ValidationErrorCode =
  | 'required'
  | 'invalid_type'
  | 'invalid_enum'
  | 'write_path_enabled';

export interface ValidationError {
  field: string;
  code: ValidationErrorCode;
  message: string;
}

export interface RowValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const REQUIRED = true;

const f = (
  name: string,
  type: ContractFieldType,
  required = REQUIRED,
  allowedValues?: readonly string[]
): ContractField => ({ name, type, required, allowedValues });

const reviewStatusValues = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'WATCHLIST'] as const;

export const TAB_CONTRACTS = [
  {
    tabName: 'google_campaigns',
    key: 'campaigns',
    currentImportKey: 'campaigns',
    label: 'Campaigns',
    fields: [
      f('date', 'date'),
      f('campaign_id', 'string'),
      f('campaign_name', 'string'),
      f('campaign_status', 'string'),
      f('serving_status', 'string'),
      f('channel', 'string'),
      f('bidding_strategy_type', 'string'),
      f('campaign_start_date', 'date', false),
      f('campaign_end_date', 'date', false),
      f('daily_budget', 'number'),
      f('impressions', 'integer'),
      f('clicks', 'integer'),
      f('cost', 'number'),
      f('ctr', 'number'),
      f('avg_cpc', 'number'),
      f('conversions', 'number'),
      f('all_conversions', 'number', false),
      f('conversion_value', 'number'),
    ],
  },
  {
    tabName: 'google_adgroups',
    key: 'adGroups',
    currentImportKey: 'adGroups',
    label: 'Ad Groups',
    fields: [
      f('date', 'date'),
      f('campaign_id', 'string'),
      f('campaign_name', 'string'),
      f('bidding_strategy_type', 'string'),
      f('ad_group_id', 'string'),
      f('ad_group_name', 'string'),
      f('ad_group_status', 'string'),
      f('ad_group_cpc_bid', 'number', false),
      f('impressions', 'integer'),
      f('clicks', 'integer'),
      f('cost', 'number'),
      f('ctr', 'number', false),
      f('avg_cpc', 'number', false),
      f('conversions', 'number'),
      f('all_conversions', 'number', false),
      f('conversion_value', 'number', false),
    ],
  },
  {
    tabName: 'google_keywords',
    key: 'keywords',
    currentImportKey: 'keywords',
    label: 'Keywords',
    fields: [
      f('date', 'date'),
      f('device', 'string', false),
      f('keyword_key', 'string'),
      f('campaign_id', 'string'),
      f('campaign_name', 'string'),
      f('bidding_strategy_type', 'string'),
      f('ad_group_id', 'string'),
      f('ad_group_name', 'string'),
      f('criterion_id', 'string'),
      f('keyword', 'string'),
      f('match_type', 'string'),
      f('keyword_status', 'string'),
      f('keyword_cpc_bid', 'number'),
      f('impressions', 'integer'),
      f('clicks', 'integer'),
      f('cost', 'number'),
      f('ctr', 'number', false),
      f('avg_cpc', 'number', false),
      f('conversions', 'number'),
      f('all_conversions', 'number', false),
      f('conversion_value', 'number', false),
    ],
  },
  {
    tabName: 'google_search_terms',
    key: 'searchTerms',
    currentImportKey: 'searchTerms',
    label: 'Search Terms',
    fields: [
      f('date', 'date'),
      f('campaign_id', 'string'),
      f('campaign_name', 'string'),
      f('ad_group_id', 'string'),
      f('ad_group_name', 'string'),
      f('search_term', 'string'),
      f('search_term_status', 'string', false),
      f('impressions', 'integer'),
      f('clicks', 'integer'),
      f('cost', 'number'),
      f('ctr', 'number', false),
      f('avg_cpc', 'number', false),
      f('conversions', 'number'),
      f('all_conversions', 'number', false),
      f('conversion_value', 'number', false),
    ],
  },
  {
    tabName: 'google_hour_device',
    key: 'hourDevice',
    currentImportKey: 'hourDevice',
    label: 'Hour / Device',
    fields: [
      f('date', 'date'),
      f('hour', 'integer'),
      f('device', 'string'),
      f('campaign_id', 'string'),
      f('campaign_name', 'string'),
      f('impressions', 'integer'),
      f('clicks', 'integer'),
      f('cost', 'number'),
      f('ctr', 'number', false),
      f('avg_cpc', 'number', false),
      f('conversions', 'number'),
      f('all_conversions', 'number', false),
      f('conversion_value', 'number', false),
    ],
  },
  {
    tabName: 'google_ads_policy',
    key: 'policy',
    currentImportKey: 'policy',
    label: 'Policy Issues',
    fields: [
      f('campaign_id', 'string'),
      f('campaign_name', 'string'),
      f('ad_group_id', 'string'),
      f('ad_group_name', 'string'),
      f('ad_id', 'string'),
      f('ad_status', 'string'),
      f('approval_status', 'string'),
      f('review_status', 'string'),
      f('final_urls', 'string'),
    ],
  },
  {
    tabName: 'google_auction_proxy_campaigns',
    key: 'auctionCampaigns',
    currentImportKey: 'auctionCampaigns',
    label: 'Auction Signals (Campaign)',
    fields: [
      f('date', 'date'),
      f('campaign_id', 'string'),
      f('campaign_name', 'string'),
      f('campaign_status', 'string', false),
      f('serving_status', 'string', false),
      f('channel', 'string', false),
      f('bidding_strategy_type', 'string'),
      f('impressions', 'integer'),
      f('clicks', 'integer'),
      f('cost', 'number'),
      f('conversions', 'number'),
      f('search_impression_share', 'number'),
      f('search_rank_lost_impression_share', 'number'),
      f('search_budget_lost_impression_share', 'number', false),
      f('top_impression_percentage', 'number', false),
      f('absolute_top_impression_percentage', 'number', false),
      f('search_top_impression_share', 'number', false),
      f('search_absolute_top_impression_share', 'number', false),
      f('bid_signal', 'string', false),
    ],
  },
  {
    tabName: 'google_auction_proxy_keywords',
    key: 'auctionKeywords',
    currentImportKey: 'auctionKeywords',
    label: 'Auction Signals (Keywords)',
    fields: [
      f('date', 'date'),
      f('keyword_key', 'string'),
      f('campaign_id', 'string'),
      f('campaign_name', 'string'),
      f('bidding_strategy_type', 'string'),
      f('ad_group_id', 'string'),
      f('ad_group_name', 'string'),
      f('criterion_id', 'string'),
      f('keyword', 'string'),
      f('match_type', 'string'),
      f('keyword_status', 'string'),
      f('impressions', 'integer'),
      f('clicks', 'integer'),
      f('cost', 'number'),
      f('conversions', 'number'),
      f('search_impression_share', 'number'),
      f('search_rank_lost_impression_share', 'number'),
      f('top_impression_percentage', 'number', false),
      f('absolute_top_impression_percentage', 'number', false),
      f('search_top_impression_share', 'number', false),
      f('search_absolute_top_impression_share', 'number', false),
      f('bid_signal', 'string', false),
    ],
  },
  {
    tabName: 'voluum_performance',
    key: 'voluum',
    currentImportKey: 'voluum',
    label: 'Voluum Performance',
    optional: true,
    fields: [
      f('date', 'date'),
      f('keyword_key', 'string'),
      f('campaign_id', 'string'),
      f('ad_group_id', 'string'),
      f('criterion_id', 'string'),
      f('voluum_visits', 'integer'),
      f('voluum_clicks', 'integer', false),
      f('voluum_conversions', 'integer'),
      f('revenue', 'number'),
      f('profit', 'number'),
      f('roi', 'number', false),
    ],
  },
  {
    tabName: 'google_sync_log',
    key: 'syncLog',
    currentImportKey: 'syncLog',
    label: 'Script Run Log',
    optional: true,
    fields: [
      f('run_id', 'string'),
      f('started_at', 'datetime'),
      f('finished_at', 'datetime', false),
      f('status', 'enum', REQUIRED, ['SUCCESS', 'PARTIAL', 'FAILED']),
      f('duration_seconds', 'number', false),
      f('trigger_type', 'string', false),
      f('lookback_days', 'integer', false),
      f('tabs_updated', 'integer', false),
      f('campaign_rows', 'integer', false),
      f('adgroup_rows', 'integer', false),
      f('keyword_rows', 'integer', false),
      f('search_term_rows', 'integer', false),
      f('hour_device_rows', 'integer', false),
      f('policy_rows', 'integer', false),
      f('auction_campaign_rows', 'integer', false),
      f('auction_keyword_rows', 'integer', false),
      f('voluum_rows', 'integer', false),
      f('error_message', 'string', false),
      f('script_version', 'string', false),
    ],
  },
  {
    tabName: 'google_pmax_performance',
    key: 'pmaxPerformance',
    currentImportKey: 'pmaxPerformance',
    label: 'PMax Performance',
    optional: true,
    fields: [
      f('date', 'date'),
      f('account_id', 'string'),
      f('campaign_id', 'string'),
      f('campaign_name', 'string'),
      f('asset_group_id', 'string'),
      f('asset_group_name', 'string'),
      f('asset_id', 'string'),
      f('asset_type', 'string'),
      f('listing_group_filter', 'string', false),
      f('impressions', 'integer'),
      f('clicks', 'integer'),
      f('cost', 'number'),
      f('conversions', 'number'),
      f('conversion_value', 'number'),
      f('asset_signal', 'string', false),
      f('review_status', 'enum', REQUIRED, reviewStatusValues),
    ],
  },
  {
    tabName: 'google_geo_performance',
    key: 'geoPerformance',
    currentImportKey: 'geoPerformance',
    label: 'Geo Performance',
    optional: true,
    fields: [
      f('date', 'date'),
      f('account_id', 'string'),
      f('campaign_id', 'string'),
      f('campaign_name', 'string'),
      f('country_criterion_id', 'string'),
      f('country_code', 'string'),
      f('region', 'string', false),
      f('city', 'string', false),
      f('impressions', 'integer'),
      f('clicks', 'integer'),
      f('cost', 'number'),
      f('conversions', 'number'),
      f('conversion_value', 'number'),
      f('profit', 'number'),
      f('roi', 'number'),
      f('geo_signal', 'string', false),
      f('review_status', 'enum', REQUIRED, reviewStatusValues),
    ],
  },
  {
    tabName: 'google_placement_performance',
    key: 'placementPerformance',
    currentImportKey: 'placementPerformance',
    label: 'Placement Performance',
    optional: true,
    fields: [
      f('date', 'date'),
      f('account_id', 'string'),
      f('campaign_id', 'string'),
      f('campaign_name', 'string'),
      f('ad_group_id', 'string'),
      f('ad_group_name', 'string'),
      f('placement', 'string'),
      f('placement_type', 'string'),
      f('impressions', 'integer'),
      f('clicks', 'integer'),
      f('cost', 'number'),
      f('conversions', 'number'),
      f('conversion_value', 'number'),
      f('profit', 'number'),
      f('placement_signal', 'string', false),
      f('review_status', 'enum', REQUIRED, reviewStatusValues),
    ],
  },
  {
    tabName: 'google_budget_pacing',
    key: 'budgetPacing',
    label: 'Budget Pacing',
    fields: [
      f('date', 'date'),
      f('account_id', 'string'),
      f('campaign_id', 'string'),
      f('campaign_name', 'string'),
      f('daily_budget', 'number'),
      f('cost_today', 'number'),
      f('budget_spent_percent', 'number'),
      f('budget_lost_impression_share', 'number'),
      f('pacing_status', 'enum', REQUIRED, ['UNDERSPEND', 'ON_TRACK', 'OVERSPEND', 'LIMITED_BY_BUDGET']),
      f('recommended_budget', 'number'),
      f('review_status', 'enum', REQUIRED, reviewStatusValues),
    ],
  },
  {
    tabName: 'google_conversion_actions',
    key: 'conversionActions',
    label: 'Conversion Actions',
    fields: [
      f('account_id', 'string'),
      f('conversion_action_id', 'string'),
      f('conversion_action_name', 'string'),
      f('category', 'string'),
      f('status', 'string'),
      f('primary_for_goal', 'boolean'),
      f('include_in_conversions_metric', 'boolean'),
      f('default_value', 'number'),
      f('attribution_model', 'string'),
      f('counting_type', 'string'),
      f('last_seen_at', 'datetime'),
    ],
  },
  {
    tabName: 'voluum_true_profit',
    key: 'voluumTrueProfit',
    label: 'Voluum True Profit',
    fields: [
      f('visit_date_bkk', 'date'),
      f('postback_date_bkk', 'date', false),
      f('network_date_la', 'date', false),
      f('profit_date_bkk', 'date'),
      f('campaign_id', 'string'),
      f('campaign_name', 'string'),
      f('keyword_key', 'string'),
      f('geo', 'string'),
      f('placement', 'string'),
      f('visits', 'integer'),
      f('conversions', 'integer'),
      f('cost', 'number'),
      f('revenue', 'number'),
      f('true_profit', 'number'),
      f('roi', 'number'),
      f('attribution_source', 'string'),
    ],
  },
  {
    tabName: 'audit_log',
    key: 'auditLog',
    label: 'Audit Log',
    fields: [
      f('audit_id', 'string'),
      f('created_at', 'datetime'),
      f('actor', 'string'),
      f('entity_type', 'string'),
      f('entity_id', 'string'),
      f('action', 'string'),
      f('before_json', 'json', false),
      f('after_json', 'json', false),
      f('reason', 'string'),
      f('write_executed', 'boolean'),
    ],
  },
  {
    tabName: 'account_config',
    key: 'accountConfig',
    label: 'Account Config',
    fields: [
      f('account_id', 'string'),
      f('timezone', 'string'),
      f('currency', 'string'),
      f('action_mode', 'enum', REQUIRED, ['review_only', 'disabled']),
      f('target_cpa', 'number'),
      f('min_clicks', 'integer'),
      f('min_cost_to_decide', 'number'),
      f('max_daily_loss', 'number'),
      f('updated_at', 'datetime'),
    ],
  },
  {
    tabName: 'guardrail_config',
    key: 'guardrailConfig',
    label: 'Guardrail Config',
    fields: [
      f('account_id', 'string'),
      f('config_json', 'json'),
      f('allow_google_ads_mutate', 'boolean'),
      f('allow_external_writes', 'boolean'),
      f('max_bid_change_percent', 'number'),
      f('max_budget_change_percent', 'number'),
      f('updated_at', 'datetime'),
    ],
  },
] as const satisfies readonly TabContract[];

export type ContractTabName = (typeof TAB_CONTRACTS)[number]['tabName'];

export const CONTRACT_TAB_NAMES = TAB_CONTRACTS.map((tab) => tab.tabName) as ContractTabName[];

export const DATA_CONTRACT_WRITE_CAPABILITIES: string[] = [];

export const DB_IMPORT_FIELDS: Record<ContractTabName, string[]> = Object.fromEntries(
  TAB_CONTRACTS.map((tab) => [
    tab.tabName,
    ['import_run_id', 'source_tab', 'source_row_number', 'imported_at', ...tab.fields.map((field) => field.name)],
  ])
) as Record<ContractTabName, string[]>;

export const DEFAULT_ACCOUNT_CONFIG = {
  account_id: 'default',
  timezone: 'Asia/Bangkok',
  currency: 'THB',
  action_mode: 'review_only',
  target_cpa: 25,
  min_clicks: 30,
  min_cost_to_decide: 25,
  max_daily_loss: 100,
  updated_at: '2026-06-27T00:00:00.000Z',
} as const;

export const ACCOUNT_CONFIG_SCHEMA = {
  action_mode: {
    type: 'enum',
    allowedValues: ['review_only', 'disabled'],
  },
} as const;

export const GUARDRAIL_CONFIG_SCHEMA = {
  defaultValue: {
    allow_google_ads_mutate: false,
    allow_external_writes: false,
    max_bid_change_percent: 20,
    max_budget_change_percent: 20,
  },
} as const;

export function getTabContract(tabName: string): TabContract {
  const tab = TAB_CONTRACTS.find((candidate) => candidate.tabName === tabName);
  if (!tab) throw new Error(`Unknown data contract tab: ${tabName}`);
  return tab;
}

export function getCurrentImportTabs(): CurrentImportTab[] {
  return (TAB_CONTRACTS as readonly TabContract[])
    .filter((tab): tab is TabContract & { currentImportKey: DataTableKey } => Boolean(tab.currentImportKey))
    .map((tab) => ({
    tabName: tab.tabName,
    key: tab.currentImportKey as DataTableKey,
    label: tab.label,
    optional: tab.optional,
    requiredColumns: tab.fields.filter((field) => field.required !== false).map((field) => field.name),
  }));
}

export function validateTabHeaders(tabName: string, headers: string[]): HeaderValidationResult {
  const tab = getTabContract(tabName);
  const presentColumns = headers.map(normalizeHeader);
  const expectedColumns = tab.fields.map((field) => field.name);
  const missingColumns = expectedColumns.filter((field) => !presentColumns.includes(field));
  const extraColumns = presentColumns.filter((header) => !expectedColumns.includes(header));

  return {
    valid: missingColumns.length === 0 && extraColumns.length === 0,
    missingColumns,
    extraColumns,
    presentColumns,
  };
}

export function validateTabRow(tabName: string, row: Record<string, unknown>): RowValidationResult {
  const tab = getTabContract(tabName);
  const normalizedRow = normalizeRowKeys(row);
  const errors: ValidationError[] = [];

  for (const field of tab.fields) {
    const value = normalizedRow[field.name];
    const blank = isBlank(value);

    if (field.required !== false && blank) {
      errors.push({
        field: field.name,
        code: 'required',
        message: `${field.name} is required`,
      });
      continue;
    }

    if (blank) continue;

    if (field.type === 'enum' && field.allowedValues && !field.allowedValues.includes(String(value))) {
      errors.push({
        field: field.name,
        code: 'invalid_enum',
        message: `${field.name} must be one of ${field.allowedValues.join(', ')}`,
      });
      continue;
    }

    if (!isValueOfType(value, field)) {
      errors.push({
        field: field.name,
        code: 'invalid_type',
        message: `${field.name} must be ${field.type}`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateAccountConfig(config: Record<string, unknown>): RowValidationResult {
  const mode = String(config.action_mode ?? '');
  const allowed = ACCOUNT_CONFIG_SCHEMA.action_mode.allowedValues;

  if (!allowed.includes(mode as (typeof allowed)[number])) {
    return {
      valid: false,
      errors: [
        {
          field: 'action_mode',
          code: 'invalid_enum',
          message: `action_mode must be one of ${allowed.join(', ')}`,
        },
      ],
    };
  }

  return validateTabRow('account_config', config);
}

export function validateGuardrailConfig(config: Record<string, unknown>): RowValidationResult {
  const errors: ValidationError[] = [];

  if (toBoolean(config.allow_google_ads_mutate)) {
    errors.push(writePathError('allow_google_ads_mutate', 'google_ads_mutate'));
  }

  if (toBoolean(config.allow_external_writes)) {
    errors.push(writePathError('allow_external_writes', 'external_writes'));
  }

  const configJson = parseConfigJson(config.config_json);
  if (configJson && toBoolean(configJson.allow_google_ads_mutate)) {
    errors.push(writePathError('config_json.allow_google_ads_mutate', 'google_ads_mutate'));
  }

  if (configJson && toBoolean(configJson.allow_external_writes)) {
    errors.push(writePathError('config_json.allow_external_writes', 'external_writes'));
  }

  if (errors.length > 0) return { valid: false, errors };

  return validateTabRow('guardrail_config', {
    account_id: 'default',
    config_json: JSON.stringify(config),
    allow_google_ads_mutate: false,
    allow_external_writes: false,
    max_bid_change_percent: config.max_bid_change_percent,
    max_budget_change_percent: config.max_budget_change_percent,
    updated_at: new Date(0).toISOString(),
  });
}

function writePathError(
  field: string,
  writePath: 'google_ads_mutate' | 'external_writes'
): ValidationError {
  return {
    field,
    code: 'write_path_enabled',
    message:
      writePath === 'google_ads_mutate'
        ? 'Google Ads mutate paths must remain disabled for Task 1.'
        : 'External write paths must remain disabled for Task 1.',
  };
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/\s+/g, '_').trim();
}

function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}

function isValueOfType(value: unknown, field: ContractField): boolean {
  switch (field.type) {
    case 'string':
    case 'enum':
      return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    case 'number':
      return toNumber(value) !== null;
    case 'integer': {
      const n = toNumber(value);
      return n !== null && Number.isInteger(n);
    }
    case 'date':
      return isDateString(String(value));
    case 'datetime':
      return !Number.isNaN(Date.parse(String(value)));
    case 'boolean':
      return toBoolean(value) !== null;
    case 'json':
      return isJsonValue(value);
    default:
      return false;
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value).replace(/[%,]/g, '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return null;
}

function parseConfigJson(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (isBlank(value)) return null;

  try {
    const parsed: unknown = JSON.parse(String(value));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function isDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isJsonValue(value: unknown): boolean {
  if (typeof value === 'object' && value !== null) return true;
  try {
    JSON.parse(String(value));
    return true;
  } catch {
    return false;
  }
}
