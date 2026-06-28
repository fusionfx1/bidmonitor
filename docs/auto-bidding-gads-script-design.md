# Auto-Bidding via Google Ads Script — Design Doc

Status: **HISTORICAL / SUPERSEDED FOR v1 APPLY SCOPE.** Current v1 apply scope is locked to `SET_BUDGET`, `PAUSE_CAMPAIGN`, `ENABLE_CAMPAIGN`, and `SET_CAMPAIGN_LABEL` only.

> **2026-06-28 safety lock:** Keyword bid actions, negative-keyword application, bid-strategy targets, device/geo/schedule modifiers, and manual/live apply examples in this document are historical design notes or later-phase ideas. They must not be implemented or wired into the v1 remote-apply feed without a new owner-approved safety gate. Runtime source of truth is `src/lib/proposalQueue.ts`, `src/lib/autoBidFeed.ts`, `supabase/functions/_shared/bidFeedCore.ts`, and Taskmaster #7/#10.
Author: Cascade · Date: 2026-06-26
Related: `docs/auto-bidding-prd.md` (source of truth), `docs/auto-bidding-voluum-design.md` (superseded/historical only)

---

## TL;DR (ไทย)

- **ปัญหาเดิม:** Voluum API สั่งเปลี่ยน bid ไม่ได้ (ไม่มี public endpoint) → เปลี่ยนมาใช้ **Google Ads Script**
- **ทำไม ban-safe:** สคริปต์ถูกสร้างและรัน **ภายในบัญชี Google Ads เอง บนเซิร์ฟเวอร์ Google** (เป็นฟีเจอร์ทางการของ Google) — ไม่มีการ login จากแอปภายนอก ไม่มี OAuth/credential หลุดออกนอก Google **และเป็น pattern เดียวกับสคริปต์ export ที่คุณใช้อยู่แล้ว** (ตัวที่เขียนข้อมูลลง Google Sheet รายชั่วโมง)
- **กลไก v1:** BidMonitor คำนวณ campaign proposal queue → เสิร์ฟเป็น **feed JSON** ผ่าน Supabase Edge Function → Google Ads Script ดึง feed มา **dry-run ก่อนเสมอ** → ส่งผลกลับมา log; ยังไม่มี live mutation ใน v1
- **โหมด v1:** `review_only` เป็นค่าเริ่มต้น และ feed executor จำกัดที่ `dry_run` จนกว่าจะผ่าน approval + audit gate ใหม่
- **ขอบเขต v1:** เฉพาะ campaign actions: `SET_BUDGET`, `PAUSE_CAMPAIGN`, `ENABLE_CAMPAIGN`, `SET_CAMPAIGN_LABEL`
- **เพิ่ม/ปรับงบ (`SET_BUDGET`) เป็น action สำคัญ** สำหรับ campaign-level control — และ **ทำงานได้กับทุก bidding strategy** (งบเป็น property ของ campaign ไม่เกี่ยวกับ Smart Bidding)
- **ข้อจำกัด bid:** keyword bid mutation (`SET_BID`/`setCpc`) อยู่นอก v1 apply scope; ในแคมเปญ Smart Bidding ให้ใช้ **งบ** เป็น lever หลักแทน

---

## 1. Why Google Ads Scripts are ban-safe (the core rationale)

The user's hard constraint: **never log into Google Ads / drive its API from an unfamiliar app** (ban risk). Google Ads Scripts satisfy this by construction:

- A script is authored **inside the Google Ads account** (Tools → Bulk actions → Scripts) and executes **on Google's own servers as the account owner**. It is an **official, first-party Google feature** for automation.
- **No external login, no third-party OAuth, no scraping.** Google credentials never leave Google.
- The account **already runs an in-account script** for the hourly data export to the Google Sheet (evidenced by `google_sync_log` + `script_version` in `src/types/index.ts`). This design **reuses that exact, already-trusted pattern** — just a second script that *writes* bids instead of *reading* stats.
- The only outbound contact is the script calling **our own feed endpoint** via `UrlFetchApp` (a sanctioned capability requiring only the `script.external_request` scope). No Google data or auth is exposed.

