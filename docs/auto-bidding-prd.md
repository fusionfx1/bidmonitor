# PRD - Auto-Bidding v1 (BidMonitor)

Status: **DECISION LOCKED - implementation-ready plan, no live mutation yet**
Owner: TBD
Lock date: 2026-06-27

Companion technical designs:
- `docs/auto-bidding-gads-script-design.md` - active executor design
- `docs/auto-bidding-voluum-design.md` - superseded/historical Voluum apply design

---

## Auto-Bidding v1 Decision Lock

This section is the source of truth for v1.

| Decision | Locked value |
|---|---|
| Execution path | **Google Ads Script** running inside the Google Ads account |
| Voluum role | **Tracking/profit source of truth only** |
| Google Ads stats source | Existing Google Ads export script + Google Sheet |
| BidMonitor role | Decision engine, dashboard, approval queue, feed publisher |
| Feed channel | Supabase Edge Functions (`bid-feed`, `bid-feed-result`) |
| External Google Ads API | **Forbidden for v1** |
| Voluum API apply path | **Superseded / historical only** |
| Daily Google Ads UI login | **Not required** after one-time script setup/authorization |
| Default action mode | `review_only` |
| First executor phase | `dry_run=true` |
| v1 launch mode | No `auto_apply`; manual approval only after dry-run and audit logging are proven |
| Live mutation | Disabled until approval queue, dry-run logs, guardrails, and audit logging pass review |

The product must not mutate Google Ads from BidMonitor backend code. All Google Ads writes, when later approved, must happen inside the in-account Google Ads Script.

---

## TL;DR (ไทย)

- v1 ใช้ **Google Ads Script** เป็น executor เท่านั้น เพราะรันอยู่ในบัญชี Google Ads เองและไม่ต้องให้ BidMonitor login หรือใช้ Google Ads API
- **Voluum เป็นแหล่งข้อมูล profit/tracking เท่านั้น** ไม่ใช่ตัวสั่ง apply bid
- ค่าเริ่มต้นต้องเป็น `review_only` และ Google Ads Script phase แรกต้องเป็น `dry_run=true`
- ยังไม่เปิด `auto_apply` ใน v1 launch
- การเปลี่ยน bid/budget จริงจะเปิดได้หลังจากมี approval queue, dry-run result, guardrails และ audit log ครบแล้วเท่านั้น

---

## 1. Background

BidMonitor currently reconciles Google Ads performance from the existing Google Sheet export with live Voluum revenue/profit data, then produces bid recommendations. Those recommendations are currently review/export oriented.

The product direction is to make approved bid, pause, enable, and budget actions executable without daily Google Ads UI login and without using the external Google Ads API. The safe execution path is an in-account Google Ads Script scheduled by Google.

Voluum remains critical, but only as the tracking and profit source of truth. The earlier Voluum API apply path is archived because the public Voluum API does not reliably expose Automizer rule or direct apply endpoints.

---

## 2. Goals

- **G1** Produce a safe, auditable path from BidMonitor decisions to Google Ads Script feed items.
- **G2** Keep default operation read/review-only until the operator explicitly approves later phases.
- **G3** Support keyword-level and campaign-level entities:
  - `keyword`
  - `campaign`
- **G4** Support v1 action types:
  - `SET_BID`
  - `PAUSE`
  - `ENABLE`
  - `SET_BUDGET`
- **G5** Base decisions on reconciled Voluum profit where available, with Google Ads stats from the existing Google Sheet pipeline.
- **G6** Record every intended, skipped, failed, dry-run, and applied action in an audit log before live writes are allowed.

---

## 3. Non-Goals / Forbidden Paths

- No external Google Ads API integration.
- No browser automation or Google Ads UI scraping.
- No login/session/cookie reuse.
- No `auto_apply` in v1 launch.
- No auto-created campaigns.
- No auto-created ads.
- No automatic bid strategy changes.
- No automatic budget increase without explicit approval.
- No Voluum or feed secrets in frontend code.
- No Google Ads mutation from backend code.
- No Voluum API executor.

---

## 4. Architecture

```
Voluum
  = tracking/profit source of truth only

Google Sheet / existing Google Ads export script
  = Google Ads stats source

BidMonitor
  = decision engine + dashboard + approval queue

Supabase Edge Functions
  = feed endpoint + result callback

Google Ads Script
  = in-account executor, scheduled by Google

External Google Ads API
  = forbidden for v1

Voluum API apply path
  = superseded / historical only
```

Daily flow:

