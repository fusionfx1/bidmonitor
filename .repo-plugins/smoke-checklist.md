# Smoke Checklist

## Local Smoke
- App starts locally
- Dashboard loads
- Settings loads
- Import Data loads
- Bid Feed loads
- Sync indicator renders
- No frontend secret exposure
- No write mode visible by default

## API Smoke
- bid-feed rejects missing scope
- bid-feed accepts valid account/customer/source_sheet scope
- bid-feed-result rejects cross-account scope
- Voluum health returns safe fields only

## Production Smoke Gate
Only after owner approval:
- root URL HTTP 200
- dashboard HTTP 200
- Supabase functions health OK
- Google Sheet CSV reachable if expected
- Voluum health connected or credentialsMissing explicitly shown
- No Google Ads write/mutate path executed