> Net: the account-touching surface is Google's own script runtime. BidMonitor never authenticates to Google.

---

## 2. Architecture & Data Flow

```
                 EXISTING (unchanged)
 Google Ads ──[export script, hourly]──▶ Google Sheet ──[public CSV]──▶ BidMonitor (read)
 Voluum API ──[Supabase Edge fns]──────────────────────────────────────▶ BidMonitor (read)

                 V1 APPLY SCOPE
BidMonitor (campaign proposal queue)
        │  dry-run preview only
        ▼
 Supabase: bid_action_feed  ◀── written by app (browser, anon key)
        │
        ▼  GET /functions/v1/bid-feed   (JSON, token-guarded)
 Google Ads Script  "apply-campaign-actions"  [in-account, scheduled only while dry-run]
        │  for each item: verify campaign state/budget → dry-run result
        ▼  POST /functions/v1/bid-feed-result   (results)
 Supabase: bid_action_log   ──▶ BidMonitor UI (audit + status)
```

Two new Edge Functions + one DB table + one Google Ads Script. Decision logic reuses the existing engine.

---

## 3. Components

### 3.1 Decision feed endpoint — `supabase/functions/bid-feed` (GET)
- Returns the current set of actionable decisions as JSON (the **feed contract**, §4).
- **Token-guarded:** requires header `X-Feed-Token` (or `?token=`) matching secret `BID_FEED_TOKEN`. The script holds this token in `PropertiesService`.
- Reads from `bid_action_feed` (rows the app published). Only returns rows with `status='ready'`.

### 3.2 Result callback endpoint — `supabase/functions/bid-feed-result` (POST)
- Receives the script's per-item results; writes immutable rows to `bid_action_log`; flips `bid_action_feed.status` to `applied` / `failed` / `skipped`.
- Same token guard.

### 3.3 The Google Ads Script — `apply-campaign-actions` (in-account, dry-run scheduled)
- One-time paste into the account; scheduled only while the feed remains dry-run.
- Pulls the feed, verifies campaign state with **client-side guardrails + dry-run + optimistic concurrency + labeling**, then reports results. Skeleton in §6.

### 3.4 App publisher — `src/lib/autoBidFeed.ts` / `src/lib/proposalQueue.ts` (browser)
- Maps campaign proposal rows to the v1 feed allowlist and writes dry-run preview rows only when guardrails pass.
- A new page `src/pages/AutoBidFeed.tsx` shows what is queued / applied / failed (reads `bid_action_feed` + `bid_action_log`).

### 3.5 Database (revise the Phase-1 migration)
The v1 migration supports campaign-level dry-run actions. Legacy keyword fields stay nullable and must not make keyword actions feed-eligible in v1.

```sql
CREATE TABLE bid_action_feed (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_level     text NOT NULL DEFAULT 'campaign',
  keyword_key      text,                            -- legacy/null in v1
  campaign_id      text NOT NULL,                   -- always present (targeting)
  ad_group_id      text,                            -- legacy/null in v1
  criterion_id     text,                            -- legacy/null in v1
  campaign_name    text, ad_group_name text, keyword text, match_type text,
  action           text NOT NULL,                   -- SET_BUDGET | PAUSE_CAMPAIGN | ENABLE_CAMPAIGN | SET_CAMPAIGN_LABEL
  expected_current_bid    numeric, target_bid    numeric,  -- legacy/null in v1
  expected_current_budget numeric, target_budget numeric,  -- budget actions (optimistic concurrency)
  budget_is_shared boolean,                          -- flagged when known at publish time
  reason           text,
  mode             text NOT NULL DEFAULT 'dry_run',  -- 'manual' | 'dry_run'
  status           text NOT NULL DEFAULT 'ready',   -- ready|applied|failed|skipped|stale
  created_at       timestamptz DEFAULT now(),
  picked_at        timestamptz, applied_at timestamptz
);

CREATE TABLE bid_action_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id      uuid REFERENCES bid_action_feed(id) ON DELETE SET NULL,
  entity_level text, keyword_key text, campaign_id text,
  action       text,
  old_value    numeric, new_value numeric,          -- budget or campaign-state value, per action
  result       text NOT NULL,  -- dry_run|skipped_budget_changed|skipped_shared_budget|
                               -- skipped_max_changes|skipped_out_of_scope|not_found|error
  message      text,
  script_version text,
  created_at   timestamptz DEFAULT now()
);
```
(RLS mirrors existing tables. Writes from the script go through the Edge Functions using the service role; the browser uses the anon key to publish/read.)

