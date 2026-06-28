# Latest Handoff

## 2026-06-28 — BID_FEED_TOKEN Rotation
- Status: PASS
- Report: [[handoffs/bid-feed-token-rotation-2026-06-28]]
- New feed token is active in Supabase and Google Ads Script property.
- Verification: new token returned HTTP 200; invalid token returned HTTP 403.
- Repo remained clean; no token was committed or documented.

## Safety Reminders
- Do not change function secrets without owner approval.
- Do not expose Voluum secrets or feed tokens.
- Keep default mode `review_only` unless owner explicitly approves otherwise.
