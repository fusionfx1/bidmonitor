import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CORS_HEADERS, corsResponse, corsError } from "../_shared/cors.ts";
import { hasCredentials, voluumFetch, getCachedReport, setCachedReport } from "../_shared/voluumClient.ts";

const TZ = (Deno.env.get("VOLUUM_TIMEZONE") ?? "Asia/Bangkok").replace(/^UTC\+7$/, "Asia/Bangkok");

// Voluum requires times rounded to the nearest hour (no min/sec)
function hourFloor(d: Date): string {
  d.setMinutes(0, 0, 0);
  return d.toISOString().replace(/\.\d{3}Z$/, ".000Z");
}

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return hourFloor(d);
}

function defaultTo(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  return hourFloor(d);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS_HEADERS });

  if (!hasCredentials()) {
    return corsResponse({ credentialsMissing: true, rows: [] });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? defaultFrom();
  const to   = url.searchParams.get("to")   ?? defaultTo();

  const cacheKey = `campaigns:${from}:${to}`;
  const cached = getCachedReport(cacheKey);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json", "X-Cache": "HIT" },
    });
  }

  const params = new URLSearchParams({
    from, to, tz: TZ, groupBy: "campaign", limit: "500", sort: "cost", direction: "desc",
  });

  try {
    const data = await voluumFetch(`/report?${params}`);
    setCachedReport(cacheKey, data);
    return new Response(JSON.stringify(data), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json", "X-Cache": "MISS" },
    });
  } catch (err) {
    return corsError(String(err), 502);
  }
});
