# TM1 Data Contract

Version: `tm1.0.0`

This contract defines the read-only Sheet/feed and import schema foundation for Taskmaster Task 1. It does not enable UI workflows, Google Ads OAuth, Google Ads mutate operations, Supabase write policies, or external writes. The default account action mode is `review_only`.

## Canonical Source

The executable contract lives in:

- `src/lib/dataContract/contract.ts`
- `src/lib/dataContract/samples.ts`

Existing Google Sheet imports read their tab names and required headers from the canonical contract through:

- `src/lib/googleSheets.ts`
- `src/lib/csv/validator.ts`

## Stable Tabs

| Tab | Purpose |
| --- | --- |
| `google_campaigns` | Campaign metrics imported from Google Ads. |
| `google_adgroups` | Ad group metrics imported from Google Ads. |
| `google_keywords` | Keyword metrics imported from Google Ads. |
| `google_search_terms` | Search term metrics imported from Google Ads. |
| `google_hour_device` | Hour and device segmented performance. |
| `google_ads_policy` | Ad approval and review status feed. |
| `google_auction_proxy_campaigns` | Campaign-level auction proxy metrics. |
| `google_auction_proxy_keywords` | Keyword-level auction proxy metrics. |
| `voluum_performance` | Optional Voluum performance feed. |
| `google_sync_log` | Optional script run log. |
| `google_pmax_performance` | PMax asset and asset-group performance. |
| `google_geo_performance` | Geo/country/region/city performance and profit signals. |
| `google_placement_performance` | Placement performance and review signals. |
| `google_budget_pacing` | Budget pacing metrics and review-only recommendations. |
| `google_conversion_actions` | Conversion action inventory and settings snapshot. |
| `voluum_true_profit` | Visit-date true-profit attribution from Voluum. |
| `audit_log` | Read-only audit event feed, including whether a write was executed. |
| `account_config` | Account-level defaults and decision thresholds. |
| `guardrail_config` | Guardrail JSON and write-disable switches. |

## Field Rules

Field descriptors are declared per tab in `TAB_CONTRACTS`. Supported scalar types are:

- `string`
- `number`
- `integer`
- `date` as `YYYY-MM-DD`
- `datetime` as an ISO-compatible timestamp
- `boolean`
- `json`
- `enum`

The validators enforce:

- unknown tab names fail
- missing headers fail
- extra headers fail for canonical validation
- required blank values fail
- numbers accept numeric strings, commas, and percent signs
- enums must match their declared allowed values
- JSON fields accept JSON strings or objects

## DB Import Fields

Every tab maps to DB import fields through `DB_IMPORT_FIELDS`. Each DB import shape includes these metadata fields:

- `import_run_id`
- `source_tab`
- `source_row_number`
- `imported_at`

The metadata fields are prepended to the tab's canonical fields. This creates a stable import surface for future migrations without enabling writes in Task 1.

## Config

`account_config` is constrained to read-only operating modes:

- `review_only`
- `disabled`

`DEFAULT_ACCOUNT_CONFIG.action_mode` is `review_only`.

`guardrail_config` must keep these switches false:

- `allow_google_ads_mutate`
- `allow_external_writes`

`validateGuardrailConfig` rejects any JSON that enables either path.

## Samples

`SAMPLE_ROWS` contains one sample row for every tab. `sampleRowToCSV` serializes a sample row in canonical header order so tests can round-trip through the CSV parser and typed validators.

## Read-Only Evidence

Task 1 exposes `DATA_CONTRACT_WRITE_CAPABILITIES = []`. The dry-run SQL in `supabase/migrations/20260628000100_data_contract_foundation_dry_run.sql` creates no durable objects because it ends with `ROLLBACK`, and it declares no insert, update, delete, or mutate policies.
