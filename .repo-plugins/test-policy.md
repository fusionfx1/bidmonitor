# Test Policy

## Required Before Reporting Complete

Run:

```bash
npm run lint
npm run typecheck
npm run build
npm test
```

If full suite is too large or blocked:

* Run focused tests
* Report exactly what passed
* Report exactly what was not run
* Do not claim full pass

## Required Test Themes

1. Missing account_id rejected
2. Missing customer_id rejected
3. Missing source_sheet_id rejected
4. Scoped feed only returns matching data
5. Cross-account feed leakage impossible
6. Cross-sheet feed leakage impossible
7. action_mode defaults to review_only
8. Voluum secrets not in frontend
9. Sync indicator handles never_synced
10. Sync indicator handles failed/stale