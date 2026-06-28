import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createBidFeedResultHandler,
  type BidActionLogInsert,
  type BidFeedRow,
} from "../_shared/bidFeedCore.ts";
import { dbInsert, dbSelect } from "../_shared/supabaseAdmin.ts";

const TOKEN = Deno.env.get("BID_FEED_TOKEN");

const handler = createBidFeedResultHandler({
  token: TOKEN,
  getFeedRow: async (feedId: string, scope) => {
    const rows = await dbSelect<BidFeedRow>(
      "bid_action_feed",
      `select=*&id=eq.${encodeURIComponent(feedId)}&entity_level=eq.campaign&action=in.(SET_BUDGET,PAUSE_CAMPAIGN,ENABLE_CAMPAIGN,SET_CAMPAIGN_LABEL)&account_id=eq.${encodeURIComponent(scope.account_id)}&customer_id=eq.${encodeURIComponent(scope.customer_id)}&source_sheet_id=eq.${encodeURIComponent(scope.source_sheet_id)}&limit=1`
    );
    return rows[0] ?? null;
  },
  insertLog: (row: BidActionLogInsert) => dbInsert("bid_action_log", row),
});

Deno.serve(handler);
