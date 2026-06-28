# Health Specification

## Health Dimensions
- `sync`: sheet import and bid feed sync freshness by scope
- `api`: response code/shape consistency and scope guards
- `runtime`: app startup + route availability
- `repo`: script/test/lint status and unresolved diffs
- `memory`: memory packet freshness and integrity

## Health Outputs
- `green`: in-bound baseline and no active blocks
- `yellow`: warning with non-fatal gaps
- `red`: one or more hard blocks or secret exposure risk

## Data Rules
- health checks never include secrets
- health snapshots stored in `.projectmem/snapshots/`