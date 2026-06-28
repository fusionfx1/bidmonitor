-- Auto-bidding Google Ads Script feed foundations.
-- Phase 1 only: schema for reviewed/dry-run actions and script result logging.
-- No Google Ads API, OAuth, script executor, or live mutation code is created here.

CREATE TABLE bid_action_feed (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_level            text NOT NULL DEFAULT 'campaign',
  keyword_key             text,
  campaign_id             text NOT NULL,
  ad_group_id             text,
  criterion_id            text,
  campaign_name           text,
  ad_group_name           text,
  keyword                 text,
  match_type              text,
  action                  text NOT NULL,
  expected_current_bid    numeric,
  target_bid              numeric,
  expected_current_budget numeric,
  target_budget           numeric,
  budget_is_shared        boolean,
  reason                  text,
  mode                    text NOT NULL DEFAULT 'dry_run',
  status                  text NOT NULL DEFAULT 'ready',
  created_at              timestamptz NOT NULL DEFAULT now(),
  picked_at               timestamptz,
  applied_at              timestamptz,

  CONSTRAINT bid_action_feed_entity_level_check
    CHECK (entity_level IN ('campaign')),
  CONSTRAINT bid_action_feed_action_check
    CHECK (action IN ('SET_BUDGET', 'PAUSE_CAMPAIGN', 'ENABLE_CAMPAIGN', 'SET_CAMPAIGN_LABEL')),
  CONSTRAINT bid_action_feed_mode_check
    CHECK (mode IN ('dry_run')),
  CONSTRAINT bid_action_feed_status_check
    CHECK (status IN ('ready', 'applied', 'failed', 'skipped', 'stale')),
  CONSTRAINT bid_action_feed_keyword_target_check
    CHECK (
      entity_level <> 'keyword'
      OR (ad_group_id IS NOT NULL AND criterion_id IS NOT NULL)
    ),
  CONSTRAINT bid_action_feed_budget_target_check
    CHECK (
      action <> 'SET_BUDGET'
      OR entity_level = 'campaign'
    )
);

ALTER TABLE bid_action_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_bid_action_feed" ON bid_action_feed
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_bid_action_feed" ON bid_action_feed
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    mode = 'dry_run'
    AND status = 'ready'
    AND entity_level = 'campaign'
    AND action IN ('SET_BUDGET', 'PAUSE_CAMPAIGN', 'ENABLE_CAMPAIGN', 'SET_CAMPAIGN_LABEL')
    AND picked_at IS NULL
    AND applied_at IS NULL
  );

CREATE INDEX idx_bid_action_feed_status ON bid_action_feed (status, created_at);
CREATE INDEX idx_bid_action_feed_campaign ON bid_action_feed (campaign_id, created_at);
CREATE INDEX idx_bid_action_feed_keyword ON bid_action_feed (keyword_key, created_at)
  WHERE keyword_key IS NOT NULL;

CREATE TABLE bid_action_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id        uuid REFERENCES bid_action_feed(id) ON DELETE SET NULL,
  entity_level   text,
  keyword_key    text,
  campaign_id    text,
  action         text,
  mode           text,
  old_value      numeric,
  new_value      numeric,
  result         text NOT NULL,
  message        text,
  script_version text,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bid_action_log_entity_level_check
    CHECK (entity_level IS NULL OR entity_level IN ('campaign')),
  CONSTRAINT bid_action_log_action_check
    CHECK (action IS NULL OR action IN ('SET_BUDGET', 'PAUSE_CAMPAIGN', 'ENABLE_CAMPAIGN', 'SET_CAMPAIGN_LABEL')),
  CONSTRAINT bid_action_log_mode_check
    CHECK (mode IS NULL OR mode IN ('dry_run')),
  CONSTRAINT bid_action_log_result_check
    CHECK (
      result IN (
        'applied',
        'dry_run',
        'failed',
        'skipped',
        'skipped_smart_bidding',
        'skipped_bid_changed',
        'skipped_budget_changed',
        'skipped_shared_budget',
        'skipped_max_changes',
        'stale',
        'not_found',
        'error'
      )
    )
);

ALTER TABLE bid_action_log ENABLE ROW LEVEL SECURITY;

-- Audit log is read-only from the browser. Future server-side endpoints or the
-- in-account script reporting path must use privileged writes and preserve this log.
CREATE POLICY "select_bid_action_log" ON bid_action_log
  FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX idx_bid_action_log_feed ON bid_action_log (feed_id, created_at);
CREATE INDEX idx_bid_action_log_campaign ON bid_action_log (campaign_id, created_at);
CREATE INDEX idx_bid_action_log_result ON bid_action_log (result, created_at);
