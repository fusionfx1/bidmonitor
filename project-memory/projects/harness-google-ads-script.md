# Harness — Google Ads Script Project

## Purpose
Harness is the control layer for Google Ads Script, Google Sheet Bridge, Dashboard, Supabase Edge Functions, Voluum health, and review-only bid/feed workflows.

## Current Mode
- local-first
- read-only
- review-only
- account-scoped

## Required Scope Fields
- account_id
- customer_id
- source_sheet_id

## Current Phase
P2B local-first/account-scoped refactor is in place locally.

No deploy.
No db push.
No function secret changes.

## Current Priority
1. Harness foundation
2. Sync indicator
3. sync_runs / sheet_import_runs
4. Account/source isolation tests
5. Dashboard status visibility