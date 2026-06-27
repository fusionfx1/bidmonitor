# BidMonitor

**Read-only Google Ads + Voluum analytics dashboard.** Imports campaign data from Google Sheets and pulls live performance data from the Voluum API. No bid mutations, no pauses — recommendations only.

[![Live](https://img.shields.io/badge/live-ads.fusions.dev-blue)](https://ads.fusions.dev/)
[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-ydfhgemt)

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React + TypeScript + Tailwind CSS |
| Backend | Supabase (Postgres + Edge Functions) |
| Data in | Google Sheets CSV export (campaigns, keywords, search terms, auction data) |
| Data live | Voluum API via Edge Functions (no credentials exposed to browser) |

---

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in env vars
cp .env.example .env
# Edit VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Start dev server
npm run dev
```

---

## Build & Deploy

```bash
# Type-check
npm run typecheck

# Lint
npm run lint

# Production build (output → dist/)
npm run build

# Run tests
npm run test
```

### Deploy to Netlify / Cloudflare Pages / Vercel

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 20+ |

The `dist/_redirects` file handles SPA routing for Netlify automatically.

For Vercel, add a `vercel.json`:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

---

## Supabase Edge Functions

### Deploy all functions

```bash
# Using Supabase MCP (recommended in Bolt)
# Deploy each function via the MCP deploy_edge_function tool

# Using Supabase CLI
supabase functions deploy voluum-report
supabase functions deploy voluum-campaigns
supabase functions deploy voluum-health
supabase functions deploy voluum-recommendations
```

### Set Voluum secrets

```bash
supabase secrets set \
  VOLUUM_ACCESS_ID=your_access_id \
  VOLUUM_ACCESS_KEY=your_access_key \
  VOLUUM_API_BASE=https://api.voluum.com \
  VOLUUM_TIMEZONE=Asia/Bangkok \
  VOLUUM_CACHE_TTL_SECONDS=300
```

Or via **Supabase Dashboard → Edge Functions → Secrets**.

| Secret | Required | Description |
|--------|----------|-------------|
| `VOLUUM_ACCESS_ID` | Yes | Voluum API access ID |
| `VOLUUM_ACCESS_KEY` | Yes | Voluum API access key |
| `VOLUUM_API_BASE` | No | Default: `https://api.voluum.com` |
| `VOLUUM_TIMEZONE` | No | Default: `Asia/Bangkok` |
| `VOLUUM_CACHE_TTL_SECONDS` | No | Response cache TTL. Default: `300` |

---

## Google Sheet Setup

The sheet must be **shared as "Anyone with the link can view".**

Create one sheet with the following tab names exactly as shown:

| Tab Name | Content | Required |
|----------|---------|----------|
| `google_campaigns` | Campaign performance report | Yes |
| `google_adgroups` | Ad group performance report | Yes |
| `google_keywords` | Keywords performance report | Yes |
| `google_search_terms` | Search terms report | Yes |
| `google_hour_device` | Hour of day + device segment report | Yes |
| `google_ads_policy` | Policy issues / disapproval report | Yes |
| `google_auction_proxy_campaigns` | Auction insights — campaign level | Yes |
| `google_auction_proxy_keywords` | Auction insights — keyword level | Yes |
| `voluum_performance` | Voluum performance export (optional) | No |

Export each report from Google Ads as CSV and paste into the corresponding tab, or use a Google Ads Script to auto-populate.

---

## Safety Mode

This dashboard is **read-only by design**:

- No Google Ads API write calls are made.
- No bid is changed, paused, or deleted automatically.
- Bid decisions are generated as a **review queue** — they require manual export and upload.
- The `action_mode` setting defaults to `review_only`.

This is enforced at the architecture level: no mutation endpoints exist.

---

## Connection Diagnostics

Navigate to **Diagnostics** (`#/diagnostics`) to see:

- Voluum API health (connected / credentials missing / error)
- Google Sheet sync status (per tab: synced / missing / inaccessible)
- Last sync timestamp
- Whether the app is running in demo (no credentials) or live mode

---

## Project Structure

```
src/
  pages/          # One file per route
  components/     # Shared UI (Layout, Sidebar, DataTable, KPICard)
  lib/
    csv/          # CSV parsers and validators
    decisionEngine/  # Bid decision, negative candidate, policy logic
    metrics/      # Pure calculation functions
    reconciliation/  # Cross-platform matching engine
    voluum/       # Voluum API client + normalizer
    googleAds/    # Campaign mapping CRUD (Supabase)
  context/        # AppContext (data + settings + sync state)
  store/          # localStorage persistence
  types/          # Shared TypeScript types
supabase/
  functions/      # Deno Edge Functions (Voluum proxy)
  migrations/     # Supabase DB migrations
```
