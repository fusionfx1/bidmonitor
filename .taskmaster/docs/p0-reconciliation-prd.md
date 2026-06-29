# BitMonitor P0 Reconciliation & Runtime Scripts PRD

Date: 2026-06-28
Scope: NEW tasks only. Do NOT touch existing tasks 1-10.
Priority: All tasks in this document are P0.

## Context

BitMonitor is a Google Ads monitoring and optimization dashboard.
Existing tasks 1-10 cover data contracts, UI pages, remote campaign updates, and safety review.
This document defines the MISSING P0 foundation layers that existing tasks depend on but do not implement:

1. Runtime Scripts (Google Ads Script + Apps Script bridge)
2. Calculation Reconciliation (metric formulas, timezone, cost micros)
3. LeadingCards Spend Reconciliation (affiliate card spend vs Google Ads spend)
4. Network Postback Reconciliation (affiliate network postbacks vs Voluum/clicks)
5. Voluum Live Attribution Reconciliation (Voluum vs final revenue)

## Required Task Fields

Every task must include:
- title
- priority (P0)
- description
- dependencies (reference by task ID)
- assigned role: architect / developer / qa / reviewer
- scope (files/modules allowed)
- out of scope
- acceptance criteria (numbered, testable)
- verification plan (commands/checks)
- safety notes (secrets, mutations, fail-closed)

---

## GROUP A: Runtime Scripts

### A1 — Google Ads Script Data Exporter

**Role**: developer
**Dependencies**: Task 1 (Data Contract)
**Priority**: P0

Google Ads Script (.gs) that runs inside Google Ads and exports campaign, ad group, keyword, search term, hour-device, policy, PMax channel, PMax terms, geo, placement, budget, and conversion action data to the Google Sheet tabs defined in Task 1.

Scope: `scripts/google-ads/exporter.gs` (new file). No other files.

Out of scope: Apps Script bridge, dashboard code, any Google OAuth in the web app, any mutation of campaigns.

Acceptance criteria:
1. Script exports all raw_* tabs defined in Task 1 schema with correct headers on every run.
2. Script writes a sync_log row per run: timestamp, status (success/warning/failed), row counts per tab, script version string, duration_ms, error message (null on success).
3. Script reads a `config` tab for account_timezone, freshness_minutes, mode.
4. Script only reads data; it does not write bids, budgets, or campaign settings.
5. Script has LIMIT and MAX_ROWS guards on every query.
6. Script can be run in preview/dry-run mode via a config flag that logs expected output without writing.
7. Script version string is semver and embedded as a constant.

Verification plan:
- Run script in Google Ads Script preview mode; verify no mutation warnings appear.
- Inspect Sheet tabs; verify header names match contract exactly.
- Inspect sync_log row; verify all required fields present.
- Static scan: no GoogleAdsApp.mutate* or equivalent calls in script source.

Safety notes:
- Script must not store credentials. It runs inside Google Ads and has ambient account access.
- Script must not print secrets to the log.
- Script must not call external APIs other than the configured Sheet URL (UrlFetchApp to the same Sheet is acceptable).

---

### A2 — Google Apps Script Web App / Backend Bridge

**Role**: developer
**Dependencies**: A1 (Task 11)
**Priority**: P0

Google Apps Script Web App (`doGet` handler) deployed from the Google Sheet that exposes Sheet data as JSON for the BitMonitor backend. The bridge is the only path the dashboard backend uses to read Sheet data.

Scope: `scripts/apps-script/bridge.gs` (new file). No other files.

Out of scope: Direct Google Ads API calls, OAuth from the web app, any write path back to Google Ads.

Acceptance criteria:
1. `doGet` returns JSON for any valid tab name passed as a query parameter (e.g. `?tab=raw_campaign_daily`).
2. Response includes a `freshness` field: last sync timestamp and row count from sync_log.
3. Response includes a `version` field from the script version constant.
4. Endpoint requires a shared secret token (passed as a query param, validated server-side). Requests without a valid token return HTTP 401.
5. Endpoint is read-only; it never writes to the Sheet or Google Ads.
6. Endpoint returns an error object (not an exception stack) for unknown tab names.
7. Endpoint handles empty tabs gracefully (returns empty array, not error).

