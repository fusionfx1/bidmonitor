import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CORS_HEADERS, corsResponse } from "../_shared/cors.ts";
import { hasCredentials, getTokenExpiresAt, testAuth } from "../_shared/voluumClient.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS_HEADERS });

  try {
    if (!hasCredentials()) {
      return corsResponse({
        connected: false,
        credentialsMissing: true,
        tokenExpiresAt: null,
        error: "VOLUUM_ACCESS_ID or VOLUUM_ACCESS_KEY not configured",
        lastCheckedAt: new Date().toISOString(),
      });
    }

    // Actually test the credentials — throws with a real error if they are wrong
    await testAuth();

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
      tokenExpiresAt: null,
      error: String(err),
      lastCheckedAt: new Date().toISOString(),
    });
  }
});
