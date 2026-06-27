import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CORS_HEADERS, corsResponse, corsError } from "../_shared/cors.ts";
import { hasCredentials, voluumFetch, getCachedReport, setCachedReport } from "../_shared/voluumClient.ts";

const TZ = (Deno.env.get("VOLUUM_TIMEZONE") ?? "Asia/Bangkok").replace(/^UTC\+7$/, "Asia/Bangkok");

const ALLOWED_GROUP_BY = new Set([
  "campaign", "offer", "landingPage", "country", "device", "keyword", "customVariable",
]);

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function hourFloor(d: Date): string {
  d.setMinutes(0, 0, 0);
  return d.toISOString().replace(/\.\d{3}Z$/, ".000Z");
}

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return hourFloor(d);
}

function defaultTo(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  return hourFloor(d);
}

function validateDate(s: string, field: string): string | null {
  if (!ISO_RE.test(s)) return `${field} must be an ISO datetime string (e.g. 2026-01-01T00:00:00Z)`;
  if (isNaN(Date.parse(s)))  return `${field} is not a valid date`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS_HEADERS });

  if (!hasCredentials()) {
    return corsResponse({ credentialsMissing: true, rows: [], totals: null });
  }

  const url = new URL(req.url);
  const p = url.searchParams;

  const from         = p.get("from")         ?? defaultFrom();
  const to           = p.get("to")           ?? defaultTo();
  const tz           = p.get("tz")           ?? TZ;
  const groupBy      = p.get("groupBy")      ?? "campaign";
  const rawLimit     = p.get("limit")        ?? "100";
  const sort         = p.get("sort")         ?? "profit";
  const direction    = p.get("direction")    ?? "desc";
  const campaignName = p.get("campaignName") ?? "";

  // ── Validation ────────────────────────────────────────────────────────────

  const fromErr = validateDate(from, "from");
  if (fromErr) return corsError(fromErr, 400);

  const toErr = validateDate(to, "to");
  if (toErr) return corsError(toErr, 400);

  if (!ALLOWED_GROUP_BY.has(groupBy)) {
    return corsError(
      `Invalid groupBy "${groupBy}". Allowed: ${[...ALLOWED_GROUP_BY].join(", ")}`,
      400
    );
  }

  const limit = Math.min(500, Math.max(1, parseInt(rawLimit, 10) || 100));

  if (direction !== "asc" && direction !== "desc") {
    return corsError(`Invalid direction "${direction}". Must be "asc" or "desc"`, 400);
  }

  // ── Cache + fetch ─────────────────────────────────────────────────────────

  const cacheKey = `report:${from}:${to}:${tz}:${groupBy}:${limit}:${sort}:${direction}:${campaignName}`;
  const cached = getCachedReport(cacheKey);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json", "X-Cache": "HIT" },
    });
  }

  const params = new URLSearchParams({ from, to, tz, groupBy, limit: String(limit), sort, direction });
  if (campaignName) {
    params.set("filter[campaign.name][operator]", "contains");
    params.set("filter[campaign.name][value]", campaignName);
  }

  try {
    const data = await voluumFetch(`/report?${params}`);
    setCachedReport(cacheKey, data);
    return new Response(JSON.stringify(data), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json", "X-Cache": "MISS" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return corsError(msg, 502);
  }
});
