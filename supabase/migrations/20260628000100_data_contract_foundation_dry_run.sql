-- Taskmaster Task 1 data contract dry-run.
-- This file documents the intended read-only import schema surface.
-- It intentionally rolls back and grants no INSERT/UPDATE/DELETE policies.

BEGIN;

CREATE SCHEMA IF NOT EXISTS tm1_data_contract;

CREATE TABLE IF NOT EXISTS tm1_data_contract.import_runs (
  import_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  contract_version text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('SUCCESS', 'PARTIAL', 'FAILED')),
  error_message text
);

CREATE TABLE IF NOT EXISTS tm1_data_contract.sheet_feed_rows (
  import_run_id uuid NOT NULL,
  source_tab text NOT NULL,
  source_row_number integer NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  row_payload jsonb NOT NULL,
  PRIMARY KEY (import_run_id, source_tab, source_row_number)
);

CREATE TABLE IF NOT EXISTS tm1_data_contract.sync_log (
  import_run_id uuid NOT NULL,
  run_id text NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('SUCCESS', 'PARTIAL', 'FAILED')),
  duration_seconds numeric,
  trigger_type text,
  lookback_days integer,
  tabs_updated integer,
  error_message text
);

CREATE TABLE IF NOT EXISTS tm1_data_contract.audit_log (
  audit_id text PRIMARY KEY,
  created_at timestamptz NOT NULL,
  actor text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  before_json jsonb,
  after_json jsonb,
  reason text NOT NULL,
  write_executed boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS tm1_data_contract.account_config (
  account_id text PRIMARY KEY,
  timezone text NOT NULL,
  currency text NOT NULL,
  action_mode text NOT NULL CHECK (action_mode IN ('review_only', 'disabled')),
  target_cpa numeric NOT NULL,
  min_clicks integer NOT NULL,
  min_cost_to_decide numeric NOT NULL,
  max_daily_loss numeric NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS tm1_data_contract.guardrail_config (
  account_id text PRIMARY KEY,
  config_json jsonb NOT NULL,
  allow_google_ads_mutate boolean NOT NULL DEFAULT false CHECK (allow_google_ads_mutate = false),
  allow_external_writes boolean NOT NULL DEFAULT false CHECK (allow_external_writes = false),
  max_bid_change_percent numeric NOT NULL,
  max_budget_change_percent numeric NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE VIEW tm1_data_contract.read_only_contract_summary AS
SELECT
  'tm1.0.0'::text AS contract_version,
  false AS google_ads_mutate_enabled,
  false AS external_writes_enabled;

ROLLBACK;
