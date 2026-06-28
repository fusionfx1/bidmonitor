-- P2A.2 multi-account scope for auto-bidding feed/log rows.
-- Local-only until reviewed and pushed later. No Edge Functions, scripts, or live mutation.

ALTER TABLE bid_action_feed
  ADD COLUMN account_id text,
  ADD COLUMN customer_id text,
  ADD COLUMN source_sheet_id text;

ALTER TABLE bid_action_log
  ADD COLUMN account_id text,
  ADD COLUMN customer_id text,
  ADD COLUMN source_sheet_id text;

ALTER TABLE bid_action_feed
  ADD CONSTRAINT bid_action_feed_account_scope_check
  CHECK (
    account_id IS NOT NULL AND btrim(account_id) <> ''
    AND customer_id IS NOT NULL AND btrim(customer_id) <> ''
    AND source_sheet_id IS NOT NULL AND btrim(source_sheet_id) <> ''
  ) NOT VALID;

ALTER TABLE bid_action_log
  ADD CONSTRAINT bid_action_log_account_scope_check
  CHECK (
    account_id IS NOT NULL AND btrim(account_id) <> ''
    AND customer_id IS NOT NULL AND btrim(customer_id) <> ''
    AND source_sheet_id IS NOT NULL AND btrim(source_sheet_id) <> ''
  ) NOT VALID;

ALTER TABLE bid_action_feed
  ADD CONSTRAINT bid_action_feed_customer_id_format_check
  CHECK (customer_id ~ '^[0-9-]+$') NOT VALID;

ALTER TABLE bid_action_log
  ADD CONSTRAINT bid_action_log_customer_id_format_check
  CHECK (customer_id ~ '^[0-9-]+$') NOT VALID;

DROP POLICY IF EXISTS "insert_bid_action_feed" ON bid_action_feed;

CREATE POLICY "insert_bid_action_feed" ON bid_action_feed
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    mode = 'dry_run'
    AND status = 'ready'
    AND entity_level = 'campaign'
    AND action IN ('SET_BUDGET', 'PAUSE_CAMPAIGN', 'ENABLE_CAMPAIGN', 'SET_CAMPAIGN_LABEL')
    AND picked_at IS NULL
    AND applied_at IS NULL
    AND account_id IS NOT NULL
    AND btrim(account_id) <> ''
    AND customer_id IS NOT NULL
    AND btrim(customer_id) <> ''
    AND source_sheet_id IS NOT NULL
    AND btrim(source_sheet_id) <> ''
  );

CREATE INDEX idx_bid_action_feed_account_status
  ON bid_action_feed (account_id, customer_id, status, mode, created_at);

CREATE INDEX idx_bid_action_log_account_created
  ON bid_action_log (account_id, customer_id, created_at);