Verification plan:
- Deploy to test environment; call with valid token; verify JSON shape.
- Call with invalid token; verify 401 response.
- Call with unknown tab; verify error object returned.
- Static scan: no write calls (`SpreadsheetApp.getRange().setValue()`) in response handlers.

Safety notes:
- Token must be stored in Script Properties, never hardcoded in source or logged.
- Token must never appear in response bodies or logs.
- Token rotation must be possible without redeploying the script (read from Script Properties at runtime).

---

### A3 — sync_log / Version / Health Contract Implementation

**Role**: developer
**Dependencies**: A1 (Task 11), Task 1 (Data Contract)
**Priority**: P0

Implement the server-side ingest of the sync_log tab into the database (Supabase) and expose a freshness/health API endpoint that the dashboard consumes. Freshness calculation must use the `freshness_minutes` config value.

Scope: `src/lib/sync-health.ts`, `src/api/sync-health/route.ts` (new files). Schema migration for `sync_log` table.

Out of scope: Dashboard UI, Google Ads mutation, any new data source.

Acceptance criteria:
1. Database has a `sync_log` table with columns: id, account_id, run_at, status (success/warning/failed), tab_name, row_count, script_version, duration_ms, error_message, created_at.
2. An ingest job or trigger reads new rows from the Sheet sync_log tab and inserts them into the DB table on each sync cycle.
3. A `GET /api/sync-health?account_id=X` endpoint returns: last_run_at, status, row_counts_by_tab, script_version, is_stale (boolean), stale_reason (string or null).
4. `is_stale` is true when `now() - last_run_at > freshness_minutes * 60 seconds`.
5. Endpoint returns stale=true and status=unknown when no sync_log rows exist for the account.
6. Unit tests cover fresh, stale, and missing-data cases.

Verification plan:
- `npm test -- sync-health` passes.
- Seed a sync_log row with timestamp 2 hours ago and freshness_minutes=90; verify is_stale=true.
- Seed a sync_log row with timestamp 30 minutes ago and freshness_minutes=90; verify is_stale=false.
- Call endpoint with unknown account_id; verify stale=true, status=unknown.

Safety notes:
- DB credentials must come from environment variables, never hardcoded.
- Endpoint must not expose the bridge token or any secret from the account config.

---

### A4 — Script Version Detection in Settings

**Role**: developer
**Dependencies**: A3 (Task 13), Task 2 (Settings & Script Health)
**Priority**: P0

Connect the Settings page script health panel to the sync_log API so it shows current script version, last run time, status, and an outdated-script warning when the script version in sync_log does not match the latest known version.

Scope: Settings page component(s) related to script version/health. Read-only UI changes only.

Out of scope: Writing to Google Ads, changing sync schedules, new data sources.

Acceptance criteria:
1. Settings page shows per-account: script_version (from last sync_log row), last_run_at, status badge (success/warning/failed/stale/unknown).
2. If script_version is older than the latest known version constant, an "Outdated Script" warning badge is shown with a "Copy Updated Script" button.
3. All values come from the `/api/sync-health` endpoint, not hardcoded.
4. Component renders correctly when no sync_log data exists (shows "Not yet synced" state).
5. No Google OAuth or direct Google Ads API call is added to the frontend.

Verification plan:
- Render Settings with mocked sync-health response; verify all fields display.
- Render with outdated script_version; verify warning badge appears.
- Render with no data; verify "Not yet synced" state renders without error.
- Static scan: no new Google OAuth import in the frontend bundle.

Safety notes:
- Script update copy is read-only; it does not push code to Google Ads.

---

## GROUP B: Calculation Reconciliation

### B1 — Canonical Metric Formulas, Timezone Normalization, Cost Micros

**Role**: architect + developer
**Dependencies**: Task 1 (Data Contract)
**Priority**: P0

Define and implement a shared calculation library that all dashboard components must use for derived metrics. Prevents metric disagreement between dashboard cards, tables, and reports.