1. Existing Google Ads export script writes stats to Google Sheet.
2. BidMonitor reads Google Ads stats and Voluum profit/tracking data.
3. BidMonitor computes proposed actions and shows them in review queue.
4. Approved/dry-run decisions are published to `bid_action_feed`.
5. Google Ads Script pulls the feed from Supabase.
6. While `dryRun=true`, the script reports intended actions only.
7. Later, after approval, the script may apply approved rows and report results.
8. BidMonitor records all script results in `bid_action_log`.

---

## 5. Safety Defaults

| Setting | Required v1 default |
|---|---|
| `action_mode` | `review_only` |
| `dryRun` | `true` for first executor phase |
| `auto_apply` | Deferred; not available in v1 launch |
| `manual_apply` | Allowed only after dry-run and approval queue are working |
| Global kill switch | On / fail-closed until explicitly enabled |
| Live mutation | Disabled until approval and audit review pass |

Guardrail settings:

- `minBid`
- `maxBid`
- `maxChangePercent`
- `minBudget`
- `maxBudget`
- `maxBudgetChangePercent`
- `allowSharedBudget`
- `maxChangesPerRun`
- `dryRun`
- global kill switch

Action modes:

- `disabled`
- `review_only`
- `dry_run`
- `manual_apply`

`auto_apply` is explicitly deferred. It can be reconsidered only after v1 proves dry-run, manual approval, and audit logging.

---

## 6. Functional Requirements

### 6.1 Foundations

- **FR1 (P0)** Create `bid_action_feed`.
- **FR2 (P0)** Create `bid_action_log`.
- **FR3 (P0)** Store entity level on each feed/log row: `keyword` or `campaign`.
- **FR4 (P0)** Store action on each feed/log row: `SET_BID`, `PAUSE`, `ENABLE`, `SET_BUDGET`.
- **FR5 (P0)** Store IDs, not only names:
  - `campaignId`
  - `adGroupId`
  - `criterionId`
- **FR6 (P0)** Store expected current values for optimistic concurrency:
  - `expectedCurrentBid`
  - `expectedCurrentBudget`
- **FR7 (P0)** Store old value, new value, result, message, script version, and timestamp in `bid_action_log`.

### 6.2 Feed and Queue

- **FR8 (P1)** Build feed publisher from approved/dry-run decisions.
- **FR9 (P1)** Build `AutoBidFeed` / `AutoBidQueue` page.
- **FR10 (P1)** Show statuses:
  - ready
  - applied
  - failed
  - skipped
  - stale
- **FR11 (P1)** Show reason, old value, new value, risk level, mode, timestamp, and script result.
- **FR12 (P1)** Show sync/run indicators:
  - last sync time
  - sync count today
  - last script result
  - last error
  - dry-run status

### 6.3 Google Ads Script Executor

- **FR13 (P2)** Create Google Ads Script executor, defaulted to `dryRun=true`.
- **FR14 (P2)** Script pulls feed from Supabase Edge Function.
- **FR15 (P2)** Script does not mutate when `dryRun=true`.
- **FR16 (P2)** Script reports all intended actions to `bid_action_log`.
- **FR17 (P2)** Script enforces local guardrails even if feed data is wrong.
- **FR18 (P2)** Script skips Smart Bidding campaigns for `SET_BID`.
- **FR19 (P2)** Script skips shared budgets unless `allowSharedBudget=true`.
- **FR20 (P2)** Script uses optimistic concurrency for bids and budgets.
- **FR21 (P2)** Script uses IDs, not names, for target lookup.

### 6.4 Manual Apply

- **FR22 (P2, gated)** Enable `manual_apply` only after dry-run has been tested.
- **FR23 (P2, gated)** Only approved rows can be applied.
- **FR24 (P2, gated)** Every applied action must log:
  - `feed_id`
  - `entity_level`
  - `action`
  - `old_value`
  - `new_value`
  - `result`
  - `message`
  - `script_version`
  - `created_at`

---

## 7. Implementation Checklist

### P0 - Documentation Lock / No Live Writes

- [ ] Rewrite PRD around Google Ads Script execution only.
- [ ] Add the Auto-Bidding v1 Decision Lock section.
- [ ] Mark Voluum apply design as superseded.
- [ ] Confirm `action_mode` default remains `review_only`.
- [ ] Confirm no live Google Ads mutation path exists in backend code.
- [ ] Confirm no Voluum/feed secrets appear in frontend code.
- [ ] Confirm next engineering step is foundations, not executor live writes.

### P1 - Foundations

