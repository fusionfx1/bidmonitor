import type { BidDecision, Settings } from '../types';
import type { BudgetProposal } from './budgetOptimization';
import { getActiveAccountScope } from './accountSources';

export interface QueueActionResponse {
  ok: boolean;
  data?: { tab?: string; row?: number; action_id?: string; status?: string };
  error?: string;
  status_hint?: number;
}

export type QueueTab = 'budget' | 'bid';

export interface QueueRowPackage {
  tab: QueueTab;
  row: Record<string, unknown>;
  json: string;
}

export function canQueueScriptAction(settings: Settings): boolean {
  return Boolean(
    settings.bridge_endpoint_url?.trim()
    && settings.bridge_token?.trim()
    && (settings.action_mode === 'dry_run' || settings.action_mode === 'manual_apply')
  );
}

export function actionQueueBlockedReason(settings: Settings): string | null {
  if (!settings.bridge_endpoint_url?.trim()) return 'Apps Script Bridge URL is missing.';
  if (!settings.bridge_token?.trim()) return 'Bridge token is missing.';
  if (settings.action_mode !== 'dry_run' && settings.action_mode !== 'manual_apply') {
    return `Account mode is ${settings.action_mode}; choose Dry run via script or Manual apply via script.`;
  }
  return null;
}

function scopeOrThrow(settings: Settings) {
  const scope = getActiveAccountScope(settings);
  if (!scope) throw new Error('Active account scope is missing. Sync a generated Sheet first.');
  return scope;
}

function approver(settings: Settings): string {
  return settings.action_approved_by?.trim() || 'dashboard-owner';
}

function packageRow(tab: QueueTab, row: Record<string, unknown>): QueueRowPackage {
  return { tab, row, json: JSON.stringify({ tab, row }, null, 2) };
}

export function buildBudgetActionPackage(proposal: BudgetProposal, settings: Settings): QueueRowPackage {
  const scope = scopeOrThrow(settings);
  const now = new Date().toISOString();
  return packageRow('budget', {
    action_id: `budget:${scope.customer_id}:${proposal.campaignId}:${Date.now()}`,
    created_at: now,
    account_id: scope.account_id,
    customer_id: scope.customer_id,
    campaign_id: proposal.campaignId,
    campaign_name: proposal.campaignName,
    action_type: 'SET_BUDGET',
    expected_current_budget: proposal.currentBudget,
    target_budget: proposal.proposedBudget,
    max_change_pct: settings.auto_bid_guardrails.maxBudgetChangePercent,
    currency: settings.currency,
    reason: proposal.reason,
    evidence: 'Budget Optimization / local dashboard approval',
    approval_status: 'APPROVED',
    approved_by: approver(settings),
    approved_at: now,
    status: 'APPROVED',
  });
}

function parseKeywordKey(keywordKey: string): { campaignId: string; adGroupId: string; criterionId: string } {
  const parts = keywordKey.split(':').map((part) => part.trim());
  return { campaignId: parts[0] || '', adGroupId: parts[1] || '', criterionId: parts[2] || '' };
}

export function buildKeywordBidActionPackage(decision: BidDecision, settings: Settings): QueueRowPackage {
  if (decision.action !== 'INCREASE_BID' && decision.action !== 'DECREASE_BID') {
    throw new Error(`Only INCREASE_BID and DECREASE_BID can be queued. Received ${decision.action}.`);
  }
  if (!decision.recommended_bid || decision.recommended_bid <= 0) throw new Error('Recommended bid is missing.');

  const scope = scopeOrThrow(settings);
  const ids = parseKeywordKey(decision.keyword_key);
  if (!ids.adGroupId || !ids.criterionId) throw new Error(`Cannot parse ad_group_id and criterion_id from keyword_key: ${decision.keyword_key}`);

  const now = new Date().toISOString();
  return packageRow('bid', {
    action_id: `bid:${scope.customer_id}:${ids.adGroupId}:${ids.criterionId}:${Date.now()}`,
    created_at: now,
    account_id: scope.account_id,
    customer_id: scope.customer_id,
    campaign_id: ids.campaignId,
    ad_group_id: ids.adGroupId,
    criterion_id: ids.criterionId,
    entity_level: 'keyword',
    entity_name: `${decision.keyword} ${decision.match_type}`,
    action_type: 'SET_KEYWORD_CPC',
    expected_current_bid: decision.current_bid,
    target_bid: decision.recommended_bid,
    min_bid: settings.min_bid,
    max_bid: settings.max_bid,
    max_change_pct: settings.auto_bid_guardrails.maxChangePercent,
    reason: decision.reason,
    approval_status: 'APPROVED',
    approved_by: approver(settings),
    approved_at: now,
    status: 'APPROVED',
  });
}

export async function queueBudgetAction(proposal: BudgetProposal, settings: Settings): Promise<QueueActionResponse> {
  buildBudgetActionPackage(proposal, settings);
  throw new Error('Direct bridge publishing is not enabled in this dashboard build. Use Copy queue JSON and post it to the Apps Script Bridge or paste the row into the Sheet queue.');
}

export async function queueKeywordBidAction(decision: BidDecision, settings: Settings): Promise<QueueActionResponse> {
  buildKeywordBidActionPackage(decision, settings);
  throw new Error('Direct bridge publishing is not enabled in this dashboard build. Use Copy queue JSON and post it to the Apps Script Bridge or paste the row into the Sheet queue.');
}
