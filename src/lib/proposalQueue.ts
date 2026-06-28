import type { ImportedData, Settings } from '../types';
import { getActiveAccountScope } from './accountSources';
import { buildBudgetOptimization, type BudgetProposal } from './budgetOptimization';
import { computeSyncHealth, computeVoluumFreshness, type FreshnessStatus, type SyncHealth, type VoluumFreshness } from './syncHealth';

export const V1_REMOTE_UPDATE_ACTIONS = [
  'SET_BUDGET',
  'PAUSE_CAMPAIGN',
  'ENABLE_CAMPAIGN',
  'SET_CAMPAIGN_LABEL',
] as const;

export const OUT_OF_SCOPE_REMOTE_UPDATE_ACTIONS = [
  'SET_BID',
  'SET_BID_STRATEGY_TARGET',
  'ADD_NEGATIVE_KEYWORD',
  'SET_DEVICE_MODIFIER',
  'SET_GEO_MODIFIER',
  'SET_AD_SCHEDULE_MODIFIER',
] as const;

export type RemoteUpdateAction = typeof V1_REMOTE_UPDATE_ACTIONS[number];
export type OutOfScopeRemoteUpdateAction = typeof OUT_OF_SCOPE_REMOTE_UPDATE_ACTIONS[number];
export type ProposalApprovalStatus = 'pending_review' | 'approved' | 'rejected';
export type ProposalRisk = 'low' | 'medium' | 'high';
export type ProposalAuditState =
  | 'ready'
  | 'approved'
  | 'dry_run'
  | 'applied'
  | 'skipped_stale_data'
  | 'skipped_guardrail'
  | 'skipped_campaign_changed'
  | 'skipped_shared_budget'
  | 'skipped_not_allowlisted'
  | 'skipped_denylisted'
  | 'not_found'
  | 'failed'
  | 'rolled_back';

export interface ProposalQueueGuardrails {
  allowlistedCampaignIds: string[];
  denylistedCampaignIds: string[];
  maxBudgetChangePercent: number;
  maxActionsPerCampaignPerDay: number;
  maxTotalBudgetDeltaPerDay: number;
  allowSharedBudget: boolean;
  existingActionsByCampaign: Record<string, number>;
  existingBudgetDeltaToday: number;
}

export interface ProposalGuardrailResult {
  state: ProposalAuditState;
  feedEligible: boolean;
  reasons: string[];
}

export interface ProposalQueueItem {
  id: string;
  action: RemoteUpdateAction;
  campaignId: string;
  campaignName: string;
  oldValue: number | string | null;
  newValue: number | string | null;
  expectedCurrentValue: number | string | null;
  reason: string;
  risk: ProposalRisk;
  approvalStatus: ProposalApprovalStatus;
  expiresAt: string;
  budgetIsShared: boolean;
  rollbackValue: number | string | null;
  source: 'budget_optimizer' | 'manual_review';
  dryRunPreview: string;
  guardrail: ProposalGuardrailResult;
  auditState: ProposalAuditState;
  remoteApplyAllowed: false;
}

export interface ProposalFeedContractRow {
  proposal_id: string;
  account_id: string;
  customer_id: string;
  source_sheet_id: string;
  action: RemoteUpdateAction;
  campaign_id: string;
  expected_current_value: number | string | null;
  target_value: number | string | null;
  reason: string;
  mode: 'dry_run';
  token_hint: 'redacted';
  status: 'ready';
}

export interface ProposalQueueModel {
  proposals: ProposalQueueItem[];
  feedPreview: ProposalFeedContractRow[];
  auditStates: ProposalAuditState[];
  blockedCount: number;
  readyCount: number;
  killSwitchOn: boolean;
  freshnessStatus: SyncHealth['freshnessStatus'];
  voluumFreshnessStatus: VoluumFreshness['status'];
  debugPacket: string;
}

