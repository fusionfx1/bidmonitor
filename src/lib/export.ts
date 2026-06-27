import type { BidDecision, NegativeCandidate, PolicyIssue } from '../types';

function escapeCSV(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCSV(row: Record<string, unknown>): string {
  return Object.values(row).map(escapeCSV).join(',');
}

function toCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const header = headers.join(',');
  const body = rows.map(rowToCSV).join('\n');
  return `${header}\n${body}`;
}

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportBidDecisionsCSV(decisions: BidDecision[]): void {
  const headers = [
    'keyword_key','campaign','ad_group','keyword','match_type',
    'current_bid','recommended_bid','cost','clicks','google_conversions',
    'voluum_conversions','used_conversions','revenue','profit','roi',
    'cpa','search_impression_share','rank_lost','absolute_top_rate',
    'bid_signal','action','reason','approval_status',
  ];
  const rows = decisions.map((d) => ({
    keyword_key: d.keyword_key,
    campaign: d.campaign,
    ad_group: d.ad_group,
    keyword: d.keyword,
    match_type: d.match_type,
    current_bid: d.current_bid,
    recommended_bid: d.recommended_bid ?? '',
    cost: d.cost.toFixed(2),
    clicks: d.clicks,
    google_conversions: d.google_conversions,
    voluum_conversions: d.voluum_conversions,
    used_conversions: d.used_conversions,
    revenue: d.revenue.toFixed(2),
    profit: d.profit.toFixed(2),
    roi: d.roi.toFixed(2),
    cpa: d.cpa.toFixed(2),
    search_impression_share: (d.search_impression_share * 100).toFixed(1),
    rank_lost: (d.rank_lost * 100).toFixed(1),
    absolute_top_rate: (d.absolute_top_rate * 100).toFixed(1),
    bid_signal: d.bid_signal,
    action: d.action,
    reason: d.reason,
    approval_status: d.approval_status,
  }));
  downloadBlob(toCSV(headers, rows), 'bid_decisions.csv', 'text/csv');
}

export function exportNegativeCandidatesCSV(candidates: NegativeCandidate[]): void {
  const headers = [
    'search_term','campaign','ad_group','clicks','cost',
    'conversions','negative_type','reason','approval_status',
  ];
  const rows = candidates.map((c) => ({
    search_term: c.search_term,
    campaign: c.campaign,
    ad_group: c.ad_group,
    clicks: c.clicks,
    cost: c.cost.toFixed(2),
    conversions: c.conversions,
    negative_type: c.negative_type,
    reason: c.reason,
    approval_status: c.approval_status,
  }));
  downloadBlob(toCSV(headers, rows), 'negative_candidates.csv', 'text/csv');
}

export function exportPolicyIssuesCSV(issues: PolicyIssue[]): void {
  const headers = [
    'campaign','ad_group','ad_id','ad_status','approval_status',
    'review_status','final_urls','issue_level','recommended_fix',
  ];
  downloadBlob(toCSV(headers, issues as unknown as Record<string, unknown>[]), 'policy_issues.csv', 'text/csv');
}

export function exportDashboardSummaryJSON(summary: Record<string, unknown>): void {
  const content = JSON.stringify(summary, null, 2);
  downloadBlob(content, 'dashboard_summary.json', 'application/json');
}
