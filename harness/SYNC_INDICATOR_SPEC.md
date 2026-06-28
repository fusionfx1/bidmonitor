# Sync Indicator Spec

Dashboard must show:

- last_sync_at
- sync_count_today
- last_sync_status
- last_error
- source_sheet_id
- customer_id
- account_id

Recommended statuses:
- never_synced
- running
- success
- warning
- failed
- stale

Google Ads Script expected cadence:
- every 1 hour
