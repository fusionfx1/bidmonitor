# GOAL

Work on the `bidmonitor` repo as the Google Ads Command Center / BidMonitor system.

Current project state:
- P2A.2 account-scope migration is complete locally and remotely.
- Remote schema now supports account-scoped `bid_action_feed` and `bid_action_log`.
- P2B account-scoped Edge Functions are implemented locally but not deployed.
- Next required task is P2B local Edge Function smoke, then remote safety gate, then deploy only `bid-feed` and `bid-feed-result` if all gates pass.

Primary goal:
Finish P2B safely by validating account-scoped `bid-feed` and `bid-feed-result` behavior end-to-end without introducing any live Google Ads mutation path.

Longer-term goal:
Maintain this repo as a review-first Google Ads Command Center with Google Ads Script, Google Sheet, Apps Script API, Supabase, Edge Functions, Dashboard, Voluum read context, Sync Center, and future AI recommendations.

# AUTHORITY

Source of truth priority:
1. Latest owner instruction in the current task.
2. Repo code and tests.
3. Notion project page: `Google Ads Command Center / BidMonitor`.
4. Existing safety decisions from P2A.2/P2B.
5. Existing local patterns in the codebase.

The agent may:
- Read repo files.
- Run local tests/build/lint/typecheck.
- Add narrow code/tests/docs required by the requested task.
- Run local Edge Function smoke.
- Run read-only remote verification commands.
- Deploy `bid-feed` and `bid-feed-result` only after all explicit gates pass.

The agent must stop and report before:
- Any `db push`.
- Any schema migration.
- Any function secret change.
- Any Google Ads Script install/change.
- Any Google Ads API/OAuth/developer token path.
- Any live mutation or apply path.
- Any deploy beyond `bid-feed` / `bid-feed-result`.
- Any scope expansion outside P2B unless explicitly approved.

# CONSTRAINTS

Hard safety rules:
- No live Google Ads mutation.
- No `dryRun: false`.
- No `applyEnabled: true`.
- No Voluum apply path.
- No Google Ads API/OAuth/developer token path.
- No service role exposure in frontend.
- No global fallback feed.
- Feed/result operations must always be scoped by:
  - `account_id`
  - `customer_id`
  - `source_sheet_id`
- Default behavior remains `dry_run` and `review_only`.
- Edge Functions may use service role server-side only.
- Frontend must use anon/session-safe paths only.
- Do not deploy unrelated functions.
- Do not change function secrets unless explicitly instructed.

Repo safety:
- Respect dirty worktree state.
- Do not revert unrelated user changes.
- Do not run destructive git commands.
- Do not mix unrelated refactors.
- Keep changes narrow and test-backed.

# DONE CRITERIA

P2B is done only when all are true:

Local validation:
- `npm test` passes.
- `npm run typecheck` passes.
- `npm run build` passes.
- `npm run lint` passes, allowing only the two known fast-refresh warnings if unchanged.

Local Edge Function smoke:
- Scoped Account A test row is returned only for Account A.
- Account B decoy row never leaks into Account A response.
- Missing scope is rejected or returns no usable feed.
- Invalid/wrong scope does not return unrelated rows.
- `bid-feed-result` logs only after scoped lookup succeeds.
- Log row preserves:
  - `account_id`
  - `customer_id`
  - `source_sheet_id`
- Direct frontend/browser log insert remains impossible.
- Cleanup leaves test feed/log rows at `0/0`.

Remote pre-deploy safety gate:
- Remote schema has account scope columns on both feed/log tables.
- RLS remains fail-closed for unscoped anon actions.
- Remote functions list does not include `bid-feed` / `bid-feed-result` before deploy.
- No pending migrations.
- No `db push`.
- No secret changes.

Deploy gate:
- Deploy only:
  - `bid-feed`
  - `bid-feed-result`
- Do not deploy Voluum functions.
- Do not deploy unrelated functions.
- Do not change Google Ads Script.
- Do not run `db push`.

Remote post-deploy smoke:
- Remote `bid-feed` returns only the scoped Account A row.
- Account B does not leak.
- Missing/invalid scope is rejected or empty.
- `bid-feed-result` writes scoped log correctly.
- Direct anon insert into `bid_action_log` remains rejected.
- Cleanup leaves remote test counts:
  - `bid_action_feed = 0`
  - `bid_action_log = 0`

# GATES

## Gate 0: Preflight

Run:
```powershell
cd H:\DEV\github_sandbox\bidmonitor
git status --short --branch
````

Stop if:

* Unexpected unrelated changes affect target files.
* Worktree state makes safe isolation impossible.

## Gate 1: Static Safety Scan

Check for forbidden paths/flags:

* `dryRun: false`
* `applyEnabled: true`
* service role in frontend
* Google Ads API/OAuth/developer token
* Voluum apply/auto-apply
* unscoped feed queries
* unscoped result logging

Stop if any live mutation path appears.

## Gate 2: Local Validation

Run:

```powershell
npm test
npm run typecheck
npm run build
npm run lint
```

Stop if any command fails, except known unchanged fast-refresh lint warnings.

## Gate 3: Local Edge Function Smoke

Run local Edge Functions with safe local/test env only.

Must prove:

* Account A scope returns Account A only.
* Account B decoy is isolated.
* Missing scope fails closed.
* Result logging is scoped.
* Cleanup completes.

Stop if:

* Any unscoped request returns data.
* Any wrong account row leaks.
* Any log is written without scoped lookup.
* Any cleanup fails.

## Gate 4: Remote Pre-Deploy Safety

Verify remote state read-only:

* schema columns exist
* policies remain expected
* functions not deployed yet
* no pending migrations
* no secret changes

Stop if:

* pending migrations exist
* schema mismatch
* RLS behavior changed unexpectedly
* functions already deployed unexpectedly

## Gate 5: Deploy

Allowed deploy commands only:

```powershell
npx supabase functions deploy bid-feed
npx supabase functions deploy bid-feed-result
```

Forbidden:

```powershell
npx supabase db push
npx supabase secrets set
```

## Gate 6: Remote Post-Deploy Smoke

Run scoped remote smoke and cleanup.

Stop if:

* Account isolation fails.
* Missing scope succeeds.
* Direct anon log insert succeeds.
* Cleanup leaves test rows behind.
* Any live Google Ads/Voluum apply path appears.

# REPORT FORMAT

Use this exact report format:

## Summary

* Task:
* Verdict:
* Current phase:
* Deploy status:

## Files Changed

* `path/to/file`
* `path/to/file`

## Commands Run

| Command             | Result    |
| ------------------- | --------- |
| `npm test`          | pass/fail |
| `npm run typecheck` | pass/fail |
| `npm run build`     | pass/fail |
| `npm run lint`      | pass/fail |

## Smoke Results

* Account A scoped feed:
* Account B isolation:
* Missing scope:
* Result logging:
* Direct anon log insert:
* Cleanup counts:

## Remote Safety

* Pending migrations:
* Function list:
* Schema columns:
* RLS behavior:
* Secrets changed:

## Safety Confirmation

| Check                            | Result |
| -------------------------------- | ------ |
| No `dryRun: false`               | yes/no |
| No `applyEnabled: true`          | yes/no |
| No service role in frontend      | yes/no |
| No Google Ads mutation path      | yes/no |
| No Voluum apply path             | yes/no |
| No `db push`                     | yes/no |
| Only approved functions deployed | yes/no |

## Stop Conditions Hit

* None, or list exact blocker.

## Next Step

* One clear next action only.

```
```
