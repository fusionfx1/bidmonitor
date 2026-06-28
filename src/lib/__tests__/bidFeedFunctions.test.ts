import { describe, expect, it } from 'vitest';
import {
  createBidFeedHandler,
  createBidFeedResultHandler,
  type BidFeedRow,
} from '../../../supabase/functions/_shared/bidFeedCore.ts';

const token = 'test-feed-token';

const readyFeedRow: BidFeedRow = {
  id: '11111111-1111-4111-8111-111111111111',
  account_id: 'acct-1',
  customer_id: '1234567890',
  source_sheet_id: 'sheet-1',
  entity_level: 'campaign',
  keyword_key: null,
  campaign_id: 'campaign-1',
  ad_group_id: null,
  criterion_id: null,
  campaign_name: 'Campaign One',
  ad_group_name: null,
  keyword: null,
  match_type: null,
  action: 'SET_BUDGET',
  expected_current_bid: null,
  target_bid: null,
  expected_current_budget: 100,
  target_budget: 110,
  budget_is_shared: null,
  reason: 'Safe dry-run smoke.',
  mode: 'dry_run',
  status: 'ready',
  created_at: '2026-06-27T00:00:00.000Z',
  picked_at: null,
  applied_at: null,
};

const decoyAccountBFeedRow: BidFeedRow = {
  ...readyFeedRow,
  id: '22222222-2222-4222-8222-222222222222',
  account_id: 'acct-2',
  customer_id: '9876543210',
  source_sheet_id: 'sheet-2',
  campaign_id: 'campaign-2',
  campaign_name: 'Campaign Two',
};

const legacySetBidRow = {
  ...readyFeedRow,
  id: '33333333-3333-4333-8333-333333333333',
  entity_level: 'keyword',
  keyword_key: 'campaign|adgroup|criterion|exact',
  ad_group_id: 'adgroup-1',
  criterion_id: 'criterion-1',
  ad_group_name: 'Ad Group One',
  keyword: 'blue widget',
  match_type: 'EXACT',
  action: 'SET_BID',
  expected_current_bid: 1,
  target_bid: 1.1,
  expected_current_budget: null,
  target_budget: null,
} as unknown as BidFeedRow;

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe('bid-feed Edge Function core', () => {
  it('rejects missing and invalid feed tokens', async () => {
    const handler = createBidFeedHandler({ token, listReadyDryRunFeedRows: async () => [readyFeedRow] });

    expect((await handler(new Request('https://example.test/bid-feed'))).status).toBe(401);
    expect(
      (await handler(new Request('https://example.test/bid-feed', { headers: { 'X-Feed-Token': 'wrong' } }))).status
    ).toBe(403);
  });

  it('requires account, customer, and source sheet scope for valid token feed requests', async () => {
    const handler = createBidFeedHandler({ token, listReadyDryRunFeedRows: async () => [readyFeedRow] });

    const response = await handler(new Request('https://example.test/bid-feed', { headers: { 'X-Feed-Token': token } }));

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ error: 'account_id, customer_id, and source_sheet_id are required.' });
  });

  it('returns forced dry-run guardrails and ready dry-run items for a valid token', async () => {
    const scopes: unknown[] = [];
    const handler = createBidFeedHandler({
      token,
      listReadyDryRunFeedRows: async (scope) => {
        scopes.push(scope);
        return [legacySetBidRow, readyFeedRow];
      },
    });

    const response = await handler(
      new Request(
        'https://example.test/bid-feed?token=test-feed-token&account_id=acct-1&customer_id=1234567890&source_sheet_id=sheet-1'
      )
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(scopes).toEqual([{ account_id: 'acct-1', customer_id: '1234567890', source_sheet_id: 'sheet-1' }]);
    expect(body.guardrails).toMatchObject({ dryRun: true, applyEnabled: false });
    expect(body.items).toEqual([readyFeedRow]);
    expect(JSON.stringify(body)).not.toContain(legacySetBidRow.id);
    expect(JSON.stringify(body)).not.toContain(token);
  });

  it('returns no items when the feed kill switch is closed', async () => {
    const handler = createBidFeedHandler({
      token,
      feedEnabled: false,
      listReadyDryRunFeedRows: async () => [readyFeedRow],
    });

    const response = await handler(
      new Request('https://example.test/bid-feed?account_id=acct-1&customer_id=1234567890&source_sheet_id=sheet-1', {
        headers: { 'X-Feed-Token': token },
      })
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.guardrails).toMatchObject({ dryRun: true, feedEnabled: false });
    expect(body.items).toEqual([]);
  });

  it('returns only rows matching the requested account source scope', async () => {
    const rows = [readyFeedRow, decoyAccountBFeedRow];
    const handler = createBidFeedHandler({
      token,
      listReadyDryRunFeedRows: async (scope) =>
        rows.filter(
          (row) =>
            row.status === 'ready' &&
            row.mode === 'dry_run' &&
            row.account_id === scope.account_id &&
            row.customer_id === scope.customer_id &&
            row.source_sheet_id === scope.source_sheet_id
        ),
    });

    const response = await handler(
      new Request('https://example.test/bid-feed?account_id=acct-1&customer_id=1234567890&source_sheet_id=sheet-1', {
        headers: { 'X-Feed-Token': token },
      })
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.items).toEqual([readyFeedRow]);
    expect(JSON.stringify(body)).not.toContain(decoyAccountBFeedRow.id);
    expect(JSON.stringify(body)).not.toContain(decoyAccountBFeedRow.account_id);
  });
});

