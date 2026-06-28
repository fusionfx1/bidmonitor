# Deploy Plan

## Principle
No deploy by default.

## Blocking Conditions
- Any missing hard stop check
- Scope expansion outside approved task
- Secret or credential change
- db push required
- Google Ads mutate/bid write risk

## Gate to Deploy
1. Owner approval
2. Lint + typecheck + build + tests pass
3. Repo health and watchdog checks pass
4. Smoke checklist complete
5. Rollback plan attached

## Post-deploy rollback
- capture packet in `.projectmem/snapshots/`
- keep previous config snapshots
- document rollback command sequence (even if not executed)