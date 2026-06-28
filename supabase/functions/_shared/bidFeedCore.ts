export type BidFeedAction = "SET_BUDGET" | "PAUSE_CAMPAIGN" | "ENABLE_CAMPAIGN" | "SET_CAMPAIGN_LABEL";
export type BidFeedEntityLevel = "campaign";
export type BidFeedMode = "dry_run";
export type BidFeedStatus = "ready" | "applied" | "failed" | "skipped" | "stale";
export type BidLogResult =
  | "dry_run"
  | "failed"
  | "skipped"
  | "skipped_smart_bidding"
  | "skipped_bid_changed"
  | "skipped_budget_changed"
  | "skipped_shared_budget"
  | "skipped_max_changes"
  | "stale"
  | "not_found"
  | "error";

export interface BidFeedRow {
  id: string;
  account_id: string;
  customer_id: string;
  source_sheet_id: string;
  entity_level: BidFeedEntityLevel;
  keyword_key: string | null;
  campaign_id: string;
  ad_group_id: string | null;
  criterion_id: string | null;
  campaign_name: string | null;
  ad_group_name: string | null;
  keyword: string | null;
  match_type: string | null;
  action: BidFeedAction;
  expected_current_bid: number | null;
  target_bid: number | null;
  expected_current_budget: number | null;
  target_budget: number | null;
  budget_is_shared: boolean | null;
  reason: string | null;
  mode: BidFeedMode;
  status: BidFeedStatus;
  created_at: string;
  picked_at: string | null;
  applied_at: string | null;
}

export interface BidActionLogInsert {
  feed_id: string;
  account_id: string;
  customer_id: string;
  source_sheet_id: string;
  entity_level: BidFeedEntityLevel;
  keyword_key: string | null;
  campaign_id: string;
  action: BidFeedAction;
  mode: "dry_run";
  old_value: number | null;
  new_value: number | null;
  result: BidLogResult;
  message: string | null;
  script_version: string | null;
}

export interface BidFeedDeps {
  token: string | null | undefined;
  feedEnabled?: boolean;
  now?: () => Date;
  listReadyDryRunFeedRows: (scope: AccountScope) => Promise<BidFeedRow[]>;
}

export interface BidFeedResultDeps {
  token: string | null | undefined;
  getFeedRow: (feedId: string, scope: AccountScope) => Promise<BidFeedRow | null>;
  insertLog: (row: BidActionLogInsert) => Promise<void>;
}

const VERSION = "p2b-dry-run-feed-v1";
const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const V1_CAMPAIGN_ACTIONS = new Set<string>([
  "SET_BUDGET",
  "PAUSE_CAMPAIGN",
  "ENABLE_CAMPAIGN",
  "SET_CAMPAIGN_LABEL",
]);
const RESULT_VALUES = new Set<BidLogResult>([
  "dry_run",
  "failed",
  "skipped",
  "skipped_smart_bidding",
  "skipped_bid_changed",
  "skipped_budget_changed",
  "skipped_shared_budget",
  "skipped_max_changes",
  "stale",
  "not_found",
  "error",
]);

export interface AccountScope {
  account_id: string;
  customer_id: string;
  source_sheet_id: string;
}

function json(body: unknown, status = 200, headers: HeadersInit = JSON_HEADERS): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function getProvidedToken(req: Request): string | null {
  const headerToken = req.headers.get("X-Feed-Token");
  if (headerToken) return headerToken;
  return new URL(req.url).searchParams.get("token");
}

function authorize(req: Request, expectedToken: string | null | undefined): Response | null {
  if (!expectedToken) return json({ error: "Feed token is not configured." }, 503);

  const providedToken = getProvidedToken(req);
  if (!providedToken) return json({ error: "Feed token is required." }, 401);
  if (providedToken !== expectedToken) return json({ error: "Invalid feed token." }, 403);

  return null;
}

function methodNotAllowed(allowedMethods: string): Response {
  return json({ error: "Method not allowed." }, 405, {
    ...JSON_HEADERS,
    Allow: allowedMethods,
  });
}

function isV1CampaignFeedRow(feed: BidFeedRow): boolean {
  return feed.entity_level === "campaign" && V1_CAMPAIGN_ACTIONS.has(feed.action);
}

function getAccountScope(req: Request): AccountScope | Response {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("account_id")?.trim() || req.headers.get("X-Account-Id")?.trim() || "";
  const customerId = url.searchParams.get("customer_id")?.trim() || req.headers.get("X-Customer-Id")?.trim() || "";
  const sourceSheetId =
    url.searchParams.get("source_sheet_id")?.trim() || req.headers.get("X-Source-Sheet-Id")?.trim() || "";

  if (!accountId || !customerId || !sourceSheetId) {
    return json({ error: "account_id, customer_id, and source_sheet_id are required." }, 400);
  }
  return { account_id: accountId, customer_id: customerId, source_sheet_id: sourceSheetId };
}

export function feedCorsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Feed-Token, X-Account-Id, X-Customer-Id, X-Source-Sheet-Id",
  };
}

export function resultCorsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Feed-Token, X-Account-Id, X-Customer-Id, X-Source-Sheet-Id",
  };
}

