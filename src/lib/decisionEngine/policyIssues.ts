import type { PolicyRow, PolicyIssue, PolicyIssueLevel } from '../../types';

const APPROVED_STATUSES = ['APPROVED', 'APPROVED_LIMITED'];
const ENABLED_STATUSES = ['ENABLED'];
const PENDING_REVIEW_KEYWORDS = ['pending', 'under_review', 'review', 'eligible_limited'];

function isPendingReview(status: string): boolean {
  const lower = status.toLowerCase();
  return PENDING_REVIEW_KEYWORDS.some((k) => lower.includes(k));
}

export function computePolicyIssues(rows: PolicyRow[]): PolicyIssue[] {
  const issues: PolicyIssue[] = [];

  for (const r of rows) {
    const issueReasons: string[] = [];
    let level: PolicyIssueLevel = 'INFO';

    if (!APPROVED_STATUSES.includes(r.approval_status?.toUpperCase())) {
      issueReasons.push(`Approval status: ${r.approval_status || 'UNKNOWN'}`);
      level = 'CRITICAL';
    }

    if (isPendingReview(r.review_status || '')) {
      issueReasons.push(`Review status: ${r.review_status}`);
      if (level !== 'CRITICAL') level = 'WARNING';
    }

    if (r.ad_status && !ENABLED_STATUSES.includes(r.ad_status?.toUpperCase())) {
      issueReasons.push(`Ad status: ${r.ad_status}`);
      if (level === 'INFO') level = 'WARNING';
    }

    if (!r.final_urls || r.final_urls.trim() === '') {
      issueReasons.push('Missing final URL');
      level = 'CRITICAL';
    }

    if (issueReasons.length > 0) {
      const recommendedFix = buildRecommendedFix(r);
      issues.push({
        campaign: r.campaign_name,
        ad_group: r.ad_group_name,
        ad_id: r.ad_id,
        ad_status: r.ad_status,
        approval_status: r.approval_status,
        review_status: r.review_status,
        final_urls: r.final_urls,
        issue_level: level,
        recommended_fix: recommendedFix,
      });
    }
  }

  return issues.sort((a, b) => {
    const order: Record<PolicyIssueLevel, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return order[a.issue_level] - order[b.issue_level];
  });
}

function buildRecommendedFix(r: PolicyRow): string {
  const fixes: string[] = [];
  if (!APPROVED_STATUSES.includes(r.approval_status?.toUpperCase())) {
    fixes.push('Review ad in Google Ads for disapproval reason and edit ad copy or landing page.');
  }
  if (isPendingReview(r.review_status || '')) {
    fixes.push('Wait for Google review or appeal if incorrectly limited.');
  }
  if (r.ad_status && !['ENABLED'].includes(r.ad_status?.toUpperCase())) {
    fixes.push('Enable the ad if paused intentionally or investigate why it was disabled.');
  }
  if (!r.final_urls || r.final_urls.trim() === '') {
    fixes.push('Add a valid final URL to the ad.');
  }
  return fixes.join(' ');
}