---

## 4. Feed Contract (the critical interface)

`GET /functions/v1/bid-feed` →

```json
{
  "version": 1,
  "generatedAt": "2026-06-26T05:00:00Z",
  "guardrails": {
    "minBudget": 1, "maxBudget": 200, "maxBudgetChangePercent": 30,
    "allowSharedBudget": false,
    "maxChangesPerRun": 50,
    "dryRun": true
  },
  "items": [
    {
      "id": "uuid-1", "entityLevel": "campaign",
      "campaignId": "123", "campaignName": "Brand - TH",
      "action": "SET_BUDGET", "expectedCurrentBudget": 50.0, "targetBudget": 65.0,
      "budgetIsShared": false,
      "reason": "Profitable (true ROI +120%) and budget-limited (budget lost IS 28%); +30%"
    }
  ]
}
```

- **IDs over names.** Campaign targeting uses `campaignId`. Names are for display/audit only.
- `expectedCurrentBudget` enables **optimistic concurrency**: the script skips if the live value drifted (someone/something changed it).
- **`SET_BUDGET` works regardless of bidding strategy** — so it is the primary scaling lever for Smart Bidding campaigns.
- `guardrails` are echoed into the script so limits are enforced **even if** the script's local config drifts.

---

## 5. Action Modes

Use the modes locked in `docs/auto-bidding-prd.md`:

- `disabled` → no recommendations and no feed publishing.
- `review_only` → recommendations only; default mode; publish nothing actionable.
- `dry_run` → publish approved or selected decisions for script simulation only; feed must return `dryRun=true`.
- `manual_apply` → out of v1 launch scope until a separate owner-approved safety gate enables live mutation.

`auto_apply` is explicitly deferred from v1 launch. It must not be exposed as an enabled mode until the owner separately approves a later phase.

The mode governs what enters the feed. The script still enforces guardrails locally and must treat `dryRun=true` as an absolute no-mutation instruction.

---

## 6. The Google Ads Script (skeleton)

Confirmed APIs for v1 dry-run: `AdsApp.campaigns().withIds([campaignId])`, campaign budget reads, label reads/writes in dry-run simulation, `UrlFetchApp.fetch(url, {method, headers, muteHttpExceptions})`, `PropertiesService`, native scheduling.

```javascript
const SCRIPT_VERSION = 'apply-campaign-actions-dry-run-1.0.0';
const FEED_URL    = 'https://<proj>.supabase.co/functions/v1/bid-feed';
const RESULT_URL  = 'https://<proj>.supabase.co/functions/v1/bid-feed-result';
// Token stored once via PropertiesService — never hard-code secrets.
const TOKEN = PropertiesService.getScriptProperties().getProperty('BID_FEED_TOKEN');

function main() {
  const feed = fetchJson(FEED_URL);
  const g = feed.guardrails;
  const results = [];
  let changes = 0;

  for (const item of feed.items) {
    if (changes >= g.maxChangesPerRun) { results.push(res(item, 'skipped_max_changes')); continue; }
    if (!['SET_BUDGET', 'PAUSE_CAMPAIGN', 'ENABLE_CAMPAIGN', 'SET_CAMPAIGN_LABEL'].includes(item.action)) {
      results.push(res(item, 'skipped_out_of_scope')); continue;
    }
    if (item.action === 'SET_BUDGET') { if (previewBudget(item, g, results)) changes++; continue; }
    results.push(res(item, 'dry_run'));
    changes++;
  }
  postJson(RESULT_URL, { scriptVersion: SCRIPT_VERSION, results });
}

function previewBudget(item, g, results) {
  const it = AdsApp.campaigns().withIds([Number(item.campaignId)]).get();
  if (!it.hasNext()) { results.push(res(item, 'not_found')); return false; }
  const budget = it.next().getBudget();
  // Shared budgets affect multiple campaigns — never touch unless explicitly allowed.
  if (budget.isExplicitlyShared() && !g.allowSharedBudget) {
    results.push(res(item, 'skipped_shared_budget')); return false;
  }
  const cur = budget.getAmount();
  if (item.expectedCurrentBudget != null && Math.abs(cur - item.expectedCurrentBudget) > 0.001) {
    results.push(res(item, 'skipped_budget_changed', cur)); return false;
  }
  let target = Math.min(g.maxBudget, Math.max(g.minBudget, item.targetBudget));
  target = Math.min(cur * (1 + g.maxBudgetChangePercent / 100), target); // cap increase per run
  results.push(res(item, 'dry_run', cur, target));
  return true;
}
// fetchJson/postJson use UrlFetchApp with X-Feed-Token header + muteHttpExceptions.
```

