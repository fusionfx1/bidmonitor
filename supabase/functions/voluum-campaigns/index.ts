import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CORS_HEADERS, corsResponse, corsError } from "../_shared/cors.ts";
import { hasCredentials, voluumFetch, getCachedReport, setCachedReport } from "../_shared/voluumClient.ts";

type CampaignLike = Record<string, unknown> & {
  id?: string;
  name?: string;
  status?: string;
  state?: string;
  archived?: boolean;
  deleted?: boolean;
  campaign?: { id?: string; name?: string; status?: string; archived?: boolean; deleted?: boolean };
};

function rowsFromPayload(payload: unknown): CampaignLike[] {
  if (Array.isArray(payload)) return payload as CampaignLike[];
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  for (const key of ["rows", "campaigns", "items", "data"]) {
    if (Array.isArray(obj[key])) return obj[key] as CampaignLike[];
  }
  const embedded = obj._embedded;
  if (embedded && typeof embedded === "object") {
    const embeddedObj = embedded as Record<string, unknown>;
    for (const key of ["campaigns", "items", "data"]) {
      if (Array.isArray(embeddedObj[key])) return embeddedObj[key] as CampaignLike[];
    }
  }
  return [];
}

function statusText(row: CampaignLike): string {
  return String(row.status ?? row.state ?? row.campaign?.status ?? "").trim().toUpperCase();
}

function archivedFlag(row: CampaignLike): boolean {
  return Boolean(row.archived || row.deleted || row.campaign?.archived || row.campaign?.deleted);
}

function isActiveCampaign(row: CampaignLike): boolean {
  if (archivedFlag(row)) return false;
  const status = statusText(row);
  if (!status) return true;
  if (["ARCHIV", "DELETED", "DISABLED", "INACTIVE", "PAUSED", "STOPPED", "REMOVED"].some((value) => status.includes(value))) return false;
  if (["ACTIVE", "RUNNING", "LIVE", "ENABLED"].some((value) => status.includes(value))) return true;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS_HEADERS });

  if (!hasCredentials()) {
    return corsResponse({ credentialsMissing: true, rows: [] });
  }

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") === "all" ? "all" : "active";
  const cacheKey = `campaign-metadata:${statusFilter}`;
  const cached = getCachedReport(cacheKey);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json", "X-Cache": "HIT" },
    });
  }

  try {
    const payload = await voluumFetch<unknown>("/campaign");
    const allRows = rowsFromPayload(payload);
    const rows = statusFilter === "active" ? allRows.filter(isActiveCampaign) : allRows;
    const base = payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
    const data = {
      ...base,
      rows,
      totalRows: rows.length,
      source: "campaign-metadata",
      statusFilter,
    };
    setCachedReport(cacheKey, data);
    return new Response(JSON.stringify(data), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json", "X-Cache": "MISS" },
    });
  } catch (err) {
    return corsError(String(err), 502);
  }
});
