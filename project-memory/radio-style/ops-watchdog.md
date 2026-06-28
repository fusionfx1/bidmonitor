# Ops Watchdog

Harness ops checks should observe only unless owner approves action.

Observe:
- sync status
- import failures
- stale source sheets
- Voluum health
- dashboard health
- feed readiness

Do not:
- deploy
- restart production
- change secrets
- mutate Google Ads
- modify bids