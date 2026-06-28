# API Specification

## Public API Surface
- `supabase/functions/bid-feed`
- `supabase/functions/bid-feed-result`
- `supabase/functions/voluum/health`
- `supabase/functions/_shared/*`

## Behavior Baseline
1. Validate `account_id`, `customer_id`, `source_sheet_id` for scoped endpoints.
2. Return explicit errors for missing/invalid scope.
3. Never return write-capable tokens or secrets.
4. Keep response shape versioned and minimal for frontend compatibility.

## Review-only Contract
When operating in review-only mode:
- recommendations are returned as advisory records
- action lists must not execute writes
- action mode defaults to `review_only`

## Error Policy
- Scope rejection: explicit 400 with field-specific message
- Auth missing: explicit 401
- Server errors: concise code + message only

## Health Endpoints
- Expose only non-secret status checks
- Do not expose secret state or raw headers