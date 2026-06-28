# BitMonitor Course Adaptation Plan

Date: 2026-06-28
Source course files: `ar-01-03.md` through `ar-27-30.md`
Project target: BitMonitor / Google Ads Command Center / Google Ads Script + Apps Script reporting and controlled bidding

## Verdict

The course strongly supports the current BitMonitor direction:

- Keep Google Ads Scripts as the first-party, low-risk execution layer.
- Keep Google Sheets / Apps Script as the bridge layer.
- Use deterministic rules before AI.
- Treat AI as an assistant for script generation, debugging, commentary, and later insight drafting.
- Do not make the dashboard a raw data dump. Convert raw metrics into information, recommended action, and expected business outcome.

The main adjustment is not architectural. The missing layer is operating discipline: data contracts, health logs, dashboard freshness, rule documentation, proposal/audit queues, and clear output views.

## Course Principles To Adopt

| Course idea | BitMonitor interpretation |
|---|---|
| Input -> Process -> Output | Google Ads Script / Voluum / Sheet are input; Supabase and transforms are process; dashboard, alerts, queue, and reports are output. |
| 80/20 reporting | Show top spend, top waste, budget-limited winners, approval queue, and sync health first. Keep deep raw tabs secondary. |
| SCOUT | Define Success, Context, Outline, Upskill, Tune for every automation feature before writing code. |
| Rules before AI | Bid, budget, sync, and alert logic must be deterministic. AI can explain and summarize but must not decide money movement in v1. |
| Small bets | Every new script starts with `LIMIT`, `MAX_ROWS`, preview, dry-run, and sample rows before production scheduling. |
| Raw -> analysis -> action | Sheets and DB should separate raw imported data from computed summaries and feed actions. |
| Document business rules | Thresholds, caps, allowed campaigns, forbidden campaigns, timezone assumptions, and approval rules must be stored in machine-readable config. |
| Data -> Information -> Insight -> Action -> Outcome | Dashboard cards should not only show metrics. They should show what changed, why it matters, next action, and expected business outcome. |
| Dashboard user has no time | First screen should answer: Is data fresh? Is spend safe? Are there winners to scale? Are there losers to cut? Any script/feed errors? |
| Web app unlock | Apps Script exposing Sheet data as JSON is valid for lightweight app/dashboard patterns, but production BitMonitor should keep Supabase as source of truth where possible. |

## Product Adjustments

### P0 - Add Automation Health And Freshness

Add visible sync indicators on the dashboard:

- Last Google Ads Script run time
- Last Apps Script / Sheet refresh time
- Rows fetched per dataset
- Script version
- Success / warning / failed status
- Next expected sync window
- Stale-data warning if current time exceeds expected cadence

Reason: The user already schedules Google Ads Script hourly. If the system cannot prove the latest sync status, the dashboard cannot be trusted.

### P0 - Formalize Sheet / Feed Tab Contract

Standardize tab names and columns:

- `index`: tab map, data freshness, script version, owner notes
- `config`: thresholds, account timezone, allowed campaigns, denied campaigns, mode
- `raw_campaign_daily`
- `raw_adgroup_daily`
- `raw_keyword_daily`
- `raw_search_term_daily`
- `raw_hour_device`
- `raw_policy`
- `analysis_campaign`
- `analysis_keyword`
- `analysis_search_terms`
- `proposal_queue`
- `sync_log`
- `audit_log`

Rules:

- Dates use `YYYY-MM-DD`.
- Costs, bids, budgets, clicks, impressions, conversions, and revenue remain numeric. No currency symbols inside data cells.
- Derived metrics are calculated from core metrics, not averaged from precomputed averages.
- Use stable IDs for action targeting: `campaign_id`, `ad_group_id`, `criterion_id`.
- Every export tab has the same header names every run.

### P0 - Separate Decision Engine From Executor

Keep the architecture strict:

