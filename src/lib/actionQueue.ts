import type { BidDecision, Settings } from '../types';
import type { BudgetProposal } from './budgetOptimization';

export interface QueueActionResponse {
  ok: boolean;
  data?: { tab?: string; row?: number; action_id?: string; status?: string };
  error?: string;
  status_hint?: number;
}

export function canQueueScriptAction(settings: Settings): boolean {
  return Boolean(settings.bridge_endpoint_url?.trim() && settings.bridge_token?.trim() && (settings.action_mode === 'dry_run' || settings.action_mode === 'manual_apply'));
}

export function actionQueueBlockedReason(settings: Settings): string | null {
  if (!settings.bridge_endpoint_url?.trim()) return 'Apps Script Bridge URL is missing.';
  if (!settings.bridge_token?.trim()) return 'Bridge token is missing.';
  if (settings.action_mode !== 'dry_run' && settings.action_mode !== 'manual_apply') return `Account mode is ${settings.action_mode}; choose Dry run via script or Manual apply via script.`;
  return null;
}

export async function queueBudgetAction(_proposal: BudgetProposal, settings: Settings): Promise<QueueActionResponse> {
  const blocked = actionQueueBlockedReason(settings);
  if (blocked) throw new Error(blocked);
  throw new Error('Action queue publisher is not implemented in this build.');
}

export async function queueKeywordBidAction(_decision: BidDecision, settings: Settings): Promise<QueueActionResponse> {
  const blocked = actionQueueBlockedReason(settings);
  if (blocked) throw new Error(blocked);
  throw new Error('Action queue publisher is not implemented in this build.');
}
