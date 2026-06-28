# Safety Gate

## Hard Blocks (Absolute)
- No deploy
- No db push
- No function secret changes
- No production restart
- No Google Ads mutate
- No bid write
- No campaign/ad group/keyword pause
- No frontend secret exposure
- No unsafe automation
- Cross-account data path in feeds/sync/import

## Mandatory Owner Approval
- Deploy
- Secret mutation
- Any production write side effect
- Any scope expansion beyond approved task

## Runtime Enforcement
- All mutable actions require explicit approvals and hard proof packet.
- Observability events must include scope and safety check pass state.