Safety properties baked in: **dry-run**, **per-run change cap**, **budget clamp + max step**, **shared-budget skip**, **optimistic concurrency**, **ID-based targeting**, **full result reporting**, and a v1 action allowlist.

---

## 7. Security

- **Feed token** (`BID_FEED_TOKEN`) lives in Supabase secrets and in the script's `PropertiesService` — never hard-coded, never in the browser bundle. Guards both endpoints.
- Google credentials never leave Google (script runs in-account).
- The browser publishes feed rows with the anon key (RLS-limited to `bid_action_feed`); the **script's writes** go via the Edge Function using the service role.
- Every applied/skipped change is logged in `bid_action_log` (immutable audit), tagged with `script_version`.
- **Global off switch:** if the feed endpoint returns `dryRun:true` or an empty `items[]`, the script makes zero changes — a server-side kill switch independent of the script.

---

## 8. One-Time Setup (operator)

1. Create Supabase secret `BID_FEED_TOKEN`; deploy `bid-feed` + `bid-feed-result`.
2. In Google Ads → Scripts, paste `apply-campaign-actions`, set `BID_FEED_TOKEN` via Script Properties, authorize (`script.external_request`).
3. **Preview run** with `dryRun:true`; confirm `bid_action_log` shows intended changes.
4. Schedule hourly only while `dryRun:true`.
5. Do not disable dry-run in v1. Live mutation requires a separate owner-approved safety gate.

---

## 9. Reuse of existing code

- **Campaign proposal queue:** `src/lib/proposalQueue.ts` wraps `buildBudgetOptimization`, enforces freshness/guardrails, and exports only v1 campaign actions.
- **Campaign budget engine:** `buildBudgetOptimization(campaigns, voluum/reconciled, settings)` → campaign-level proposals. Rule: campaign **profitable** (true ROI/profit positive from fresh Voluum) and under-pacing → `SET_BUDGET` within guardrails. Budget increase is independent of bidding strategy, so it applies to Manual *and* Smart Bidding campaigns.
- **Identifiers:** `CampaignRow` carries `campaign_id`, `daily_budget`, and `bidding_strategy_type`. These are the active v1 feed identifiers; keyword IDs are not feed targets in v1.
- **Approval status:** v1 feed rows remain dry-run preview rows and are not live-write approvals.
- **Pattern:** mirrors the existing export Google Ads Script (`script_version`, run logging).

---

## 10. Phases

