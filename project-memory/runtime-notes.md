# Runtime Notes

## Current Runtime
- Frontend: Vite + React + TypeScript
- Runtime backend endpoints in Supabase Edge Functions
- Local memory and policy layer now active

## Last Known Status
- Sync and account scope infrastructure exists
- No production deploy executed in this repo session

## Operational Notes
- Dashboard sync status must always be scoped by `account_id`, `customer_id`, `source_sheet_id`.
- Scope mismatch should fail closed and log the event.