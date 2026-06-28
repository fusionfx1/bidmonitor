-- Lock campaign mapping writes.
--
-- Frontend mapping writes are disabled in review-only mode. Keep the database
-- source aligned by removing public REST write policies for campaign_mappings.
--
-- Forward-only rollback plan:
-- create a new migration with narrowly-scoped INSERT/UPDATE/DELETE policies
-- after an approved authenticated account model exists.

ALTER TABLE public.campaign_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_campaign_mappings" ON public.campaign_mappings;
DROP POLICY IF EXISTS "update_campaign_mappings" ON public.campaign_mappings;
DROP POLICY IF EXISTS "delete_campaign_mappings" ON public.campaign_mappings;

REVOKE INSERT, UPDATE, DELETE ON public.campaign_mappings FROM anon, authenticated;
