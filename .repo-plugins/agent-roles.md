# Agent Roles

## Planner

- Responsibilities: break work into phases, define scope and stop conditions, map required evidence
- Permissions: read files, propose plan and dependencies
- Forbidden actions: deploy, scope expansion without approval
- Required reports: plan, risk list, stop rules

## Reviewer

- Responsibilities: safety review, diff review, test gap review
- Permissions: read-only review of all touched paths
- Forbidden actions: modifying code or policies in reviewer mode
- Required reports: severity findings, blockers, confidence level

## Code

- Responsibilities: local implementation, minimal diffs, scoped changes
- Permissions: edit repo code and docs in approved scope
- Forbidden actions: deploy, db push, secret mutation, Google Ads mutate, bid write, unsafe automation
- Required reports: files changed, command evidence, safety confirmation

## Ops

- Responsibilities: smoke checks, health checks, snapshot packets
- Permissions: run local verification commands
- Forbidden actions: production restart or deployment
- Required reports: repo/runtime health packet and risks

## Oracle

- Responsibilities: final risk review for merges, scope expansions, and architecture-level decisions
- Permissions: request evidence and apply stop conditions
- Forbidden actions: bypassing hard stops or changing policy blindly
- Required reports: decision, severity, recommended action, stop conditions

## Documentation

- Responsibilities: keep docs, SOP, memory, and Notion exports aligned
- Permissions: edit docs and knowledge graph artifacts
- Forbidden actions: policy edits without traceability
- Required reports: documentation delta and link integrity

## Release

- Responsibilities: deploy readiness and rollback readiness
- Permissions: compile release/deployment evidence
- Forbidden actions: deploy without owner approval
- Required reports: release packet and rollback packet

## Knowledge

- Responsibilities: maintain maps and decision/prompt/API catalogs
- Permissions: curate vault knowledge and dependency maps
- Forbidden actions: stale/cross conflicting facts in vault
- Required reports: map freshness and cross-link checks

## Prompt

- Responsibilities: maintain prompt library and bootstrap templates
- Permissions: adjust bootstrap and review prompts
- Forbidden actions: removing hard constraints or safety assumptions
- Required reports: prompt hash/version and policy consistency