Scope: `src/lib/metrics.ts` (new file). All derived metric calculations must be defined here.

Out of scope: UI components, database schema changes, Google Ads API.

Formulas to implement:
- CTR = clicks / impressions (guard: 0 if impressions = 0)
- CVR = conversions / clicks (guard: 0 if clicks = 0)
- CPA = cost / conversions (guard: null if conversions = 0, do not return Infinity)
- ROAS = revenue / cost (guard: null if cost = 0)
- Profit = revenue - cost
- ROI = (revenue - cost) / cost (guard: null if cost = 0)
- cost_from_micros(micros) = micros / 1_000_000 (always)
- normalize_date(date, source_tz, target_tz) = correct date-only value in target timezone
- is_stale(last_run_at, freshness_minutes) = boolean

Acceptance criteria:
1. All formulas in `src/lib/metrics.ts` match the definitions above exactly.
2. Every formula has a guard for division by zero and returns the documented sentinel (0, null, or false).
3. cost_from_micros correctly converts Google Ads micros (1 unit = 0.000001 currency unit).
4. normalize_date handles Bangkok (UTC+7) and LA (UTC-8) correctly across DST boundaries.
5. All functions are pure (no side effects, no API calls).
6. Unit tests cover: normal case, zero divisor, null/undefined inputs, micros conversion edge cases, timezone edge cases (midnight rollover, DST).
7. No dashboard component may compute CTR/CVR/CPA/ROAS/Profit/ROI inline; all must import from this module.

Verification plan:
- `npm test -- metrics` passes all cases.
- Code search: grep for inline `/ clicks`, `/ impressions`, `/ cost`, `/ 1000000` outside `metrics.ts`; expect zero matches.
- Verify timezone test: input "2024-03-10T08:00:00Z" normalized to Asia/Bangkok returns "2024-03-10", normalized to America/Los_Angeles returns "2024-03-10".

Safety notes:
- Pure calculation library; no secrets, no network calls, no mutations.

---

### B2 — Dashboard vs Source Reconciliation Tests (Fixture-Based)

**Role**: qa
**Dependencies**: B1 (Task 15)
**Priority**: P0

Create a fixture-based test suite that verifies dashboard-computed metrics match independently-calculated expected values from the same raw data. Prevents silent metric drift.

Scope: `src/lib/__tests__/reconciliation.test.ts`, `src/lib/__fixtures__/` (new files).

Out of scope: UI components, live data calls, database changes.

Acceptance criteria:
1. At least 3 fixture datasets covering: high-spend/high-conversion, zero-conversion, and mixed-timezone campaigns.
2. For each fixture: verify CTR, CVR, CPA, ROAS, Profit, ROI, cost_from_micros, is_stale match expected values computed by hand or from a trusted reference.
3. Tests fail explicitly if any formula returns Infinity, NaN, or undefined for valid numeric inputs.
4. Tests cover micros conversion: input 2_500_000 micros → output 2.5 currency units.
5. Tests cover timezone normalization: Bangkok midnight vs LA midnight edge cases.
6. All tests pass in CI (`npm test`).

Verification plan:
- `npm test -- reconciliation` passes.
- Introduce a deliberate bug in CTR formula; verify at least one test fails.
- Introduce wrong micros divisor (1000 instead of 1_000_000); verify test fails.

Safety notes:
- Test fixtures must not contain real account IDs, real spend amounts, or real conversion data.
- Use synthetic data only.

---

## GROUP C: LeadingCards Spend Reconciliation

### C1 — Read-Only LeadingCards Transaction Ingest + Card/Account Mapping

**Role**: developer
**Dependencies**: Task 1 (Data Contract)
**Priority**: P0

Ingest transaction data from the LeadingCards API or export in read-only mode. Map each card to a Google Ads account. Store raw transaction rows in the database for reconciliation.

Scope: `src/lib/leadingcards/ingest.ts`, `src/lib/leadingcards/mapping.ts`, DB migration for `lc_transactions` and `lc_card_mapping` tables.

