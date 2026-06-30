import type {
  VoluumRawReport, VoluumHealth, VoluumRecommendation, ReportParams,
  VoluumCampaignsResponse, VoluumCampaignStatusFilter,
} from './types';

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const BASE = `${SUPABASE_URL}/functions/v1`;

const AUTH_HEADERS = {
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  apikey: SUPABASE_ANON_KEY,
};

async function callFunction<T>(slug: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}/${slug}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) url.searchParams.set(k, v); });
  }
  const res = await fetch(url.toString(), { headers: AUTH_HEADERS });
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`[${slug}] ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchVoluumHealth(): Promise<VoluumHealth> {
  return callFunction<VoluumHealth>('voluum-health');
}

export async function fetchVoluumReport(params: ReportParams): Promise<VoluumRawReport> {
  return callFunction<VoluumRawReport>('voluum-report', {
    from:         params.from,
    to:           params.to,
    tz:           params.tz ?? 'Asia/Bangkok',
    groupBy:      params.groupBy ?? 'campaign',
    limit:        String(params.limit ?? 100),
    sort:         params.sort ?? 'profit',
    direction:    params.direction ?? 'desc',
    ...(params.campaignName ? { campaignName: params.campaignName } : {}),
  });
}

export async function fetchVoluumCampaigns(status: VoluumCampaignStatusFilter = 'active'): Promise<VoluumCampaignsResponse> {
  return callFunction<VoluumCampaignsResponse>('voluum-campaigns', { status });
}

export interface RecommendationResponse {
  recommendations: VoluumRecommendation[];
  generatedAt: string;
  credentialsMissing?: boolean;
}

export async function fetchVoluumRecommendations(
  params: ReportParams & { minSpend?: number; minClicks?: number; minConversions?: number }
): Promise<RecommendationResponse> {
  return callFunction<RecommendationResponse>('voluum-recommendations', {
    from:           params.from,
    to:             params.to,
    ...(params.minSpend       !== undefined ? { minSpend:       String(params.minSpend)       } : {}),
    ...(params.minClicks      !== undefined ? { minClicks:      String(params.minClicks)      } : {}),
    ...(params.minConversions !== undefined ? { minConversions: String(params.minConversions) } : {}),
  });
}

// ─── Date range helpers ───────────────────────────────────────────────────────

export type DateRangePreset = 'today' | 'yesterday' | 'last7' | 'last14' | 'last30' | 'custom';

// Voluum requires times rounded to the nearest hour
function hourFloor(d: Date): string {
  d.setMinutes(0, 0, 0);
  return d.toISOString().replace(/\.\d{3}Z$/, '.000Z');
}

export function resolveDateRange(preset: DateRangePreset, custom?: { from: string; to: string }) {
  if (preset === 'custom' && custom) return { from: custom.from, to: custom.to };

  const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  const nextHour = () => { const d = new Date(); d.setHours(d.getHours() + 1); return d; };

  switch (preset) {
    case 'today':     return { from: hourFloor(daysAgo(0)), to: hourFloor(nextHour()) };
    case 'yesterday': return { from: hourFloor(daysAgo(1)), to: hourFloor(daysAgo(0)) };
    case 'last7':     return { from: hourFloor(daysAgo(7)),  to: hourFloor(nextHour()) };
    case 'last14':    return { from: hourFloor(daysAgo(14)), to: hourFloor(nextHour()) };
    case 'last30':    return { from: hourFloor(daysAgo(30)), to: hourFloor(nextHour()) };
    default:          return { from: hourFloor(daysAgo(7)),  to: hourFloor(nextHour()) };
  }
}
