# Harness Spec

## Purpose
Harness OS defines a repo-level operating system for building and running controlled, review-first automation around Google Ads Sheet-driven bid/recommendation workflows.

## Core Capabilities
- Scoped account/customer/source_sheet memory and execution model
- Dashboard state sync and import visibility
- Bid feed generation (review-only output)
- Voluum health and dependency checks
- Deterministic test and safety gates
- Reproducible run packet and handoff workflow

## Non-negotiable Operating Modes
- local-first
- read-only by default
- review-only data flow by default
- account/customer/source_sheet scoped every data path

## Runtime Zones
- Frontend: `src/`
- Edge functions: `supabase/functions/`
- Shared config/memory: `.projectmem/`, `project-memory/`, `.repo-plugins/`
- Operations artifacts: `.projectmem/operations/`, `.projectmem/handoffs/`

## Success Metrics
- zero cross-account/feed scope leaks
- deterministic sync visibility per scope
- no write-capable external side effects without owner approval
- complete safety and test evidence before any production action

## Change Policy
1. Preserve existing behavior unless explicitly part of scoped task.
2. Prefer additive and minimal diff.
3. If uncertain, stop and require explicit clarification.