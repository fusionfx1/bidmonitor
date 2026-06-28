# Auto-Bidding via Voluum - Superseded Design

Status: **SUPERSEDED / HISTORICAL ONLY**
Decision date: 2026-06-27
Active design: `docs/auto-bidding-gads-script-design.md`
Decision lock: `docs/auto-bidding-prd.md`

> **Superseded. Voluum is tracking/profit source only. Not the apply executor.**

---

## Why This Path Was Rejected

The original Voluum apply design assumed BidMonitor could use Voluum as the executor for Google Ads bid, pause, enable, or budget actions.

That path is not reliable for v1 because:

- Voluum public API does not reliably expose Automizer rule/apply endpoints.
- Access-key sessions are privilege-limited.
- Automizer rule management is documented primarily as a UI workflow.
- Google Ads integration documentation emphasizes cost import and conversion postback, not dependable public API bid execution.
- Voluum action granularity does not cleanly match BidMonitor's keyword-level decision engine.

Therefore, this document must not be used as an implementation plan.

---

## Locked Replacement

Auto-Bidding v1 uses this architecture:

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

The replacement design keeps the original ban-safety goal without requiring BidMonitor to log into Google Ads or call the external Google Ads API.

---

## What Still Applies

The following observations from the Voluum investigation remain useful:

- Voluum data is still the best profit/revenue source for decisioning.
- Voluum credentials must remain server-side only.
- Voluum freshness matters; stale data can produce unsafe bid decisions.
- Any money-moving automation needs guardrails, kill switch behavior, dry-run output, and immutable audit logging.

Everything about Voluum applying actions, creating Automizer rules, syncing Automizer rules, or acting as the Google Ads executor is superseded.

---

## Explicitly Not in Scope

- No `voluum-apply` Edge Function.
- No Voluum API direct apply path.
- No Voluum Automizer rule creation/sync path for v1.
- No campaign mutation through Voluum.
- No use of Voluum as a substitute executor for Google Ads Script.

---

## Historical Note

This file is kept only to preserve the decision trail. Future engineering work must start from:

1. `docs/auto-bidding-prd.md`
2. `docs/auto-bidding-gads-script-design.md`
