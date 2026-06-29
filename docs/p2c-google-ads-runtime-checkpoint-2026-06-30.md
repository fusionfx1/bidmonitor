# P2C Google Ads Runtime Deploy Checkpoint

Date: 2026-06-30
Status: controlled deploy checkpoint recorded

## Live Google Ads Script Mapping

The live Google Ads Script project uses one project with three script files:

| Live file | Repository equivalent | Responsibility |
| --- | --- | --- |
| `boot.gs` | `scripts/google-ads/runner.gs` | Dispatcher. Owns the only `main()` entry point. |
| `Code.gs` | `scripts/google-ads/exporter.gs` | Read-only Google Ads exporter. Exposes `runExporter()`. |
| `applier.gs` | `scripts/google-ads/applier.gs` | Proposal applier scaffold. Exposes `runApplier()`. Mutation gates remain closed. |

Operational rule: schedules and manual runs must target `main` only. Do not schedule `runExporter()` or `runApplier()` directly.

## Runtime Properties

Production/default workflow remains exporter-only:

```text
P2C_SHEET_ID = 1E-JsqNy9mrgt-d4-O6ZkvFUpi6Ud6ugtljhRvD3hpK0
P2C_RUNTIME_WORKFLOW = exporter
```

The `all` workflow is supported as an alias for `exporter_then_applier`, but it was not smoke-tested in this checkpoint.

## Deploy Result

Controlled production run result:

| Item | Result |
| --- | --- |
| Run time | 2026-06-30 4:22 PM Bangkok |
| Google Ads execution status | Finished successfully |
| Google Ads changes | No changes |
| Sheet `sync_log` | `success` |
| `raw_policy` rows | 387 |
| Bid mutations | None |
| Budget mutations | None |
| Status pause/enable mutations | None |

The preceding preview also completed with `No changes`.

## Safety Gates

The applier remains installed but disabled by default:

```text
APPLIER_ENABLED=false
MODE=review_only
DRY_RUN=true
ALLOW_LIVE_MUTATION=false
MAX_CHANGES_PER_RUN=0
ENABLE_BUDGET_ACTIONS=false
ENABLE_BID_ACTIONS=false
ENABLE_STATUS_ACTIONS=false
```

Owner approval is required before changing any mutation gate or `MAX_CHANGES_PER_RUN` above zero.

## Explicitly Not Done

- Hourly schedule was not enabled.
- `P2C_RUNTIME_WORKFLOW=all` smoke test was not run.
- No UI/dashboard work was performed.
- No unrelated dirty workspace files were staged or committed.
- No applier mutation gates were opened.

## Notes

The exporter received a read-only GAQL compatibility hotfix during controlled deploy verification. The hotfix removes Google Ads runtime warnings from incompatible reporting fields while preserving the existing Sheet tab schemas.