- Decision engine computes `HOLD`, `SET_BID`, `SET_BUDGET`, `PAUSE_CANDIDATE`, `ENABLE`.
- Publisher writes only guardrail-passing actions into `bid_action_feed`.
- Google Ads Script executor remains dumb and safe: fetch feed, re-check current live value, apply or skip, report result.
- Dashboard shows queue and audit. It does not directly touch Google Ads.

This matches the course rule: deterministic automation for repeatable logic; AI only assists where ambiguity or language is needed.

### P0 - Add Rule Documentation As Data

Create a machine-readable rule config for lead-gen accounts:

```json
{
  "account_timezone": "Asia/Bangkok",
  "tracker_timezone": "America/Los_Angeles",
  "mode": "review_only",
  "freshness_minutes": 90,
  "min_clicks_to_decide": 20,
  "min_cost_to_decide": 25,
  "target_cpa": 30,
  "max_bid_change_percent": 10,
  "max_budget_change_percent": 20,
  "max_actions_per_campaign_per_day": 3,
  "allow_shared_budget": false,
  "campaign_allowlist_label": "AUTO_OK",
  "campaign_denylist_label": "NEVER_TOUCH"
}
```

The same config should drive dashboard warnings, proposal generation, and executor guardrails.

### P1 - Add Trend And Pacing Layer

Add computed metrics:

- 7-day moving average
- 28-day moving average
- 7-day vs 28-day crossover
- spend pacing vs monthly budget
- days of budget remaining
- projected month-end spend
- budget lost impression share flag
- winner/loser classification by true profit, CPA, and data sufficiency

Do not overreact to daily noise unless spend, serving, or conversion drops to zero.

### P1 - Add Action-Oriented Dashboard Cards

Top dashboard cards should be:

- `Data Freshness`: latest sync and stale warning
- `Spend Risk`: today spend vs cap and pacing
- `Winners To Scale`: profitable and budget-limited campaigns
- `Losers To Cut`: high spend, low/no conversion, sufficient data
- `Policy / Serving`: disapproval, zero impressions, landing page issue
- `Pending Actions`: approved/ready/failed/skipped

Each card should include:

- Data point
- Meaning
- Recommended action
- Expected business outcome

### P1 - Add Proposal Queue UX

For every proposed action, show:

- entity level: campaign / keyword
- account and campaign
- current value -> proposed value
- reason
- data sufficiency
- risk level
- approval status
- expiry time
- proposal hash
- last live value check
- result after execution

Default remains `review_only`. `manual_apply` and `auto_apply` stay behind explicit owner decision.

### P1 - Add Debug Package Generator

Course debugging advice should become a button/workflow:

`Generate Debug Packet`

Include:

- script version
- execution time
- last logs
- sample 3 rows from affected tab/feed
- full error message
- account timezone
- current config
- expected outcome

This makes it easy to paste into Codex/Claude/Gemini without missing context.

### P2 - AI Insight Layer

Only after deterministic reporting is stable:

- Generate a daily/weekly narrative using context, insight, action format.
- AI may draft commentary, but it must cite the underlying rows/metrics.
- AI output should be reviewable and never directly apply bid/budget actions.

Prompt shape:

```text
Audience: owner/operator with 5 minutes.
Use only the supplied metrics.
Return:
1. Context
2. Insight
3. Recommended action
4. Expected business outcome
5. Risks / checks before action
Do not invent conversions, revenue, or policy status.
```

## Dashboard Reference Spec

Use the attached Morning Uplift / 80-20 Agent screenshots as the primary UX direction. Do not copy the brand, logo, or product wording, but follow the operating model closely.

### Overall Layout

- Use a restrained operator UI: white canvas, dark text, thin borders, compact metric cards, orange primary actions, green success, red/pink danger, amber warning.
- Prefer a persistent left sidebar for the production dashboard because BitMonitor needs many operational pages. A top nav variant is acceptable for a lighter public/demo mode.
- Top bar must always show account selector, current data freshness, refresh action, settings shortcut, and current mode (`review_only`, `manual_apply`, `auto_apply`, `disabled`).
- Every page should show account name, account ID/customer ID, date range, data source freshness, and script version when relevant.
- Avoid large decorative panels. Use dense cards, charts, tables, and action panels.