Out of scope: Any write back to LeadingCards, remote campaign updates triggered by LeadingCards data, UI.

Acceptance criteria:
1. `lc_transactions` table stores: id, card_id, transaction_date, amount_usd, description, status, created_at. Read-only insert (no update, no delete from application code).
2. `lc_card_mapping` table stores: card_id, account_id, account_name, currency, is_active. Managed via Settings UI only (no auto-creation of mappings).
3. Ingest job fetches transactions for configured date range and inserts new rows (idempotent: skip if transaction_id already exists).
4. Ingest job logs result to sync_log: tab_name=lc_transactions, row_count, status, error.
5. API credentials (LeadingCards API key) stored in environment variables, never in DB or frontend.
6. LeadingCards API key rotation is supported by reading credentials from runtime environment on each ingest run; rotation must not require code changes or redeploying frontend assets.
7. Ingest can be run manually (CLI or API call) and on a schedule.

Verification plan:
- Run ingest with mock API response; verify rows inserted into lc_transactions.
- Run ingest twice with same data; verify no duplicate rows.
- Verify sync_log row written after ingest.
- Static scan: LeadingCards API key not present in any source file or committed config.

Safety notes:
- LeadingCards API key must never be logged, printed, or exposed in responses.
- LeadingCards API key rotation must be documented in the runbook before enabling scheduled ingest.
- Ingest is read-only with respect to LeadingCards; no payment or card mutation calls.

---

### C2 — Spend Reconciliation Table + Dashboard Delta Cards

**Role**: developer
**Dependencies**: C1 (Task 17)
**Priority**: P0

Compute daily and period spend reconciliation between LeadingCards transactions and Google Ads reported cost. Expose a reconciliation summary API and a dashboard card showing delta/status.

Scope: `src/lib/leadingcards/reconcile.ts`, `src/api/leadingcards-reconciliation/route.ts`, reconciliation dashboard card component.

Out of scope: Remote campaign mutations triggered by reconciliation, LeadingCards write API.

Acceptance criteria:
1. Reconciliation computes per-account per-day: lc_spend (sum of LeadingCards transactions), gads_spend (from raw_campaign_daily), delta (lc_spend - gads_spend), delta_pct, status (ok / warning / critical).
2. Status thresholds are data-driven from config (e.g. warning at >5% delta, critical at >15% delta).
3. Dashboard card shows: lc_spend, gads_spend, delta, delta_pct, status badge, last reconciled timestamp.
4. Card shows "Not reconciled" state when either data source is stale or missing.
5. Reconciliation does NOT block or delay the normal dashboard; it is additive.
6. Unit tests cover: matched spend, over-spend (lc > gads), under-spend (lc < gads), missing data.

Verification plan:
- `npm test -- leadingcards-reconcile` passes.
- Seed lc_transactions=100 USD and gads_spend=95 USD; verify delta=5 and status=warning (with 5% threshold).
- Seed with missing lc data; verify "Not reconciled" state shown.

Safety notes:
- Reconciliation is read-only reporting; it must not trigger any campaign mutation or payment action.
- Discrepancies are informational only; human review is required before any action.

---

### C3 — Fail-Closed Guardrails for LeadingCards Data in Remote Updates

**Role**: developer + reviewer
**Dependencies**: C2 (Task 18), Task 7 (Remote Campaign Updates)
**Priority**: P0

Extend the remote campaign update guardrail engine to fail closed when LeadingCards spend reconciliation shows a critical delta or stale data.

Scope: `src/lib/guardrails/leadingcards-guard.ts`, update to guardrail engine in Task 7.

Out of scope: LeadingCards API write calls, new campaign update types.

Acceptance criteria:
1. Guardrail check: if lc_reconciliation status is `critical` for the account, all campaign updates are blocked (skipped with reason=`skipped_lc_reconciliation_critical`).
2. Guardrail check: if LeadingCards data is stale (older than freshness_minutes threshold), campaign updates are blocked with reason=`skipped_lc_data_stale`.
3. Guardrail is checked server-side only; frontend cannot bypass it.
4. Guardrail result is recorded in the audit_log for every blocked action.
5. Unit tests: block on critical delta, block on stale data, pass on ok status.
6. Default behavior when LeadingCards is not configured: guardrail passes (not fail-closed for unconfigured integrations).

