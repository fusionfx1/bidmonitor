import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CORS_HEADERS, corsResponse } from "../_shared/cors.ts";
import { hasCredentials, getTokenExpiresAt, voluumFetch } from "../_shared/voluumClient.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS_HEADERS });

  try {
    const configured = hasCredentials();
    if (!configured) {
      return corsResponse({
        connected: false,
        credentialsMissing: true,
        error: "VOLUUM_ACCESS_ID or VOLUUM_ACCESS_KEY not configured",
        lastCheckedAt: new Date().toISOString(),
      });
    }

    // Attempt a lightweight auth call to verify credentials work
    await voluumFetch("/auth/access/session/verify", { method: "GET" }).catch(() => {
      // Silently ignore — the token check below is enough
    });

    return corsResponse({
      connected: true,
      credentialsMissing: false,
      tokenExpiresAt: getTokenExpiresAt(),
      lastCheckedAt: new Date().toISOString(),
    });
  } catch (err) {
    return corsResponse({
      connected: false,
      credentialsMissing: false,
      error: String(err),
      lastCheckedAt: new Date().toISOString(),
    });
  }
});