### Navigation To Implement

| Section | Page | Purpose |
|---|---|---|
| MCC | Dashboard | All-account overview, spend, conversions, CPA, true revenue/profit, projected spend, alert count, sync freshness. |
| MCC | MCC Trends | Cross-account trends and moving averages. |
| MCC | Allocation | Budget allocation across accounts/campaign groups. |
| Account | Trends | Campaign performance, 7/28-day moving averages, channel breakdown, daily table. |
| Account | Diagnostics | Week-over-week changes, causal cards, auto insight, recommended action, AI/debug prompt copy. |
| Account | Keywords | Keywords, search terms, PMax terms, categories, n-grams, duplicates, conflicts, export CSV. |
| Account | Products / Buckets | Performance buckets adapted for lead-gen entities: profitable, costly, flukes, zero-conv, low-data. |
| Account | Treemap | Visual allocation of cost/CPA/profit by campaign/ad group/keyword/search term. |
| Account | Placements | PMax/YouTube/display placement performance and exclusion candidates. |
| Account | Budget | Budget pacing, projected month-end spend, limited/healthy/oversized budgets, recommended budget. |
| Account | Optimization | What-if budget/bid adjustments, conservative/balanced/aggressive presets, projected impact. |
| Account | Profit Curve | Profit vs cost, CPA/ROAS/marginal profit curves, optimal spend zone, current status. |
| Account | Geo | Country/state/city performance and geo expansion/exclusion opportunities. |
| Account | Quick Wins | Immediate audit checklist and prioritized fixes. |
| Account | Insights | Prompt library for analysis tasks, categorized by bidding, search terms, PMax, campaigns, trends, keywords, conversions, geo, creative. |
| System | Settings | Accounts, script versions, update script, Sheet/App Script URLs, data source status, business mode, breakeven CPA, currency, branding, API keys, danger zone. |

### Dashboard / MCC Overview

Reference: MCC Overview screenshot.

Must include:

- Summary cards: total cost, total conversions, true revenue/value, CPA, ROI/ROAS, projected month spend, total alerts.
- Account table: account name, 30-day sparkline, cost, conversions, value, CPA, ROI/ROAS, month projection, alerts, links.
- Fresh/stale status at top right.
- Search/filter accounts.
- Alert badges must drill into Quick Wins / Diagnostics.

BitMonitor-specific additions:

- `Google sync`: last run, rows, version, status.
- `Voluum sync`: last run, revenue freshness, token status.
- `Action mode`: visible and read-only by default.

### Trends

Reference: Campaign Performance Metrics and PMax Channel Analysis screenshots.

Must include:

- Campaign selector and "all campaigns combined" toggle.
- Date presets: 7d, 30d, 90d, 180d.
- Metric cards: impressions, clicks, cost, conversions, revenue/value, CTR, CPA, CVR, ROI/ROAS.
- Main time-series chart with raw line plus moving average toggle.
- Channel/network breakdown when available.
- Daily/summary table with CSV export.

Use this page for operator investigation, not final decisioning.

### Diagnostics

Reference: Week-on-week and Quick Wins screenshots.

Must include:

- Week-over-week or period-over-period comparison cards.
- Driver tree: impression share, impressions, conversion rate, conversions, CPA, spend, revenue/profit.
- "Auto Insight" panel with plain-language explanation.
- "Recommended Action" panel with risk level.
- "AI Analysis / Copy Prompt" panel that packages data for external analysis.
- Quick Wins checklist:
  - Performance drops
  - Geo targeting settings
  - Search partners
  - Display network on search
  - Budget limits
  - Disapproved ads
  - Empty ad groups
  - Landing page / tracking health

