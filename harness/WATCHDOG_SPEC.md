# Watchdog Specification

## Objective
Observe repository and runtime health continuously in a read-only manner.

## Watch Targets
- Runtime health (frontend and edge function endpoints)
- Repository health (tests, lint, dependency drift)
- Memory health (missing or stale memory packets)
- Sync health (scope-level import/sync status)
- API health (scope rejection and secret-safe responses)
- Deployment health (environment lock + no unsafes)
- Smoke health (local and API smoke checks)
- Test health (evidence freshness)

## Rules
- Observe-only. No auto-fix, no automation actions.
- Emit findings to packet templates only.
- Escalate severity with next required action.