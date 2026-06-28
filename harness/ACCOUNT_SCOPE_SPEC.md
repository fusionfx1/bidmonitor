# Account Scope Specification

## Scope Definition
All data records used by ads/feed/sync/import must include and enforce:
- `account_id`
- `customer_id`
- `source_sheet_id`

## Scope Resolution
1. Determine the active scope from active settings context.
2. Validate required scope fields before running feed/import operations.
3. Apply scope as the default filter on all bid feed and sync queries.
4. Persist scope metadata on runtime records.

## Scope Isolation Rules
- Reject missing `account_id`, `customer_id`, `source_sheet_id` before query execution.
- Reject cross-account/sheet access by exact-match checks.
- Logs and diagnostics must avoid exposing raw credentials while retaining scope IDs.

## Compatibility
Scopes can be narrowed and still preserve the parent project safety policy.