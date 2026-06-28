# Repo Map

## Known Areas

### Frontend
Likely paths:
- src/
- src/pages/
- src/components/
- src/context/
- src/lib/

Responsibilities:
- Dashboard
- Settings
- Import data
- Sync indicator
- Bid Feed UI
- Review queue

### Supabase Edge Functions
Likely paths:
- supabase/functions/
- supabase/functions/_shared/
- supabase/functions/bid-feed/
- supabase/functions/bid-feed-result/

Responsibilities:
- Scoped bid feed API
- Review-only result API
- Voluum API proxy
- Health endpoints

### Tests
Likely paths:
- src/lib/__tests__/
- tests/
- __tests__/

Responsibilities:
- Account/source isolation tests
- Bid feed behavior
- Sync state logic
- Safety defaults

### Harness Docs
Paths:
- harness/
- .projectmem/
- .repo-plugins/

Responsibilities:
- Memory
- Specs
- Safety
- Agent operating rules

## Required Scoping Rule

Any data path related to Ads, Sheets, Feed, Voluum, Sync, or Recommendations must preserve:

- account_id
- customer_id
- source_sheet_id
