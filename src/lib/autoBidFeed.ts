import type {
  BidActionFeedRow,
  BidActionLogRow,
  BidDecision,
  KeywordRow,
  Settings,
} from '../types';
import { getActiveAccountScope, type AccountSourceScope } from './accountSources';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const REST = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1` : '';

const REST_HEADERS = {
  apikey: SUPABASE_ANON_KEY ?? '',
  Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
  'Content-Type': 'application/json',
};

export type BidActionFeedInsert = Omit<BidActionFeedRow, 'id' | 'created_at'>;
type V1CampaignDryRunFeedCandidate = Pick<BidActionFeedRow, 'entity_level' | 'action' | 'mode' | 'status'>;

const V1_FEED_ACTIONS = new Set(['SET_BUDGET', 'PAUSE_CAMPAIGN', 'ENABLE_CAMPAIGN', 'SET_CAMPAIGN_LABEL']);
const V1_FEED_FILTER =
  'status=eq.ready&mode=eq.dry_run&entity_level=eq.campaign&action=in.(SET_BUDGET,PAUSE_CAMPAIGN,ENABLE_CAMPAIGN,SET_CAMPAIGN_LABEL)';

export interface SkippedFeedDecision {
  keyword_key: string;
  action: BidDecision['action'];
  reason: string;
}

export interface BuildDryRunFeedRowsResult {
  rows: BidActionFeedInsert[];
  skipped: SkippedFeedDecision[];
}

export type FeedAccountScope = AccountSourceScope;

function skipped(decision: BidDecision, reason: string): SkippedFeedDecision {
  return { keyword_key: decision.keyword_key, action: decision.action, reason };
}

function accountScope(settings: Settings): { account_id: string; customer_id: string; source_sheet_id: string } | null {
  return getActiveAccountScope(settings);
}

export function feedAccountScope(settings: Settings): FeedAccountScope | null {
  const scope = getActiveAccountScope(settings);
  return scope ? { ...scope } : null;
}

export function buildDryRunFeedRows(
  decisions: BidDecision[],
  _keywords: KeywordRow[],
  settings: Settings
): BuildDryRunFeedRowsResult {
  const rows: BidActionFeedInsert[] = [];
  const skippedRows: SkippedFeedDecision[] = [];
  const guardrails = settings.auto_bid_guardrails;
  const scope = accountScope(settings);

  for (const decision of decisions) {
    if (!scope) {
      skippedRows.push(skipped(decision, 'Account ID, customer ID, and source sheet ID are required.'));
      continue;
    }

    if (settings.action_mode !== 'dry_run') {
      skippedRows.push(skipped(decision, 'Action mode is not dry_run.'));
      continue;
    }

    if (!guardrails.dryRun || guardrails.applyEnabled) {
      skippedRows.push(skipped(decision, 'Dry-run guardrail is closed.'));
      continue;
    }

    if (rows.length >= guardrails.maxChangesPerRun) {
      skippedRows.push(skipped(decision, 'Max changes per run guardrail reached.'));
      continue;
    }

    if (decision.approval_status !== 'APPROVED') {
      skippedRows.push(skipped(decision, 'Decision is not approved.'));
      continue;
    }

    skippedRows.push(skipped(decision, 'Legacy bid decision feed is disabled; use the campaign proposal queue.'));
    continue;
  }

  return { rows, skipped: skippedRows };
}

function requireSupabaseConfig(): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase URL or anon key is not configured.');
  }
}

async function readRest<T>(path: string): Promise<T> {
  requireSupabaseConfig();
  const res = await fetch(`${REST}/${path}`, { headers: REST_HEADERS });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export function scopedFeedQuery(table: 'bid_action_feed' | 'bid_action_log', scope: FeedAccountScope): string {
  const scopeFilter = `account_id=eq.${encodeURIComponent(scope.account_id)}&customer_id=eq.${encodeURIComponent(scope.customer_id)}&source_sheet_id=eq.${encodeURIComponent(scope.source_sheet_id)}`;
  const contractFilter = table === 'bid_action_feed' ? `&${V1_FEED_FILTER}` : '';
  return `${table}?select=*&${scopeFilter}${contractFilter}&order=created_at.desc&limit=200`;
}

export function isV1CampaignDryRunFeedRow(row: V1CampaignDryRunFeedCandidate): boolean {
  return (
    row.status === 'ready' &&
    row.mode === 'dry_run' &&
    row.entity_level === 'campaign' &&
    V1_FEED_ACTIONS.has(row.action)
  );
}

export async function fetchBidActionFeed(scope: FeedAccountScope): Promise<BidActionFeedRow[]> {
  const rows = await readRest<BidActionFeedRow[]>(scopedFeedQuery('bid_action_feed', scope));
  return rows.filter(isV1CampaignDryRunFeedRow);
}

export async function fetchBidActionLog(scope: FeedAccountScope): Promise<BidActionLogRow[]> {
  return readRest<BidActionLogRow[]>(scopedFeedQuery('bid_action_log', scope));
}

export async function publishDryRunFeedRows(rows: BidActionFeedInsert[]): Promise<BidActionFeedRow[]> {
  const unsafe = rows.find((row) => !isV1CampaignDryRunFeedRow(row) || row.picked_at || row.applied_at);
  if (unsafe) throw new Error('Refusing to publish non-v1 dry-run campaign feed rows.');

  if (!rows.length) return [];
  requireSupabaseConfig();

  const res = await fetch(`${REST}/bid_action_feed`, {
    method: 'POST',
    headers: { ...REST_HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<BidActionFeedRow[]>;
}