Rules:

- If data is insufficient, say "not enough data" instead of inventing insight.
- Always show the data sufficiency rule that caused the warning.

### Keywords, Search Terms, PMax Terms, And N-Grams

Reference: keyword tree and n-gram views.

Must include:

- Tabs: Keywords, Search Terms, PMax Categories, PMax Terms, N-grams.
- Filters: date range, campaign, keyword/search term text, cost threshold, clicks threshold, conversion threshold, CTR/CVR thresholds.
- Views: tree, table, n-gram, treemap.
- Badges: top 10, top 5, wasted spend, low data, conflict.
- Actions stay proposal-only:
  - Add negative candidate
  - Pause candidate
  - Increase/decrease bid candidate
  - Export CSV

Lead-gen adaptation:

- Replace product SKU logic with lead intent groups where possible: brand, competitor, generic, high intent, low intent, location, question terms, irrelevant terms.

### Products / Bucket Matrix Adapted For Lead Gen

Reference: Products & nGrams performance bucket matrix.

For BitMonitor, implement as an entity bucket matrix:

- X axis: CPA/ROI quality threshold.
- Y axis: volume threshold such as cost, clicks, or conversions.
- Buckets:
  - `Profitable`: enough volume and under target CPA / profitable by Voluum.
  - `Costly`: enough spend but over target CPA / negative profit.
  - `Fluke`: conversion exists but low volume or unstable.
  - `Meh`: low volume and weak signal.
  - `Zero Conv`: spend/clicks above threshold with no conversion.
  - `Low Data`: not enough evidence.

Use bucket counts to feed Quick Wins and proposal queue.

### Budget And Optimization

Reference: Budget Pacing and Budget Optimization screenshots.

Budget page must include:

- Month progress percentage.
- Month variance vs configured budget.
- Next 30-day forecast.
- Campaign status: over, on track, under.
- Daily spend chart with historical and forecast lines.
- Campaign budget pacing table:
  - daily budget
  - 30-day daily average
  - month projection
  - next 30-day projection
  - utilization
  - status
  - recommended budget

Optimization page must include:

- Conservative / Balanced / Aggressive / None presets.
- Per-campaign sliders for budget change.
- Projected impact summary.
- Reason for each action.
- No mutation from this page. It can only write proposals while default mode remains `review_only`.

### Profit Curve / ProfitMax

Reference: Profit Curve and ProfitMax Calculator screenshots.

Must include:

- Campaign selector.
- Response model: diminishing, linear, independent.
- Sliders for spend/cost, revenue/conversions, COGS or payout assumptions.
- Profit vs cost chart with optimal zone.
- CPA/ROI/marginal CPA or marginal ROI charts.
- Current status: underspending, optimal, overspending, insufficient data.
- Profit zones table.

Lead-gen adaptation:

- Use payout, true Voluum revenue, target CPA, breakeven CPA, and lead value.
- If COGS is not relevant, show payout/margin assumptions instead.

### Remote Campaign Update

This is a required BitMonitor feature. The dashboard must be able to remotely prepare campaign changes, but it must not directly authenticate to Google Ads or mutate from the browser/backend.

Safe execution model:

1. Dashboard creates a campaign update proposal.
2. User approves it, or automation mode queues it if explicitly enabled.
3. Server writes a token-guarded feed row.
4. In-account Google Ads Script polls the feed.
5. Script re-checks live campaign state.
6. Script applies or skips the update.
7. Script posts result back to `bid_action_log`.

Supported campaign update types:

