# Current State

P2B local-first/account-scoped refactor is in place locally.

No deploy.
No db push.
No function secret changes.

Known changed files:
- supabase/functions/_shared/bidFeedCore.ts
- supabase/functions/bid-feed/index.ts
- supabase/functions/bid-feed-result/index.ts
- src/lib/__tests__/bidFeedFunctions.test.ts

Current behavior:
- bid-feed requires account_id, customer_id, source_sheet_id
- feed query scopes by account_id, customer_id, source_sheet_id
- status=ready
- mode=draft/review_only
