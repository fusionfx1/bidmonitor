# Database Catalog

## Primary Runtime Stores
- Google Sheets (source of campaign/recommendation raw data)
- Supabase Postgres (query and function state)

## Access Pattern
- Dashboard reads are scoped.
- Write paths are not part of local-first default operations.