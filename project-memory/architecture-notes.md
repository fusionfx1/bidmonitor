# Architecture Notes

## Layers
- UI layer (`src/`): rendering, routes, context, and state
- Data layer (`supabase/functions/`): scoped APIs + health checks
- Memory layer (`.projectmem/`, `project-memory/`, `.repo-plugins/`): policies, logs, reports
- Governance (`harness/`): OS-level specs and safety gates

## Constraints
- No production write actions by default
- Scope by account/customer/source sheet in all sensitive paths
- Obsidian-vault-first documentation for repeatability