interface ProposalFreshnessGate {
  google: FreshnessStatus;
  voluum: VoluumFreshness;
  overall: FreshnessStatus;
}

const AUDIT_STATES: ProposalAuditState[] = [
  'ready',
  'approved',
  'dry_run',
  'applied',
  'skipped_stale_data',
  'skipped_guardrail',
  'skipped_campaign_changed',
  'skipped_shared_budget',
  'skipped_not_allowlisted',
  'skipped_denylisted',
  'not_found',
  'failed',
  'rolled_back',
];

export function isV1RemoteUpdateAction(action: string): action is RemoteUpdateAction {
  return (V1_REMOTE_UPDATE_ACTIONS as readonly string[]).includes(action);
}

export function defaultProposalGuardrails(settings: Settings): ProposalQueueGuardrails {
  return {
    allowlistedCampaignIds: [],
    denylistedCampaignIds: [],
    maxBudgetChangePercent: settings.auto_bid_guardrails.maxBudgetChangePercent,
    maxActionsPerCampaignPerDay: Math.max(1, Math.min(settings.auto_bid_guardrails.maxChangesPerRun, 10)),
    maxTotalBudgetDeltaPerDay: settings.max_daily_loss,
    allowSharedBudget: settings.auto_bid_guardrails.allowSharedBudget,
    existingActionsByCampaign: {},
    existingBudgetDeltaToday: 0,
  };
}

export function evaluateProposalGuardrails(
  proposal: Omit<ProposalQueueItem, 'guardrail' | 'auditState' | 'remoteApplyAllowed'>,
  settings: Settings,
  syncHealth: SyncHealth,
  guardrails: ProposalQueueGuardrails = defaultProposalGuardrails(settings),
  freshnessGate: ProposalFreshnessGate = {
    google: syncHealth.freshnessStatus,
    voluum: { status: 'OPTIONAL', rows: 0, importedAt: null, staleFailClosed: false },
    overall: syncHealth.freshnessStatus,
  }
): ProposalGuardrailResult {
  if (!isV1RemoteUpdateAction(proposal.action)) {
    return blocked('skipped_guardrail', `Action ${proposal.action} is outside v1 apply scope.`);
  }
  if (settings.action_mode === 'disabled') {
    return blocked('skipped_guardrail', 'Global kill switch is on.');
  }
  if (settings.action_mode !== 'dry_run') {
    return blocked('skipped_guardrail', `Action mode is ${settings.action_mode}; dry_run is required for feed eligibility.`);
  }
  if (!settings.auto_bid_guardrails.dryRun) {
    return blocked('skipped_guardrail', 'Dry-run guardrail is disabled.');
  }
  if (settings.auto_bid_guardrails.applyEnabled) {
    return blocked('skipped_guardrail', 'Apply guardrail must remain disabled for dry-run preview.');
  }
  if (freshnessGate.google !== 'OK') {
    return blocked('skipped_stale_data', `Google freshness is ${freshnessGate.google}; stale data fails closed.`);
  }
  if (freshnessGate.voluum.staleFailClosed) {
    return blocked('skipped_stale_data', `Voluum freshness is ${freshnessGate.voluum.status}; stale data fails closed.`);
  }
  if (freshnessGate.overall !== 'OK') {
    return blocked('skipped_stale_data', `Freshness is ${freshnessGate.overall}; stale data fails closed.`);
  }
  if (guardrails.denylistedCampaignIds.includes(proposal.campaignId)) {
    return blocked('skipped_denylisted', 'Campaign is denylisted.');
  }
  if (!guardrails.allowlistedCampaignIds.includes(proposal.campaignId)) {
    return blocked('skipped_not_allowlisted', 'Campaign is not allowlisted.');
  }
  if (proposal.budgetIsShared && !guardrails.allowSharedBudget) {
    return blocked('skipped_shared_budget', 'Shared budgets are disabled by guardrail.');
  }
  if (typeof proposal.oldValue === 'number' && typeof proposal.newValue === 'number' && proposal.oldValue > 0) {
    const deltaPercent = Math.abs((proposal.newValue - proposal.oldValue) / proposal.oldValue) * 100;
    if (deltaPercent > guardrails.maxBudgetChangePercent) {
      return blocked('skipped_guardrail', `Budget delta ${deltaPercent.toFixed(1)}% exceeds ${guardrails.maxBudgetChangePercent}%.`);
    }
    const nextTotalDelta = guardrails.existingBudgetDeltaToday + Math.abs(proposal.newValue - proposal.oldValue);
    if (nextTotalDelta > guardrails.maxTotalBudgetDeltaPerDay) {
      return blocked('skipped_guardrail', 'Daily total budget delta guardrail reached.');
    }
  }
  if ((guardrails.existingActionsByCampaign[proposal.campaignId] ?? 0) >= guardrails.maxActionsPerCampaignPerDay) {
    return blocked('skipped_guardrail', 'Max actions per campaign per day reached.');
  }
  return { state: 'ready', feedEligible: true, reasons: ['All guardrails passed for dry-run feed preview.'] };
}