Verification plan:
- `npm test -- lc-guardrail` passes.
- Seed critical reconciliation state; attempt campaign update; verify skipped_lc_reconciliation_critical in audit log.
- Seed stale lc data; verify skipped_lc_data_stale.
- Disable LeadingCards integration in config; verify guardrail passes (not blocking).

Safety notes:
- Guardrail must be server-side; client-side bypass must not be possible.
- Any guardrail failure must be immutably recorded in audit_log.

---

## GROUP D: Network Postback Reconciliation

### D1 — Postback Receiver Endpoint + Raw Postback Table

**Role**: developer
**Dependencies**: Task 1 (Data Contract)
**Priority**: P0

Implement a secure HTTP endpoint that receives affiliate network postback (conversion) notifications and stores them in a raw postback table. The endpoint is receive-only; it does not trigger any Google Ads mutation.

Scope: `src/api/postback/v/route.ts`, DB migration for `raw_postbacks` table.

Out of scope: Normalization, deduplication, reconciliation, any Google Ads mutation triggered by postbacks.

Current implemented endpoint:
`GET /api/postback/v?click_id={click_id}&payout={price}&lead_id={lead_id}&type={type}`

Required v1 contract:
- accept GET query-string postback
- required query fields: `click_id`, `payout`, `lead_id`, `type`
- server-derived fields: `received_at`, `source_endpoint`
- optional or expanded payload fields must not be required by v1
- POST support and expanded payload support are future only unless explicitly assigned

For the current v1 route, `raw_payload` stores the accepted query parameters plus sanitized request headers for debugging. Future fields may be captured later, but they must not be required for v1 ingestion.

Acceptance criteria:
1. `GET /api/postback/v` accepts network postbacks as query-string requests.
2. Endpoint validates a shared postback secret token from `token` query param or `Authorization: Bearer` header.
3. Every valid request is stored in `raw_postbacks` with required v1 query fields (`click_id`, `payout`, `lead_id`, `type`), server-derived metadata (`received_at`, `source_endpoint`), and `raw_payload` limited to accepted query parameters plus sanitized request headers.
4. Endpoint returns HTTP 200 immediately; processing is async (do not block the postback sender).
5. Endpoint returns HTTP 401 for missing/invalid token; returns HTTP 400 for missing required fields.
6. Endpoint does NOT trigger any campaign update, bid change, or budget mutation.
7. Duplicate postbacks are stored but flagged as duplicate=true using primary key `(source_endpoint, lead_id, type)` and fallback key `(source_endpoint, click_id, type, payout, date_bucket)`.

Verification plan:
- Send valid GET postback; verify row inserted into raw_postbacks.
- Send without token; verify 401 returned and no row inserted.
- Send duplicate; verify duplicate=true flag set.
- Static scan: no GoogleAdsApp or campaign mutation call in postback handler.

Safety notes:
- Postback token must be stored in environment variables and never logged or returned in responses.
- raw_payload may contain PII (email, phone); access must be restricted to audit/debugging roles.

---

### D2 — Normalized Conversion Table + Idempotent Dedupe

**Role**: developer
**Dependencies**: D1 (Task 20)
**Priority**: P0

Process raw postbacks into a normalized `conversions` table with consistent field names and deduplication by (source, lead_id, type).

Scope: `src/lib/postback/normalize.ts`, `src/lib/postback/dedupe.ts`, DB migration for `conversions` table.

Out of scope: Revenue reconciliation, Voluum matching, UI.

Acceptance criteria:
1. Normalization maps source-specific field names to canonical fields: lead_id, click_id, type, revenue_usd, payout_usd, event_date (date-only in UTC), event_time (UTC timestamp), source.
2. Deduplication key: (source, lead_id, type). First occurrence is canonical; subsequent duplicates are marked is_duplicate=true and not inserted into the canonical conversions table.
3. Normalization is idempotent: reprocessing the same raw_postbacks produces the same conversions rows.
4. revenue_usd and payout_usd are stored as numeric (not string); currency conversion uses a fixed config rate if source currency is not USD.
5. Unit tests: normal conversion, duplicate suppression, missing click_id, non-USD currency conversion.

