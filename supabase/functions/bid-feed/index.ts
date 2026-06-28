import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createBidFeedHandler, type BidFeedRow } from "../_shared/bidFeedCore.ts";
import { dbSelect } from "../_shared/supabaseAdmin.ts";

const TOKEN = Deno.env.get("BID_FEED_TOKEN");
const FEED_ENABLED = Deno.env.get("BID_FEED_ENABLED") !== "false";

const handler = createBidFeedHandler({
  token: TOKEN,
  feedEnabled: FEED_ENABLED,
  listReadyDryRunFeedRows: (scope) =>
    dbSelect<BidFeedRow>(
      "bid_action_feed",
      `select=*&status=eq.ready&mode=eq.dry_run&entity_level=eq.campaign&action=in.(SET_BUDGET,PAUSE_CAMPAIGN,ENABLE_CAMPAIGN,SET_CAMPAIGN_LABEL)&account_id=eq.${encodeURIComponent(scope.account_id)}&customer_id=eq.${encodeURIComponent(scope.customer_id)}&source_sheet_id=eq.${encodeURIComponent(scope.source_sheet_id)}&order=created_at.asc&limit=100`
    ),
});

Deno.serve(handler);
