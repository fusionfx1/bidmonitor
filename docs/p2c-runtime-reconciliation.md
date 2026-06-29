# P2C Runtime Scripts + Calculation Reconciliation

Status: **local implementation ready / no deploy performed**
Date: 2026-06-28

## Scope

- Google Ads Script source: `scripts/google-ads/p2c-data-puller.gs.js`
- Google Apps Script Web App source: `scripts/google-apps/p2c-sheet-bridge.gs.js`
- Shared runtime contract: `src/lib/p2cRuntimeContract.ts`
- Canonical dashboard formulas: `src/lib/metrics/reconciliation.ts`
- Sample fixture: `src/lib/__tests__/fixtures/p2c-reconciliation-sample.json`

## Runtime Sheet Contract

Stable tabs:

| Tab | Purpose |
| --- | --- |
| `config` | Operator config for timezone, date range, `MAX_ROWS`, `LIMIT`, and source sheet id. |
| `sync_log` | Append-only script run log with `script_version`, row counts, status, and errors. |
| `raw_campaign_daily` | Campaign/day facts with `cost_micros` and normalized `cost`. |
| `raw_keyword_daily` | Keyword/day facts with stable campaign/ad group/criterion identifiers. |
| `raw_search_term_daily` | Search term/day facts for diagnostics. |
| `raw_hour_device` | Hour/device facts for time and device diagnostics. |
| `raw_policy` | Ad policy and approval snapshot. |

## Apps Script Endpoints

The bridge accepts `?endpoint=<name>&token=<token>` and returns JSON:

- `health`
- `accounts`
- `sync_log`
- `raw_campaign_daily`
- `raw_keyword_daily`
- `raw_search_term_daily`
- `raw_hour_device`
- `raw_policy`
- `analysis_reconciliation`

Access control uses Apps Script `PropertiesService` key `BIDMONITOR_BRIDGE_TOKEN`. The token must not be committed, logged, or rendered in the frontend.

## Calculation Lock

Canonical formulas:

| Metric | Formula |
| --- | --- |
| `cost` | `cost_micros / 1_000_000` |
| `ctr` | `clicks / impressions` |
| `cvr` | `conversions / clicks` |
| `cpa` | `cost / conversions` |
| `roas` | `revenue_or_value / cost` |
| `profit` | `voluum_revenue - google_ads_cost` |
| `roi` | `profit / google_ads_cost` |

Ratios are calculated from summed totals, not averaged from row-level ratios.

## Timezone / Date Range

- Default script timezone: `Asia/Bangkok`.
- `START_DATE` and `END_DATE` in `config` override `LOOKBACK_DAYS`.
- When explicit dates are blank, `LOOKBACK_DAYS` is inclusive of today in `SCRIPT_TIMEZONE`.
- Voluum revenue remains separate from Google Ads `conversion_value`; the dashboard uses fresh Voluum rows for revenue/profit and falls back to Google conversion value only when Voluum is absent or fail-closed.

## Reconciliation Table

Sample fixture expected output:

| Metric | Sheet | Dashboard | Expected |
| --- | ---: | ---: | --- |
| Cost | `150` | `150` | `cost_micros / 1_000_000` |
| Clicks | `150` | `150` | `sum(clicks)` |
| Impressions | `1500` | `1500` | `sum(impressions)` |
| Conversions | `5` | `5` | Fresh Voluum conversions override Google conversions. |
| CPA | `30` | `30` | `150 / 5` |
| CTR | `0.1` | `0.1` | `150 / 1500` |
| CVR | `0.033333` | `0.033333` | `5 / 150` |
| ROAS | `2.666667` | `2.666667` | `400 / 150` |

## Safety

- Default app mode remains `review_only`.
- Scripts do not contain remote campaign apply logic.
- Google Ads Script reads Google Ads and writes Sheet tabs only.
- Apps Script exposes sanitized Sheet JSON only.
- No Supabase secret, Google Ads credential, bridge token, or feed token is stored in repo.
