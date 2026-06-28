# Agent Handoff

Next task:
Implement Harness foundation locally only.

Required work:
- Add sync_runs or sheet_import_runs model/table abstraction
- Add dashboard sync indicator:
  - last_sync_at
  - sync_count_today
  - last_sync_status
  - last_error
  - source_sheet_id
  - customer_id
  - account_id
- Ensure all bid-feed queries require:
  - account_id
  - customer_id
  - source_sheet_id
- Add tests preventing cross-account/source-sheet leakage

Stop conditions:
- deploy required
- db push required
- secret change required
- Google Ads mutate required
- unrelated tests fail
- any data can cross account/customer/source_sheet boundary

Commands:
- npm run lint
- npm run typecheck
- npm run build
- npm test
