# Test Plan

## Baseline Tests
- Unit: scope parser + bid/feed query builders + sync indicator
- Integration: missing scope rejection and valid scoped data retrieval
- API: bid-feed and bid-feed-result contract checks
- Regression: unscoped leakage checks

## Theme Checklist
1. Missing account_id rejected
2. Missing customer_id rejected
3. Missing source_sheet_id rejected
4. Scoped feed only returns matching data
5. Cross-account leak impossible
6. Cross-sheet leak impossible
7. action_mode defaults to review_only
8. Voluum secrets not in frontend
9. sync_runs never_synced behavior
10. stale/failed indicator behavior

## Evidence Requirements
- command, output, and pass/fail status per test run
- any blocked/missing commands should be explicitly listed