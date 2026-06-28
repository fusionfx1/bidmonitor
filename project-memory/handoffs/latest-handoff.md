# Latest Handoff

## Current State
Harness P2B local account-scoped refactor is in place.

## Do Not Do
- Do not deploy
- Do not db push
- Do not change function secrets
- Do not mutate Google Ads
- Do not expose Voluum secrets

## Next Task
Implement Harness foundation locally only:
- sync_runs or sheet_import_runs abstraction
- dashboard sync indicator
- scoped helpers
- cross-account isolation tests

## Required Report
Use `.repo-plugins/handoff-template.md`