export function buildProposalQueue(
  data: ImportedData,
  settings: Settings,
  guardrails: ProposalQueueGuardrails = defaultProposalGuardrails(settings)
): ProposalQueueModel {
  const syncHealth = computeSyncHealth(data.syncLog);
  const voluumFreshness = computeVoluumFreshness(data);
  const freshnessGate = buildFreshnessGate(syncHealth, voluumFreshness);
  const queueHealth = { ...syncHealth, freshnessStatus: freshnessGate.overall };
  const base = buildBudgetOptimization(data, settings, 'balanced');
  const proposals = base.proposals.map((proposal) => fromBudgetProposal(proposal, settings, queueHealth, guardrails, freshnessGate));
  const feedPreview = buildFeedPreview(proposals, settings);
  return {
    proposals,
    feedPreview,
    auditStates: AUDIT_STATES,
    blockedCount: proposals.filter((proposal) => !proposal.guardrail.feedEligible).length,
    readyCount: proposals.filter((proposal) => proposal.guardrail.feedEligible).length,
    killSwitchOn: settings.action_mode === 'disabled',
    freshnessStatus: queueHealth.freshnessStatus,
    voluumFreshnessStatus: voluumFreshness.status,
    debugPacket: buildDebugPacket(proposals, queueHealth, voluumFreshness, guardrails),
  };
}

export function rejectedOutOfScopeProposal(action: OutOfScopeRemoteUpdateAction, reason: string): ProposalQueueItem {
  return {
    id: `out-of-scope:${action}`,
    action: 'SET_CAMPAIGN_LABEL',
    campaignId: 'not-queued',
    campaignName: action,
    oldValue: null,
    newValue: null,
    expectedCurrentValue: null,
    reason,
    risk: 'high',
    approvalStatus: 'rejected',
    expiresAt: expiresInHours(24),
    budgetIsShared: false,
    rollbackValue: null,
    source: 'manual_review',
    dryRunPreview: `${action} is review/export-only and never written to the v1 apply feed.`,
    guardrail: blocked('skipped_guardrail', `${action} is outside v1 apply scope.`),
    auditState: 'skipped_guardrail',
    remoteApplyAllowed: false,
  };
}

