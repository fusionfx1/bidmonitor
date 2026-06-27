import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CORS_HEADERS, corsResponse, corsError } from "../_shared/cors.ts";
import { hasCredentials, voluumFetch, getCachedReport, setCachedReport } from "../_shared/voluumClient.ts";

const TZ = Deno.env.get("VOLUUM_TIMEZONE") ?? "Asia/Bangkok";

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

const T = {
  minSpendCut: 10,
  minClicksCut: 10,
  minClicksInvestigate: 50,
  goodRoiScale: 0.5,
  lowCvrThreshold: 0.02,
  minConversionsScale: 1,
  negativeRoiCut: -0.3,
};

type Action = "SCALE" | "WATCH" | "CUT" | "INVESTIGATE";
type Confidence = "LOW" | "MEDIUM" | "HIGH";

interface Row {
  campaignId: string;
  campaignName: string;
  visits: number;
  clicks: number;
  conversions: number;
  cost: number;
  revenue: number;
  profit: number;
  roi: number;
  cvr: number;
}

function n(v: unknown): number {
  const x = parseFloat(String(v ?? 0));
  return isNaN(x) ? 0 : x;
}

function normalizeRow(r: Record<string, unknown>): Row {
  const name = String(
    r["campaignName"] ?? (r["campaign"] as Record<string, unknown>)?.["name"] ?? r["name"] ?? ""
  );
  const id = String(
    r["campaignId"] ?? (r["campaign"] as Record<string, unknown>)?.["id"] ?? r["id"] ?? ""
  );
  const clicks      = n(r["clicks"]);
  const conversions = n(r["conversions"]);
  const cost        = n(r["cost"]);
  const revenue     = n(r["revenue"]);
  const visits      = n(r["visits"]);
  const profit      = revenue - cost;
  const roi         = cost > 0 ? profit / cost : 0;
  const cvr         = clicks > 0 ? conversions / clicks : 0;
  return { campaignId: id, campaignName: name, visits, clicks, conversions, cost, revenue, profit, roi, cvr };
}

function recommend(row: Row): { action: Action; reason: string; confidence: Confidence } {
  const { cost, clicks, conversions, roi, cvr, profit } = row;
  if (cost >= T.minSpendCut && conversions === 0)
    return { action: "CUT", reason: "Spend with zero conversions", confidence: "HIGH" };
  if (cost >= T.minSpendCut && clicks >= T.minClicksCut && roi < T.negativeRoiCut)
    return { action: "CUT", reason: `Negative ROI (${(roi * 100).toFixed(1)}%)`, confidence: "HIGH" };
  if (conversions >= T.minConversionsScale && roi >= T.goodRoiScale && profit > 0) {
    const conf: Confidence = roi >= 1 ? "HIGH" : "MEDIUM";
    return { action: "SCALE", reason: `Strong ROI ${(roi * 100).toFixed(1)}% with ${conversions} conv.`, confidence: conf };
  }
  if (clicks >= T.minClicksInvestigate && cvr < T.lowCvrThreshold && conversions === 0)
    return { action: "INVESTIGATE", reason: `High clicks (${clicks}) but zero CVR`, confidence: "MEDIUM" };
  return { action: "WATCH", reason: "Insufficient data to decide", confidence: "LOW" };
}

function defaultFrom(): string {
  const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); return d.toISOString();
}
function defaultTo(): string {
  const d = new Date(); d.setHours(23, 59, 59, 999); return d.toISOString();
}

function validateDate(s: string, field: string): string | null {
  if (!ISO_RE.test(s)) return `${field} must be an ISO datetime string`;
  if (isNaN(Date.parse(s))) return `${field} is not a valid date`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS_HEADERS });

  if (!hasCredentials()) {
    return corsResponse({ credentialsMissing: true, recommendations: [] });
  }

  const url = new URL(req.url);
  const p = url.searchParams;

  const from           = p.get("from")         ?? defaultFrom();
  const to             = p.get("to")           ?? defaultTo();
  const rawMinSpend    = p.get("minSpend")      ?? "10";
  const rawMinClicks   = p.get("minClicks")     ?? "10";
  const rawMinConv     = p.get("minConversions") ?? "1";
  const targetRoi      = p.get("targetRoi")  ? parseFloat(p.get("targetRoi")!)  : null;
  const targetCpa      = p.get("targetCpa")  ? parseFloat(p.get("targetCpa")!)  : null;

  // ── Validation ────────────────────────────────────────────────────────────

  const fromErr = validateDate(from, "from");
  if (fromErr) return corsError(fromErr, 400);

  const toErr = validateDate(to, "to");
  if (toErr) return corsError(toErr, 400);

  const minSpend  = parseFloat(rawMinSpend);
  const minClicks = parseInt(rawMinClicks, 10);
  const minConversions = parseInt(rawMinConv, 10);

  if (isNaN(minSpend)  || minSpend  < 0) return corsError("minSpend must be a non-negative number",  400);
  if (isNaN(minClicks) || minClicks < 0) return corsError("minClicks must be a non-negative integer", 400);
  if (isNaN(minConversions) || minConversions < 0) return corsError("minConversions must be a non-negative integer", 400);
  if (targetRoi !== null && isNaN(targetRoi))  return corsError("targetRoi must be a number", 400);
  if (targetCpa !== null && (isNaN(targetCpa) || targetCpa < 0)) return corsError("targetCpa must be a non-negative number", 400);

  // ── Cache + fetch ─────────────────────────────────────────────────────────

  const cacheKey = `recs:${from}:${to}:${minSpend}:${minClicks}:${minConversions}:${targetRoi}:${targetCpa}`;
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
    const data = await voluumFetch<{ rows?: unknown[] }>(`/report?${params}`);
    const rawRows: unknown[] = data?.rows ?? [];

    const recommendations = rawRows
      .map((r) => normalizeRow(r as Record<string, unknown>))
      .filter((r) => r.cost >= minSpend && r.clicks >= minClicks)
      .map((r) => {
        const rec = recommend(r);
        if (targetRoi !== null && r.roi >= targetRoi && r.conversions >= minConversions) {
          rec.action = "SCALE";
          rec.reason = `Meets target ROI (${(r.roi * 100).toFixed(1)}% >= ${(targetRoi * 100).toFixed(1)}%)`;
        }
        if (targetCpa !== null && r.conversions > 0 && r.cost / r.conversions <= targetCpa) {
          rec.action = "SCALE";
          rec.reason = `CPA within target (฿${(r.cost / r.conversions).toFixed(2)} <= ฿${targetCpa.toFixed(2)})`;
        }
        return {
          action: rec.action,
          entityType: "campaign" as const,
          entityName: r.campaignName,
          reason: rec.reason,
          confidence: rec.confidence,
          metrics: {
            visits: r.visits, clicks: r.clicks, conversions: r.conversions,
            cost: r.cost, revenue: r.revenue, profit: r.profit,
            roi: r.roi, cvr: r.cvr,
          },
        };
      });

    const result = { recommendations, generatedAt: new Date().toISOString() };
    setCachedReport(cacheKey, result);
    return corsResponse(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return corsError(msg, 502);
  }
});
