-- Quarantine legacy keyword bid feed rows and enforce the v1 campaign feed contract.
--
-- This is forward-only hardening for databases that already applied an earlier
-- bid_action_feed schema where keyword SET_BID rows were allowed.

UPDATE bid_action_feed
SET status = 'stale'
WHERE status = 'ready'
  AND (
    mode <> 'dry_run'
    OR entity_level <> 'campaign'
    OR action NOT IN ('SET_BUDGET', 'PAUSE_CAMPAIGN', 'ENABLE_CAMPAIGN', 'SET_CAMPAIGN_LABEL')
  );

ALTER TABLE bid_action_feed
  DROP CONSTRAINT IF EXISTS bid_action_feed_entity_level_check,
  ADD CONSTRAINT bid_action_feed_entity_level_check
    CHECK (entity_level = 'campaign') NOT VALID;

ALTER TABLE bid_action_feed
  DROP CONSTRAINT IF EXISTS bid_action_feed_action_check,
  ADD CONSTRAINT bid_action_feed_action_check
    CHECK (action IN ('SET_BUDGET', 'PAUSE_CAMPAIGN', 'ENABLE_CAMPAIGN', 'SET_CAMPAIGN_LABEL')) NOT VALID;

ALTER TABLE bid_action_log
  DROP CONSTRAINT IF EXISTS bid_action_log_entity_level_check,
  ADD CONSTRAINT bid_action_log_entity_level_check
    CHECK (entity_level IS NULL OR entity_level = 'campaign') NOT VALID;

ALTER TABLE bid_action_log
  DROP CONSTRAINT IF EXISTS bid_action_log_action_check,
  ADD CONSTRAINT bid_action_log_action_check
    CHECK (action IS NULL OR action IN ('SET_BUDGET', 'PAUSE_CAMPAIGN', 'ENABLE_CAMPAIGN', 'SET_CAMPAIGN_LABEL')) NOT VALID;