- `SET_BUDGET`: update daily campaign budget within caps.
- `PAUSE_CAMPAIGN`: pause allowlisted campaign.
- `ENABLE_CAMPAIGN`: enable allowlisted campaign.
- `SET_CAMPAIGN_LABEL`: add/remove operational labels such as `AUTO_OK`, `NEVER_TOUCH`, `BUDGET_LIMITED`, `REVIEW_REQUIRED`.
- `SET_BID_STRATEGY_TARGET`: only if supported by the campaign strategy and explicitly enabled later.
- `SET_AD_SCHEDULE_MODIFIER`: later phase, proposal-first.
- `SET_DEVICE_MODIFIER`: later phase, proposal-first.
- `SET_GEO_EXCLUSION` / `SET_GEO_TARGET`: later phase, proposal-first.

Not allowed in v1:

- Create new campaigns.
- Create ads/assets automatically.
- Add broad keywords automatically.
- Apply Google Ads recommendations automatically.
- Change conversion tracking.
- Touch billing/payment settings.
- Update campaigns without stable `campaign_id`.
- Update shared budgets unless `allow_shared_budget=true`.

Remote update UI requirements:

- Page or panel name: `Campaign Updates` or `Remote Updates`.
- Show proposal queue with action, old value, new value, reason, risk, guardrail result, expiry, approval status, and execution result.
- Show dry-run preview before apply.
- Show per-action rollback data for reversible actions.
- Include `Copy Debug Packet` for failed/skipped updates.
- Include global kill switch state in the header.

Guardrails:

- Default mode remains `review_only`.
- Every remote update must pass server-side guardrails and script-side guardrails.
- Campaign allowlist label required for apply.
- Campaign denylist label always wins.
- Max budget change percent per run.
- Max actions per campaign per day.
- Max total budget delta per day.
- Stale Google/Voluum data fails closed.
- Optimistic concurrency: skip if live budget/status/strategy changed since proposal.

Remote update result states:

- `ready`
- `approved`
- `dry_run`
- `applied`
- `skipped_stale_data`
- `skipped_guardrail`
- `skipped_campaign_changed`
- `skipped_shared_budget`
- `skipped_not_allowlisted`
- `skipped_denylisted`
- `not_found`
- `failed`
- `rolled_back`

Acceptance criteria:

- No Google OAuth/API credentials are added to BitMonitor.
- No Google Ads mutation can happen from the browser.
- A campaign update can be approved in the dashboard and applied by Google Ads Script.
- Every apply/skip/fail writes an immutable audit row.
- Kill switch prevents all remote updates even if feed rows exist.

### Insights Prompt Library

Reference: Google Ads 80/20 AI Insights screenshot.

Implement a searchable prompt library, not a generic chat box.

Prompt cards:

- Smart Bidding Analysis
- Campaign Scaling Readiness
- Ad Copy Improvement
- Negative Keyword Identification
- Keyword Expansion Opportunities
- Campaign Settings Audit
- ROAS / CPA Maximization Strategy
- Budget Optimization Recommendations
- Performance Trend Analysis
- Keyword N-gram Analysis
- Search Term N-gram Analysis
- Conversion Action Performance
- Day & Hour Performance Patterns
- PMax Channel Distribution
- Performance Period Comparison
- Quality Score Improvement Plan
- Geo Performance Analysis
- Landing Page Improvement

Each prompt card must show:

- category tag
- required data source
- what it answers
- "Use Prompt" button
- generated prompt includes account context, date range, metric table, freshness, and safety constraints.

Rules:

- Prompts can analyze and recommend.
- Prompts cannot apply actions.
- Prompt output must be reviewable and cite supplied metrics.

### Settings

Reference: Settings screenshots.

Must include:

- Connected accounts list with account name, customer ID, run schedule, tab count/source count, data updated time, last fetched time, script version, update status.
- Script update panel:
  - current script version
  - latest script version
  - "copy updated script"
  - outdated script warnings per account
- MCC / Google Sheet / Apps Script configuration:
  - master sheet URL
  - deployed web app URL
  - script version
  - data source type
- Per-account controls:
  - business mode: lead gen / ecommerce
  - breakeven CPA
  - currency
  - refresh
  - update script
  - delete / disconnect
- API/key section for optional AI providers only:
  - keys masked
  - validity indicator
  - never required for core reporting
