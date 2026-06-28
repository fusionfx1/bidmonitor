# Deploy Policy

## Default
No deploy.

## Deploy Requires
- Owner explicit approval
- Clean git status or isolated worktree
- lint pass
- typecheck pass
- build pass
- tests pass
- smoke plan
- rollback plan

## Block Deploy If
- Google Ads mutate path exists
- action_mode can default to write mode
- Any secret exposed to frontend
- Any unscoped account/customer/source_sheet query exists
- Voluum write endpoint is reachable from frontend