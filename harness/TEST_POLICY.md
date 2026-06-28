# Test Policy

## Required Before Completion
- npm run lint
- npm run typecheck
- npm run build
- npm test

## Regression Policy
- Keep scoped negative tests for unscoped and cross-scope calls.
- Add targeted tests when behavior changes.
- No unverified assumptions about feed scope.

## Acceptance Criteria
- All hard-stop policies present in policy files.
- Scope rules reflected in APIs and memory packets.
- No frontend secret exposure.

## Evidence Format
- `command | status`
- `artifact or path | result`
- `date | actor`