Verification plan:
- `npm test -- postback-normalize` passes.
- Insert 3 raw postbacks (2 duplicates of same lead_id+type); verify only 1 canonical conversion row, 2 duplicate flags.
- Verify reprocessing produces same output (idempotency test).

Safety notes:
- lead_id and click_id values must not be logged in plain text in production logs.

---

### D3 — click_id Matching + Payout / Revenue Reconciliation

**Role**: developer
**Dependencies**: D2 (Task 21)
**Priority**: P0

Match normalized conversions to Voluum click logs using click_id / subid. Compute payout reconciliation between the postback-reported payout and Voluum-reported revenue.

Scope: `src/lib/postback/click-match.ts`, `src/lib/postback/payout-reconcile.ts`.

Out of scope: Voluum API ingest (handled in Group E), UI, Google Ads mutation.

Acceptance criteria:
1. click_id match: join conversions.click_id to Voluum click log click_id. Record match status: matched / unmatched / ambiguous (multiple clicks for same click_id).
2. Matched conversions get: voluum_revenue_usd (from Voluum click log), postback_payout_usd (from conversion), payout_delta_usd, payout_delta_pct.
3. Unmatched conversions are kept with match_status=unmatched; they do not cause errors.
4. Reconciliation result stored in `conversion_reconciliation` table.
5. Unit tests: matched, unmatched, ambiguous click_id.

Verification plan:
- `npm test -- click-match` passes.
- Seed conversion with known click_id and matching Voluum row; verify matched with correct delta.
- Seed conversion with no Voluum match; verify unmatched status, no error.

Safety notes:
- click_id matching is read-only; no writes to Voluum or affiliate network.

---

### D4 — Postback Health Dashboard

**Role**: developer
**Dependencies**: D3 (Task 22)
**Priority**: P0

Dashboard page showing postback volume, match rates, payout reconciliation, and alert for anomalies (e.g. drop in postback volume, high unmatched rate, large payout delta).

Scope: `src/app/postback-health/` page component. Read-only.

Out of scope: Any mutation, postback retrigger, affiliate network API write.

Acceptance criteria:
1. Page shows: total postbacks (24h, 7d), matched rate (%), unmatched count, duplicate rate, average payout delta.
2. Alert card when matched rate < 80% (threshold from config).
3. Alert card when postback volume drops >50% vs prior 24h period.
4. Table of recent unmatched conversions with click_id and source for debugging.
5. All data from API; page does not directly query DB.
6. Page shows "No postback data" empty state when no data is available.

Verification plan:
- Render with mock API data; verify all cards show correct values.
- Render with matched_rate=60%; verify alert card shown.
- Render with no data; verify empty state shown without error.

Safety notes:
- Page must not expose raw_payload or PII fields from raw_postbacks.

---

## GROUP E: Voluum Reconciliation

### E1 — Voluum Live Attribution Ingest / Adapter

**Role**: developer
**Dependencies**: Task 1 (Data Contract)
**Priority**: P0

Ingest click and conversion data from Voluum (via API or export) and store in `raw_voluum_clicks` and `raw_voluum_conversions` tables. Read-only ingest; no write-back to Voluum.

Scope: `src/lib/voluum/ingest.ts`, DB migration for `raw_voluum_clicks` and `raw_voluum_conversions`.

Out of scope: click_id matching (Group D), mismatch reporting (E3), UI, Google Ads mutation.

Acceptance criteria:
1. `raw_voluum_clicks` stores: click_id, subid (optional), campaign_id, visit_cost, visit_revenue, timestamp_utc, country, device, os, created_at.
2. `raw_voluum_conversions` stores: conversion_id, click_id, campaign_id, payout, revenue, type, timestamp_utc, status, created_at.
3. Ingest job is idempotent: re-running for the same date range does not create duplicate rows.
4. Ingest writes to sync_log: tab_name=voluum_clicks, tab_name=voluum_conversions, row_count, status.
5. Voluum API key and credentials stored in environment variables only; never in DB, frontend, or logs.
6. Ingest can be triggered manually and on a schedule.