function fromBudgetProposal(
  proposal: BudgetProposal,
  settings: Settings,
  syncHealth: SyncHealth,
  guardrails: ProposalQueueGuardrails,
  freshnessGate: ProposalFreshnessGate
): ProposalQueueItem {
  const shell = {
    id: proposal.id,
    action: 'SET_BUDGET' as const,
    campaignId: proposal.campaignId,
    campaignName: proposal.campaignName,
    oldValue: proposal.currentBudget,
    newValue: proposal.proposedBudget,
    expectedCurrentValue: proposal.currentBudget,
    reason: proposal.reason,
    risk: riskForDelta(proposal.deltaPercent),
    approvalStatus: 'pending_review' as const,
    expiresAt: expiresInHours(24),
    budgetIsShared: false,
    rollbackValue: proposal.currentBudget,
    source: 'budget_optimizer' as const,
    dryRunPreview: `Would SET_BUDGET from ${proposal.currentBudget} to ${proposal.proposedBudget}; script must re-check current budget before apply.`,
  };
  const guardrail = evaluateProposalGuardrails(shell, settings, syncHealth, guardrails, freshnessGate);
  return {
    ...shell,
    guardrail,
    auditState: guardrail.state,
    remoteApplyAllowed: false,
  };
}

function buildFeedPreview(proposals: ProposalQueueItem[], settings: Settings): ProposalFeedContractRow[] {
  const scope = getActiveAccountScope(settings);
  if (!scope) return [];
  return proposals
    .filter((proposal) => proposal.guardrail.feedEligible)
    .map((proposal) => ({
      proposal_id: proposal.id,
      account_id: scope.account_id,
      customer_id: scope.customer_id,
      source_sheet_id: scope.source_sheet_id,
      action: proposal.action,
      campaign_id: proposal.campaignId,
      expected_current_value: proposal.expectedCurrentValue,
      target_value: proposal.newValue,
      reason: proposal.reason,
      mode: 'dry_run',
      token_hint: 'redacted',
      status: 'ready',
    }));
}

function buildDebugPacket(
  proposals: ProposalQueueItem[],
  syncHealth: SyncHealth,
  voluumFreshness: VoluumFreshness,
  guardrails: ProposalQueueGuardrails
): string {
  return JSON.stringify({
    generated_at: new Date().toISOString(),
    freshness: syncHealth.freshnessStatus,
    voluum_freshness: voluumFreshness.status,
    voluum_stale_fail_closed: voluumFreshness.staleFailClosed,
    guardrails: {
      allowlisted_campaigns: guardrails.allowlistedCampaignIds.length,
      denylisted_campaigns: guardrails.denylistedCampaignIds.length,
      max_budget_change_percent: guardrails.maxBudgetChangePercent,
      max_actions_per_campaign_per_day: guardrails.maxActionsPerCampaignPerDay,
      max_total_budget_delta_per_day: guardrails.maxTotalBudgetDeltaPerDay,
    },
    proposals: proposals.map((proposal) => ({
      id: proposal.id,
      action: proposal.action,
      campaign_id: proposal.campaignId,
      state: proposal.auditState,
      feed_eligible: proposal.guardrail.feedEligible,
      reasons: proposal.guardrail.reasons,
    })),
  }, null, 2);
}

function buildFreshnessGate(syncHealth: SyncHealth, voluumFreshness: VoluumFreshness): ProposalFreshnessGate {
  return {
    google: syncHealth.freshnessStatus,
    voluum: voluumFreshness,
    overall: worstFreshness(syncHealth.freshnessStatus, voluumFreshness.status),
  };
}

function worstFreshness(google: FreshnessStatus, voluum: VoluumFreshness['status']): FreshnessStatus {
  if (google === 'ERROR' || voluum === 'ERROR') return 'ERROR';
  if (google === 'UNKNOWN' || voluum === 'UNKNOWN') return 'UNKNOWN';
  if (google === 'STALE' || voluum === 'STALE') return 'STALE';
  return 'OK';
}

function blocked(state: ProposalAuditState, reason: string): ProposalGuardrailResult {
  return { state, feedEligible: false, reasons: [reason] };
}

function riskForDelta(deltaPercent: number): ProposalRisk {
  const abs = Math.abs(deltaPercent);
  if (abs >= 25) return 'high';
  if (abs >= 10) return 'medium';
  return 'low';
}

function expiresInHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}
