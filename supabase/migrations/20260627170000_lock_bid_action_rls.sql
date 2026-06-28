-- Gold 2B RLS security fix.
-- Close public REST access to bid action feed/log tables.
--
-- Context:
-- - Edge Functions bid-feed and bid-feed-result use the server-side service role.
-- - There is no approved scoped authenticated REST path for these tables yet.
-- - Therefore anon/authenticated REST SELECT/INSERT must be denied by default.
--
-- Forward-only rollback plan:
-- create a new migration that restores narrowly-scoped policies after an
-- authenticated tenant/account model is approved.

ALTER TABLE bid_action_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_action_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_bid_action_feed" ON bid_action_feed;
DROP POLICY IF EXISTS "select_bid_action_feed" ON bid_action_feed;
DROP POLICY IF EXISTS "select_bid_action_log" ON bid_action_log;

REVOKE SELECT, INSERT, UPDATE, DELETE ON bid_action_feed FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON bid_action_log FROM anon, authenticated;