- Preferences:
  - tips on/off
  - beta tester mode
  - dashboard branding/colors if needed
- Danger zone:
  - disable automation
  - rotate feed token
  - disconnect account

Security rule:

- Feed tokens, Voluum secrets, Supabase service role keys, and Google credentials must never be shown in frontend.

### Visual Style Notes

- Use compact 8px-radius cards.
- Primary accent: orange.
- Success: green.
- Warning: amber/orange.
- Danger: red/pink.
- Use low-ink charts with thin grid lines.
- Tables should be dense and sortable.
- Filters should sit directly above the chart/table they affect.
- Do not overload the first viewport with long explanation text.
- Empty states should say why data is missing and what sync/config to check.

### Implementation Priority

1. Settings + script health/version/update flow.
2. MCC dashboard + freshness indicators.
3. Trends + moving averages.
4. Budget pacing.
5. Quick Wins diagnostics.
6. Keywords/search terms/n-grams.
7. Remote campaign update proposal/feed/audit.
8. Optimization/proposal queue.
9. Profit curve.
10. Insights prompt library.
11. Geo/placements and advanced views.

## Updated Phase Plan

### Phase 1 - Reporting Reliability

Done when:

- Hourly Google Ads Script writes `sync_log`.
- Dashboard shows sync count, last run, last success, row counts, script version, stale warning.
- Sheet tabs and DB imports follow the stable contract.
- No write/mutate path is enabled.

### Phase 2 - Information Layer

Done when:

- Raw data is transformed into campaign/keyword/search-term analysis tables.
- Derived metrics use core metrics.
- Moving averages and pacing exist.
- Dashboard first screen shows only high-impact 80/20 cards.

### Phase 3 - Review Queue

Done when:

- Decision engine publishes proposals, not actions.
- Owner can approve/reject.
- Proposal hash, expiry, guardrails, and audit log exist.
- Google Ads Script still runs in dry-run.

### Phase 4 - Controlled Writes

Done when:

- `manual_apply` only applies owner-approved rows.
- Script re-checks live values and skips drifted rows.
- Guardrails exist both server-side and script-side.
- Every applied/skipped/failed action appears in audit log.
- Kill switch works.

### Phase 5 - AI Commentary

Done when:

- AI generates narrative only after metrics are stable.
- Narrative follows context -> insight -> action -> expected outcome.
- Human review remains required.

## Immediate Backlog

| Priority | Task | Acceptance criteria |
|---|---|---|
| P0 | Add `sync_log` schema / tab contract | Every script run writes timestamp, status, row counts, version, duration, error. |
| P0 | Add dashboard freshness indicator | UI shows last sync and stale warning for hourly schedule. |
| P0 | Lock raw tab naming and headers | All imports have stable lowercase single-purpose tab names. |
| P0 | Add `config` / rule defaults | Guardrails are data, not hard-coded UI copy. |
| P0 | Add debug packet workflow | One packet contains logs, script, sample rows, config, expected outcome. |
| P1 | Add moving averages and pacing | 7/28-day trend and budget pacing available in analysis layer. |
| P1 | Add action cards | Dashboard answers winner/loser/risk/action, not just raw stats. |
| P1 | Add proposal queue improvements | Action rows include reason, risk, expiry, approval, result. |
| P2 | Add AI commentary | AI summarizes only from computed metrics and never executes. |

## Multi-Agent Task Split

Use Taskmaster or an equivalent task board as the coordinator. The actual implementation can be done by multiple coding agents, but each agent must own a disjoint slice of the system to avoid conflicts.

### Recommended Control Model

- Taskmaster owns: task list, dependencies, status, acceptance criteria, and blocking decisions.
- Lead Agent owns: architecture, merge/integration, final review, safety gates.
- Worker Agents own: isolated implementation slices.
- Reviewer Agent owns: diff review, tests, token/security scan, and no-write-path verification.

