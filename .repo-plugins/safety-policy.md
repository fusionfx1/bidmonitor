# Repo Safety Policy

## Hard Stop Actions

Agents must stop before doing any of the following unless owner explicitly approves:

- Deploy
- Supabase db push
- Supabase function secret changes
- Google Ads write/mutate
- Bid update
- Campaign/ad group/keyword pause
- Budget changes
- Voluum write endpoint calls
- Any production credential change

## Secret Safety

Never expose:
- Voluum client secret
- Supabase service role key
- Google Ads credentials
- API tokens
- OAuth refresh tokens

Frontend must not contain:
- Voluum secrets
- Supabase service role key
- write-capable API keys

## Current Allowed Mode

Allowed:
- Local code changes
- Local tests
- Read-only functions
- Review-only feed generation
- Documentation updates

Blocked:
- Production writes
- Live bid changes
- Secret changes