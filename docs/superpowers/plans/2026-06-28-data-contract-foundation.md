# Data Contract Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define and verify the read-only Sheet/feed and DB data contract for Taskmaster Task 1.

**Architecture:** Keep the canonical contract as pure TypeScript data plus validator helpers under `src/lib/dataContract`, then adapt existing CSV/header imports to consume it. Keep samples as typed in-repo fixtures so tests can round-trip every declared tab without hitting external services.

**Tech Stack:** TypeScript, Vitest, existing CSV parser, existing Vite build/typecheck.

---

### Task 1: Contract Tests

**Files:**
- Create: `src/lib/dataContract/__tests__/contract.test.ts`
- Create: `src/lib/dataContract/__tests__/fixtures.test.ts`

- [ ] **Step 1: Write failing validator tests**

Create tests that import the desired API from `../contract` and assert:
- canonical sheet/feed tabs include existing Google imports plus PMax, geo, placements, budget pacing, conversion actions, Voluum true-profit, sync_log, audit_log, account_config, and guardrail_config.
- every tab sample row validates required headers and declared scalar types.
- invalid tab names, missing headers, and wrong scalar types fail with structured errors.
- account config defaults to `review_only`.
- guardrail JSON rejects write/mutate-enabled actions.
- contract write capabilities array is empty.

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk npm test -- src/lib/dataContract/__tests__/contract.test.ts src/lib/dataContract/__tests__/fixtures.test.ts`

Expected: fail because `src/lib/dataContract/contract.ts` and fixtures do not exist yet.

### Task 2: Contract Implementation

**Files:**
- Create: `src/lib/dataContract/contract.ts`
- Create: `src/lib/dataContract/samples.ts`
- Create: `src/lib/dataContract/index.ts`
- Modify: `src/lib/googleSheets.ts`
- Modify: `src/lib/csv/validator.ts`

- [ ] **Step 1: Implement minimal contract**

Define typed contract fields, tab specs, validators, account config and guardrail validators, sample row roundtrip helpers, DB import field descriptors, and read-only capability evidence.

- [ ] **Step 2: Wire existing imports**

Generate existing `SHEET_TABS` and `REQUIRED_COLUMNS` from the canonical contract for current `DataTableKey` values while preserving existing parser routing.

- [ ] **Step 3: Run tests to verify green**

Run: `rtk npm test -- src/lib/dataContract/__tests__/contract.test.ts src/lib/dataContract/__tests__/fixtures.test.ts`

Expected: pass.

### Task 3: Documentation And Verification

**Files:**
- Create: `docs/data-contract.md`
- Create: `supabase/migrations/20260628000100_data_contract_foundation_dry_run.sql`

- [ ] **Step 1: Document the contract**

Document stable tab names, primary keys, field names/types, DB import fields, sync/audit logs, config and guardrails, sample fixture location, and read-only stance.

- [ ] **Step 2: Add migration dry-run artifact**

Add a transaction-rolled-back SQL dry-run that declares intended read-only contract tables/views without granting write policies.

- [ ] **Step 3: Run final verification**

Run:
- `rtk npm test -- src/lib/dataContract/__tests__/contract.test.ts src/lib/dataContract/__tests__/fixtures.test.ts`
- `rtk npm run typecheck`
- `rtk npm run lint`
- targeted read-only scan commands for Google Ads mutate/OAuth and contract write capability evidence.