Do not let multiple agents edit the same files at the same time unless one agent is explicitly integrating another agent's output.

### Workstreams

| Agent | Workstream | Owns | Depends on | Output |
|---|---|---|---|---|
| Agent A | Data Contract | Sheet tabs, sync log schema, raw/analysis field contract | none | contract doc, migration/schema notes, sample rows |
| Agent B | Settings & Script Health | Settings page, account list, script version/update status, data source health | Agent A for field names | settings UI/spec/code |
| Agent C | MCC Dashboard | overview cards, account table, freshness badges, alerts | Agent A | dashboard UI/spec/code |
| Agent D | Trends & Diagnostics | moving averages, period comparison, quick wins, debug packet | Agent A | diagnostics/trends UI/spec/code |
| Agent E | Keywords & Search Terms | keyword/search term/PMax/n-gram views, filters, CSV export | Agent A | keyword analysis UI/spec/code |
| Agent F | Budget & Profit | budget pacing, optimization sliders, profit curve, breakeven CPA | Agent A | budget/profit UI/spec/code |
| Agent G | Remote Campaign Updates | proposal queue, feed contract, guardrails, audit states | Agent A, F | remote update UI/spec/code |
| Agent H | Insights Prompt Library | searchable prompt cards and generated prompt templates | Agent A, D | prompt library UI/spec/code |
| Reviewer | Safety & QA | no Google OAuth/API, no exposed secrets, review_only default, tests | all | review report and fixes |

### Taskmaster Task Tree

```text
Epic: BitMonitor Command Center Dashboard

1. Foundation: Data Contract
   1.1 Define Sheet tabs and column contract
   1.2 Define sync_log and audit_log rows
   1.3 Define account config and guardrail JSON
   1.4 Define freshness/stale calculation

2. Settings & Script Health
   2.1 Account cards: customer ID, source status, last fetched, script version
   2.2 Script update panel: current/latest/copy updated script
   2.3 Data source status: Google Sheet, Apps Script URL, Voluum health
   2.4 Safety controls: mode, kill switch, token rotation placeholder

3. MCC Dashboard
   3.1 Summary cards: cost, conv, revenue, CPA, ROI/ROAS, projected spend, alerts
   3.2 Account table with sparkline and alert badges
   3.3 Fresh/stale and sync count indicators
   3.4 Drill links to diagnostics and remote updates

4. Account Trends & Diagnostics
   4.1 Campaign selector and all-campaigns toggle
   4.2 7d/30d/90d/180d trends
   4.3 7/28-day moving average
   4.4 Week-over-week diagnostic tree
   4.5 Quick Wins audit cards
   4.6 Copy debug/AI packet

5. Keywords / Search Terms / PMax / N-Grams
   5.1 Tabs and filters
   5.2 Tree/table/n-gram views
   5.3 Wasted spend and zero-conv summaries
   5.4 Negative keyword proposal candidates
   5.5 CSV export

6. Budget & Profit
   6.1 Budget pacing cards and forecast chart
   6.2 Campaign budget pacing table
   6.3 Optimization sliders and presets
   6.4 Profit curve and breakeven CPA model
   6.5 Voluum true-profit integration points

7. Remote Campaign Updates
   7.1 Proposal queue schema/UI
   7.2 Supported actions: SET_BUDGET, PAUSE_CAMPAIGN, ENABLE_CAMPAIGN, SET_CAMPAIGN_LABEL
   7.3 Guardrail engine: allowlist, denylist, max delta, max actions, stale-data fail closed
   7.4 Feed contract for Google Ads Script
   7.5 Result/audit states and rollback data
   7.6 Dry-run preview and kill switch

8. Insights Prompt Library
   8.1 Prompt card taxonomy
   8.2 Search and category filters
   8.3 Prompt generator with account context, date range, data freshness, safety rules
   8.4 Copy prompt action

9. Safety Review & Release Gates
   9.1 Verify default mode is review_only
   9.2 Verify no Google OAuth/API path
   9.3 Verify no frontend secrets
   9.4 Run lint/typecheck/build/tests
   9.5 Produce final owner report
```

