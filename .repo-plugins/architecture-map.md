# Architecture Map

## Repository Layers
1. UI layer: `src/`
2. Logic layer: `src/lib/`, `src/context/`, `src/store/`
3. Edge functions: `supabase/functions/`, `supabase/functions/_shared/`
4. Memory layer: `.projectmem/`, `project-memory/`
5. Operating layer: `.repo-plugins/`, `harness/`

## Key Interfaces
- Frontend settings/sync -> `src/context/AppContext.tsx`
- Feed APIs -> `supabase/functions/bid-feed`, `supabase/functions/bid-feed-result`
- Safety gates -> `.repo-plugins/safety-policy.md`, `.repo-plugins/deploy-policy.md`