describe('bid-feed-result Edge Function core', () => {
  it('writes dry-run result logs for an existing feed row', async () => {
    const logs: unknown[] = [];
    const handler = createBidFeedResultHandler({
      token,
      getFeedRow: async (_feedId, scope) => (scope.source_sheet_id === 'sheet-1' ? readyFeedRow : null),
      insertLog: async (row) => {
        logs.push(row);
      },
    });

    const response = await handler(
      new Request('https://example.test/bid-feed-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Feed-Token': token },
        body: JSON.stringify({
          feed_id: readyFeedRow.id,
          account_id: 'acct-1',
          customer_id: '1234567890',
          source_sheet_id: 'sheet-1',
          result: 'dry_run',
          message: 'Would set budget.',
          script_version: 'p2b-smoke',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(logs).toEqual([
      expect.objectContaining({
        feed_id: readyFeedRow.id,
        entity_level: 'campaign',
        campaign_id: 'campaign-1',
        account_id: 'acct-1',
        customer_id: '1234567890',
        source_sheet_id: 'sheet-1',
        keyword_key: readyFeedRow.keyword_key,
        action: 'SET_BUDGET',
        old_value: 100,
        new_value: 110,
        result: 'dry_run',
        message: 'Would set budget.',
        script_version: 'p2b-smoke',
        mode: 'dry_run',
      }),
    ]);
  });

  it('rejects legacy keyword bid rows before logging results', async () => {
    const logs: unknown[] = [];
    const handler = createBidFeedResultHandler({
      token,
      getFeedRow: async () => legacySetBidRow,
      insertLog: async (row) => {
        logs.push(row);
      },
    });

    const response = await handler(
      new Request('https://example.test/bid-feed-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Feed-Token': token },
        body: JSON.stringify({
          feed_id: legacySetBidRow.id,
          account_id: 'acct-1',
          customer_id: '1234567890',
          source_sheet_id: 'sheet-1',
          result: 'dry_run',
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ error: 'Only v1 campaign dry-run feed rows are accepted.' });
    expect(logs).toEqual([]);
  });

  it('rejects live applied result claims in P2B', async () => {
    const handler = createBidFeedResultHandler({
      token,
      getFeedRow: async () => readyFeedRow,
      insertLog: async () => undefined,
    });

    const response = await handler(
      new Request('https://example.test/bid-feed-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Feed-Token': token },
        body: JSON.stringify({
          feed_id: readyFeedRow.id,
          account_id: 'acct-1',
          customer_id: '1234567890',
          source_sheet_id: 'sheet-1',
          result: 'applied',
          dryRun: true,
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ error: 'Live applied results are not accepted in P2B.' });
  });

  it('rejects result payloads for another account', async () => {
    const handler = createBidFeedResultHandler({
      token,
      getFeedRow: async () => null,
      insertLog: async () => undefined,
    });

    const response = await handler(
      new Request('https://example.test/bid-feed-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Feed-Token': token },
        body: JSON.stringify({
          feed_id: readyFeedRow.id,
          account_id: 'acct-2',
          customer_id: '1234567890',
          source_sheet_id: 'sheet-1',
          result: 'dry_run',
        }),
      })
    );

    expect(response.status).toBe(404);
    expect(await json(response)).toMatchObject({ error: 'Feed row not found for account scope.' });
  });

  it('validates that feed_id exists before logging', async () => {
    const logs: unknown[] = [];
    const handler = createBidFeedResultHandler({
      token,
      getFeedRow: async () => null,
      insertLog: async (row) => {
        logs.push(row);
      },
    });

    const response = await handler(
      new Request('https://example.test/bid-feed-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Feed-Token': token },
        body: JSON.stringify({
          feed_id: readyFeedRow.id,
          account_id: 'acct-1',
          customer_id: '1234567890',
          source_sheet_id: 'sheet-1',
          result: 'dry_run',
        }),
      })
    );

    expect(response.status).toBe(404);
    expect(logs).toEqual([]);
  });

  it('requires result payloads to include source sheet scope', async () => {
    const handler = createBidFeedResultHandler({
      token,
      getFeedRow: async () => readyFeedRow,
      insertLog: async () => undefined,
    });

    const response = await handler(
      new Request('https://example.test/bid-feed-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Feed-Token': token },
        body: JSON.stringify({
          feed_id: readyFeedRow.id,
          account_id: 'acct-1',
          customer_id: '1234567890',
          result: 'dry_run',
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({
      error: 'account_id, customer_id, and source_sheet_id are required.',
    });
  });

  it('logs only the feed row that belongs to the result account source scope', async () => {
    const rows = [readyFeedRow, decoyAccountBFeedRow];
    const logs: unknown[] = [];
    const handler = createBidFeedResultHandler({
      token,
      getFeedRow: async (feedId, scope) =>
        rows.find(
          (row) =>
            row.id === feedId &&
            row.account_id === scope.account_id &&
            row.customer_id === scope.customer_id &&
            row.source_sheet_id === scope.source_sheet_id
        ) ?? null,
      insertLog: async (row) => {
        logs.push(row);
      },
    });

    const response = await handler(
      new Request('https://example.test/bid-feed-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Feed-Token': token },
        body: JSON.stringify({
          feed_id: readyFeedRow.id,
          account_id: 'acct-1',
          customer_id: '1234567890',
          source_sheet_id: 'sheet-1',
          result: 'dry_run',
          message: 'Account A smoke.',
          script_version: 'p2b-local-smoke',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(logs).toEqual([
      expect.objectContaining({
        feed_id: readyFeedRow.id,
        account_id: 'acct-1',
        customer_id: '1234567890',
        source_sheet_id: 'sheet-1',
        result: 'dry_run',
        script_version: 'p2b-local-smoke',
      }),
    ]);
    expect(JSON.stringify(logs)).not.toContain(decoyAccountBFeedRow.id);
    expect(JSON.stringify(logs)).not.toContain(decoyAccountBFeedRow.account_id);
  });
});