- [ ] Add or revise `bid_action_feed`.
- [ ] Add or revise `bid_action_log`.
- [ ] Add entity levels: `keyword`, `campaign`.
- [ ] Add actions: `SET_BID`, `PAUSE`, `ENABLE`, `SET_BUDGET`.
- [ ] Add guardrail settings listed in this PRD.
- [ ] Add modes: `disabled`, `review_only`, `dry_run`, `manual_apply`.
- [ ] Keep `auto_apply` unavailable.
- [ ] Add tests for default mode, feed row validation, guardrail clamping, and approval gating.

### P2 - Feed, UI, and Dry-Run Script

- [ ] Build feed publisher for approved/dry-run decisions.
- [ ] Build `AutoBidFeed` / `AutoBidQueue` page.
- [ ] Add sync/run indicators.
- [ ] Implement `bid-feed` Edge Function.
- [ ] Implement `bid-feed-result` Edge Function.
- [ ] Create Google Ads Script executor in `dryRun=true`.
- [ ] Verify script writes dry-run results to `bid_action_log`.
- [ ] Review dry-run output for at least the agreed dry-run period before live mutation.

### P3 - Manual Apply Only

- [ ] Enable `manual_apply` after dry-run review passes.
- [ ] Require approved feed rows.
- [ ] Keep global kill switch available.
- [ ] Keep `auto_apply` deferred.
- [ ] Verify every live write has an audit log row.

---

## 8. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Smart Bidding `SET_BID` no-op | Script appears to apply a bid but Google ignores it | Detect bidding strategy; skip and log `skipped_smart_bidding` |
| Shared budget blast radius | One budget change affects multiple campaigns | Default `allowSharedBudget=false`; skip and log shared budgets |
| Conversion lag | Prematurely cuts or scales campaigns on incomplete data | Respect conversion delay, minimum clicks/cost, and Voluum freshness |
| Stale Voluum data | Decisions use outdated profit/revenue | Show data freshness; block feed publish when source data is stale |
| Runaway budget changes | Overspend | `maxBudget`, `maxBudgetChangePercent`, `maxChangesPerRun`, kill switch |
| Token leak | Unauthorized feed access or result spoofing | Keep feed token in Supabase secrets and Script Properties only; rotate on suspicion |
| Script timeout | Partial execution | `maxChangesPerRun`, idempotent feed statuses, retry next run |
| Duplicate writes | Same action applied more than once | Feed status transitions, optimistic concurrency, idempotent result callback |

---

## 9. Questions Before Live Mutation

These questions do not block P0/P1 documentation and foundations. They block live mutation.

1. Are most campaigns Manual/eCPC or Smart Bidding?
2. Are shared budgets used?
3. Should v1 support budget increase only, or both increase and decrease?
4. Confirm Supabase Edge Function as the feed channel.
5. Confirm initial dry-run period; recommended minimum is 1-2 weeks.
6. Confirm guardrail defaults.

---

## 10. Acceptance Criteria

- No contradiction remains between this PRD and the Google Ads Script design.
- Google Ads Script is the only executor.
- Voluum API apply path is clearly archived.
- `action_mode` default is `review_only`.
- `dryRun=true` is required before any live mutation.
- `auto_apply` is explicitly deferred.
- The next engineering step is unambiguous: foundations first, no live writes.

---

## 11. Operator Summary (ไทย)

สรุปสำหรับ owner: v1 จะไม่ให้ BidMonitor หรือ backend ยิง Google Ads API และจะไม่ใช้ Voluum เป็นตัว apply bid แล้ว เส้นทางที่ล็อกคือ Google Ads Script ที่รันในบัญชี Google Ads เอง โดย BidMonitor ส่ง feed ผ่าน Supabase และเริ่มจาก `review_only` + `dryRun=true` เท่านั้น งานถัดไปคือสร้างตาราง feed/log, approval queue, guardrails และ dry-run reporting ก่อน ยังไม่เปิด auto apply และยังไม่เปลี่ยน bid/budget จริงจนกว่าจะตรวจ audit log ผ่าน

## 12. Lead/Vendor Summary (English)

Auto-Bidding v1 is locked to an in-account Google Ads Script executor. Voluum remains the tracking and profit source only. BidMonitor will publish approved or dry-run actions to a Supabase feed, and the Google Ads Script will pull that feed, enforce local guardrails, and report results back to an immutable audit log. Default mode is `review_only`; the first executor phase is `dryRun=true`; `auto_apply` is deferred from v1 launch. No external Google Ads API, browser automation, backend mutation, or Voluum API apply path is allowed.