Verification plan:
- Run ingest with mock Voluum API response; verify rows in raw_voluum_clicks and raw_voluum_conversions.
- Re-run ingest; verify no duplicate rows.
- Verify sync_log entries written.
- Static scan: VOLUUM_API_KEY not present in source files or committed configs.

Safety notes:
- Voluum API key must never be logged, committed, or included in error responses.
- Ingest is strictly read-only with respect to Voluum.

---

### E2 — click_id / subid Matching + Live vs Final Revenue Comparison

**Role**: developer
**Dependencies**: E1 (Task 24), D3 (Task 22)
**Priority**: P0

Match Voluum click records to postback conversion records using click_id. Compare Voluum live (attributed) revenue with final postback-reported revenue and payout.

Scope: `src/lib/voluum/click-match.ts`, `src/lib/voluum/revenue-compare.ts`.

Out of scope: UI, Google Ads mutation, any write to Voluum or affiliate network.

Acceptance criteria:
1. Join raw_voluum_clicks.click_id to conversions.click_id (from Group D).
2. For each matched pair: compute live_revenue_usd (Voluum), final_payout_usd (postback), revenue_delta_usd, revenue_delta_pct.
3. Record in `voluum_reconciliation` table: click_id, match_status (matched/unmatched/multiple), live_revenue_usd, final_payout_usd, revenue_delta_usd, revenue_delta_pct, reconciled_at.
4. Unmatched Voluum clicks are stored with match_status=unmatched (no error).
5. Unit tests: matched, unmatched, multiple Voluum clicks per click_id.

Verification plan:
- `npm test -- voluum-match` passes.
- Seed Voluum click and matching postback; verify revenue delta computed correctly.
- Seed unmatched Voluum click; verify no error, match_status=unmatched.

Safety notes:
- Comparison is read-only; no write to Voluum or affiliate network.

---

### E3 — Mismatch Reporting + Voluum Health Dashboard

**Role**: developer
**Dependencies**: E2 (Task 25)
**Priority**: P0

Dashboard page and API for Voluum reconciliation health: match rates, revenue deltas, unmatched conversions, and alerts for significant mismatches.

Scope: `src/app/voluum-health/` page component, `src/api/voluum-reconciliation/route.ts`.

Out of scope: Google Ads mutation, Voluum API write, automated revenue adjustment.

Acceptance criteria:
1. Page shows: Voluum match rate (%), unmatched Voluum clicks (24h, 7d), total live revenue (Voluum), total final payout (postbacks), overall revenue delta, delta percentage.
2. Alert when match rate < 80% (config threshold).
3. Alert when revenue delta > 10% (config threshold).
4. Table of unmatched conversions with click_id, source, and event_time for debugging.
5. All data from API; page does not directly query DB.
6. Empty state when no Voluum data has been ingested.

Verification plan:
- Render with mock data showing 70% match rate; verify alert shown.
- Render with 15% revenue delta; verify alert shown.
- Render with no data; verify empty state without error.

Safety notes:
- Page must not expose raw Voluum API responses or PII from click logs.
- Mismatch reports are informational; no automated action may be triggered from this page.

---

## Summary: New Task Dependencies

```
Task 1  (existing) → A1(11) → A2(12)
Task 1  (existing) → A1(11) → A3(13) → A4(14) ← Task 2 (existing)
Task 1  (existing) → B1(15) → B2(16)
Task 1  (existing) → C1(17) → C2(18) → C3(19) ← Task 7 (existing)
Task 1  (existing) → D1(20) → D2(21) → D3(22) → D4(23)
Task 1  (existing) → E1(24) → E2(25) ← D3(22)
                                E2(25) → E3(26)
```

All new tasks are P0.
Existing tasks 1-10 are not modified.