### Dependency Rules

- Agent A must finish first or at least publish field names before UI agents begin final code.
- Agent G must not implement real apply until Settings exposes mode/kill switch and Agent A defines guardrail fields.
- Agent H is independent and can run in parallel after Agent A publishes prompt data inputs.
- Reviewer runs after each major slice, not only at the end.

### Taskmaster Usage

Taskmaster is suitable if used like this:

- Import this task tree as epics/tasks/subtasks.
- Mark dependencies explicitly.
- Put acceptance criteria in every task.
- Assign each task to one agent only.
- Use status values: `todo`, `in_progress`, `blocked`, `review`, `done`.
- Store evidence in each task: changed files, tests run, screenshots, and risks.

Do not use Taskmaster as the only source of truth for safety. Safety gates must still be checked in code review and final verification.

### Suggested Agent Prompts

Agent A:

```text
You own the BitMonitor data contract. Define the Sheet tabs, DB/import fields, sync_log, audit_log, account config, and guardrail JSON needed for the dashboard and remote campaign update system. Do not edit UI. Do not enable writes. Return exact field names, sample rows, and migration notes.
```

Agent B:

```text
You own Settings and script health. Build/spec the Settings page based on the reference dashboard: account cards, script version, update script, data source status, business mode, breakeven CPA, currency, mode, kill switch. Do not expose secrets. Default mode remains review_only.
```

Agent G:

```text
You own Remote Campaign Updates. Implement/spec proposal queue, supported campaign actions, feed contract, guardrails, result states, dry-run preview, audit log, and rollback metadata. You may not add Google OAuth/API. Browser/backend must not mutate Google Ads directly; only in-account Google Ads Script may apply feed items.
```

Reviewer:

```text
Review all BitMonitor dashboard/remote update changes for safety. Findings first. Verify default review_only, no Google OAuth/API, no exposed Voluum/feed/service-role secrets, kill switch present, stale data fails closed, and tests/build pass.
```

## Prompt For Agent

```text
GOAL
Apply the Automated Reporting Course ideas to BitMonitor / Google Ads Command Center without changing production behavior.

SOURCE IDEAS
- Input -> Process -> Output
- SCOUT: Success, Context, Outline, Upskill, Tune
- Rules before AI
- Small bets: LIMIT/MAX_ROWS, preview, dry-run
- Stable raw/analysis/report tab contracts
- Sync logs and dashboard freshness
- Data -> Information -> Insight -> Action -> Expected Business Outcome

CONSTRAINTS
- Do not enable real Google Ads writes.
- Do not add direct Google Ads API/OAuth.
- Keep Google Ads Script as the account-side executor pattern.
- Keep default mode `review_only`.
- Do not expose Voluum or feed tokens in frontend.
- Do not refactor unrelated dashboard features.

TASKS
1. Add or update documentation for the Sheet/feed data contract:
   index, config, raw_*, analysis_*, proposal_queue, sync_log, audit_log.
2. Add implementation plan for dashboard freshness:
   last sync, rows fetched, script version, status, stale warning.
3. Add rule config defaults as data:
   target CPA, min clicks/cost, bid/budget caps, allow/deny labels, timezone.
4. Add proposal queue requirements:
   old->new value, reason, risk, expiry, approval, proposal hash, result.
5. Add debug packet workflow:
   script version, error log, sample rows, config, expected outcome.
6. Keep AI insight as P2 only:
   draft commentary from metrics; no money movement.

GATES
- Static scan: no Google Ads OAuth/API path added.
- Static scan: no token in frontend bundle.
- Unit tests for freshness/stale calculation if code is touched.
- Build/test existing app if repo is available.
- Final report must list changed files and confirm default remains read-only/review-only.
```