export function createBidFeedHandler(deps: BidFeedDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: feedCorsHeaders() });
    if (req.method !== "GET") return methodNotAllowed("GET, OPTIONS");

    const authError = authorize(req, deps.token);
    if (authError) return authError;

    const scope = getAccountScope(req);
    if (scope instanceof Response) return scope;

    const feedEnabled = deps.feedEnabled ?? true;
    const items = feedEnabled ? (await deps.listReadyDryRunFeedRows(scope)).filter(isV1CampaignFeedRow) : [];

    return json(
      {
        version: VERSION,
        generatedAt: (deps.now ?? (() => new Date()))().toISOString(),
        guardrails: {
          dryRun: true,
          applyEnabled: false,
          liveMutationEnabled: false,
          feedEnabled,
        },
        items,
      },
      200,
      { ...feedCorsHeaders(), ...JSON_HEADERS }
    );
  };
}

function parseResultPayload(body: unknown): {
  feed_id: string;
  account_id: string;
  customer_id: string;
  source_sheet_id: string;
  result: BidLogResult;
  message: string | null;
  script_version: string | null;
} | Response {
  if (!body || typeof body !== "object") return json({ error: "JSON object payload is required." }, 400);

  const payload = body as Record<string, unknown>;
  if (payload.dryRun === false) return json({ error: "Only dry-run results are accepted in P2B." }, 400);
  if (payload.result === "applied") return json({ error: "Live applied results are not accepted in P2B." }, 400);

  const feedId = typeof payload.feed_id === "string" ? payload.feed_id : "";
  if (!UUID_RE.test(feedId)) return json({ error: "Valid feed_id is required." }, 400);

  const accountId = typeof payload.account_id === "string" ? payload.account_id.trim() : "";
  const customerId = typeof payload.customer_id === "string" ? payload.customer_id.trim() : "";
  const sourceSheetId = typeof payload.source_sheet_id === "string" ? payload.source_sheet_id.trim() : "";
  if (!accountId || !customerId || !sourceSheetId) {
    return json({ error: "account_id, customer_id, and source_sheet_id are required." }, 400);
  }

  const result = typeof payload.result === "string" ? payload.result : "";
  if (!RESULT_VALUES.has(result as BidLogResult)) return json({ error: "Valid dry-run result is required." }, 400);

  return {
    feed_id: feedId,
    account_id: accountId,
    customer_id: customerId,
    source_sheet_id: sourceSheetId,
    result: result as BidLogResult,
    message: typeof payload.message === "string" ? payload.message.slice(0, 1000) : null,
    script_version: typeof payload.script_version === "string" ? payload.script_version.slice(0, 120) : null,
  };
}

function logValuesFromFeed(feed: BidFeedRow): Pick<BidActionLogInsert, "old_value" | "new_value"> {
  if (feed.action === "SET_BUDGET") {
    return { old_value: feed.expected_current_budget, new_value: feed.target_budget };
  }
  return { old_value: null, new_value: null };
}

export function createBidFeedResultHandler(deps: BidFeedResultDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: resultCorsHeaders() });
    if (req.method !== "POST") return methodNotAllowed("POST, OPTIONS");

    const authError = authorize(req, deps.token);
    if (authError) return authError;

    let parsedJson: unknown;
    try {
      parsedJson = await req.json();
    } catch {
      return json({ error: "Valid JSON payload is required." }, 400);
    }

    const payload = parseResultPayload(parsedJson);
    if (payload instanceof Response) return payload;

    const scope = {
      account_id: payload.account_id,
      customer_id: payload.customer_id,
      source_sheet_id: payload.source_sheet_id,
    };
    const feed = await deps.getFeedRow(payload.feed_id, scope);
    if (!feed) return json({ error: "Feed row not found for account scope." }, 404);
    if (feed.mode !== "dry_run") return json({ error: "Only dry-run feed rows are accepted in P2B." }, 400);
    if (!isV1CampaignFeedRow(feed)) return json({ error: "Only v1 campaign dry-run feed rows are accepted." }, 400);
    if (
      feed.account_id !== payload.account_id ||
      feed.customer_id !== payload.customer_id ||
      feed.source_sheet_id !== payload.source_sheet_id
    ) {
      return json({ error: "Result account scope does not match feed row." }, 403);
    }

    const values = logValuesFromFeed(feed);
    await deps.insertLog({
      feed_id: payload.feed_id,
      account_id: feed.account_id,
      customer_id: feed.customer_id,
      source_sheet_id: feed.source_sheet_id,
      entity_level: feed.entity_level,
      keyword_key: feed.keyword_key,
      campaign_id: feed.campaign_id,
      action: feed.action,
      mode: "dry_run",
      old_value: values.old_value,
      new_value: values.new_value,
      result: payload.result,
      message: payload.message,
      script_version: payload.script_version,
    });

    return json(
      {
        ok: true,
        dryRun: true,
        feed_id: payload.feed_id,
        result: payload.result,
      },
      200,
      { ...resultCorsHeaders(), ...JSON_HEADERS }
    );
  };
}
