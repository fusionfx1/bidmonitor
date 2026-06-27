// Module-level token + report cache — persists across requests in the same Deno instance.
interface TokenCache {
  token: string;
  expiresAt: number; // epoch ms
}

interface ReportCacheEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;
const reportCache = new Map<string, ReportCacheEntry>();

// In-flight dedup: concurrent identical requests share one upstream call.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inFlight = new Map<string, Promise<any>>();

function normalizeApiBase(raw: string | undefined): string {
  const s = (raw ?? "https://api.voluum.com").trim().replace(/\/+$/, "");
  return s.startsWith("http") ? s : `https://${s}`;
}
const API_BASE = normalizeApiBase(Deno.env.get("VOLUUM_API_BASE"));
const ACCESS_ID = Deno.env.get("VOLUUM_ACCESS_ID") ?? "";
const ACCESS_KEY = Deno.env.get("VOLUUM_ACCESS_KEY") ?? "";
const CACHE_TTL_MS =
  parseInt(Deno.env.get("VOLUUM_CACHE_TTL_SECONDS") ?? "300", 10) * 1000;

export function hasCredentials(): boolean {
  return Boolean(ACCESS_ID && ACCESS_KEY);
}

export function getTokenExpiresAt(): string | null {
  return tokenCache ? new Date(tokenCache.expiresAt).toISOString() : null;
}

/** Acquire a fresh token to prove credentials are valid. Throws on auth failure. */
export async function testAuth(): Promise<void> {
  await acquireToken();
}

async function acquireToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const res = await fetch(`${API_BASE}/auth/access/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessId: ACCESS_ID, accessKey: ACCESS_KEY }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Voluum auth failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  const token: string = json.token;
  // Use explicit expiry if provided, else default to 55 min
  const expiresAt = json.tokenExpirationDate
    ? new Date(json.tokenExpirationDate).getTime()
    : Date.now() + 55 * 60 * 1000;

  tokenCache = { token, expiresAt };
  return token;
}

export async function voluumFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // Deduplicate concurrent identical calls
  const key = `${path}::${JSON.stringify(options.body ?? "")}`;
  if (inFlight.has(key)) return inFlight.get(key)! as Promise<T>;

  const promise = (async (): Promise<T> => {
    try {
      const doRequest = async (token: string): Promise<Response> =>
        fetch(`${API_BASE}${path}`, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            "cwauth-token": token,
            ...(options.headers ?? {}),
          },
        });

      let token = await acquireToken();
      let res = await doRequest(token);

      // Retry once on 401 with a fresh token
      if (res.status === 401) {
        tokenCache = null;
        token = await acquireToken();
        res = await doRequest(token);
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Voluum API ${res.status}: ${text}`);
      }

      return res.json() as Promise<T>;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

// ─── Report-level cache helpers ───────────────────────────────────────────────

export function getCachedReport(key: string): unknown | null {
  const entry = reportCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  return null;
}

export function setCachedReport(key: string, data: unknown): void {
  reportCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}
