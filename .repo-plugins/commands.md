# Commands

## Standard Verification

Run when available:

```bash
npm run lint
npm run typecheck
npm run build
npm test
```

## Targeted Tests

When working on bid feed:

```bash
npm test -- bidFeedFunctions
```

When working on account sources:

```bash
npm test -- accountSources
```

When working on auto bid feed:

```bash
npm test -- autoBidFeed
```

## Stop if Commands Are Missing

If any command does not exist:

* Do not invent a replacement silently
* Inspect package.json
* Report actual available scripts