0. **Phase 0 — Documentation lock:** PRD and design docs agree that Google Ads Script is the only executor, Voluum is tracking/profit only, default mode is `review_only`, and `auto_apply` is deferred.
1. **Phase 1 — Foundations only:** campaign-scoped `bid_action_feed` + `bid_action_log`; add budget guardrail settings; add modes `disabled | review_only | dry_run`; no live writes.
2. **Phase 2 — Feed + UI:** `bid-feed` GET endpoint; `src/lib/autoBidFeed.ts` publisher for dry-run campaign preview rows; `AutoBidFeed.tsx`; sync/run indicators.
3. **Phase 3 — Script dry-run:** `apply-campaign-actions` Google Ads Script with `SET_BUDGET`, `PAUSE_CAMPAIGN`, `ENABLE_CAMPAIGN`, `SET_CAMPAIGN_LABEL`; `dryRun=true`; `bid-feed-result` endpoint; audit UI; no mutation.
4. **Later — Manual apply:** out of v1 launch scope; requires separate owner approval, dry-run evidence, and a new safety gate.
5. **Later — Reconsider auto apply:** out of v1 launch scope; requires separate owner approval and evidence from dry-run/manual operation.

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Campaign budget changed externally between compute and preview | Wrong dry-run result | Optimistic concurrency via `expectedCurrentBudget` → skip |
| Runaway automation | Money loss | default `review_only`, executor stays `dryRun=true`, no live mutation in v1 launch, per-run cap, budget clamp + max step %, server-side empty feed = kill switch, audit log |
| Campaign ID changes / not found | Missed action | ID-based targeting + `not_found` result; re-evaluated next cycle |
| Conversion lag → premature cut | Cutting winners early | Reuse `conversion_delay_hours`, `min_clicks`, payout multiples already in engine |
| **Shared budget** changed → affects other campaigns | Unintended scaling | Script checks `isExplicitlyShared()` → `skipped_shared_budget` unless `allowSharedBudget`; publisher flags `budgetIsShared` |
| **Budget runaway** (compounding increases each run) | Overspend | `maxBudgetChangePercent` per run + `maxBudget` ceiling + total daily budget-delta cap + optimistic concurrency |
| UrlFetchApp quota / 30-min script limit | Partial run | `maxChangesPerRun`, batch by priority (highest cost first), idempotent re-runs |
| Token leak | Unauthorized feed read | Rotate `BID_FEED_TOKEN`; token only grants read of non-secret bid intents |

---

## 12. Open Questions

| # | Question | Resolution |
|---|----------|------------|
| S1 | Confirm the export script's account has Scripts enabled at the right level (single account vs MCC). MCC scripts address accounts differently. | Operator check |
| S2 | Are target campaigns on **Manual/eCPC** (so bids are actionable), or mostly Smart Bidding (then levers are budgets/targets, not keyword CPC)? | Operator check; informs how many decisions are actionable |
| S3 | Confirm Supabase Edge Function as the feed channel. | Locked as the recommended v1 channel; owner confirmation before live mutation |
| S4 | Should `PAUSE`/`ENABLE` also apply at ad-group/campaign level, or keyword-only in v1? | Product decision (keyword-only recommended for v1) |
| S5 | How prevalent are **shared budgets** in the account? If common, the budget engine must target the shared `Budget` deliberately (and the operator must opt in via `allowSharedBudget`). | Operator check |
| S6 | Decrease budget too, or **increase-only** in v1? Budget *increase* is the headline ask; budget *decrease* on losers can also be derived. | Product decision |

---

## 13. Decisions

- **[DECIDED 2026-06-28]** v1 feed-eligible actions are campaign-only: `SET_BUDGET`, `PAUSE_CAMPAIGN`, `ENABLE_CAMPAIGN`, `SET_CAMPAIGN_LABEL`.
- **[DECIDED 2026-06-27]** Voluum role = tracking/profit source only; not the apply executor.
- **[DECIDED 2026-06-27]** Default mode = `review_only`; first executor phase = `dryRun=true`; `auto_apply` deferred from v1 launch.
- **[DECIDED 2026-06-26]** **Budget increase is a primary lever** and works for Smart Bidding campaigns.
- **[PENDING]** S6 (budget increase-only vs also decrease in v1).
- **[PENDING]** Guardrail defaults (maxChangePercent, maxBudgetChangePercent, maxBudget, maxChangesPerRun, initial dryRun period).
- **[PENDING]** Confirm Supabase as the feed channel (S3).
