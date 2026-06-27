import { useMemo } from 'react';
import { PageContainer, PageHeader, Card, CardBody, ExportButton } from '../components/Layout';
import { DataTable, type Column } from '../components/DataTable';
import { IssueLevelBadge } from '../components/Badge';
import { Badge } from '../components/Badge';
import { useApp } from '../context/AppContext';
import { computePolicyIssues } from '../lib/decisionEngine/policyIssues';
import { exportPolicyIssuesCSV } from '../lib/export';
import type { PolicyIssue } from '../types';

export function PolicyIssues() {
  const { data } = useApp();

  const issues = useMemo(() => computePolicyIssues(data.policy), [data.policy]);

  const criticalCount = issues.filter((i) => i.issue_level === 'CRITICAL').length;
  const warningCount = issues.filter((i) => i.issue_level === 'WARNING').length;

  const columns: Column<PolicyIssue>[] = [
    { key: 'campaign', label: 'Campaign', render: (r) => <span className="font-medium text-gray-900 max-w-[160px] truncate block">{r.campaign}</span>, width: '160px' },
    { key: 'ad_group', label: 'Ad Group', render: (r) => <span className="text-xs text-gray-600 max-w-[140px] truncate block">{r.ad_group}</span> },
    { key: 'ad_id', label: 'Ad ID', render: (r) => <span className="text-xs font-mono text-gray-500">{r.ad_id}</span> },
    {
      key: 'ad_status', label: 'Ad Status', sortable: false,
      render: (r) => <Badge variant={r.ad_status === 'ENABLED' ? 'green' : 'amber'}>{r.ad_status || '-'}</Badge>,
    },
    {
      key: 'approval_status', label: 'Approval', sortable: false,
      render: (r) => (
        <Badge variant={r.approval_status?.toUpperCase().includes('APPROVED') ? 'green' : 'red'}>
          {r.approval_status || '-'}
        </Badge>
      ),
    },
    { key: 'review_status', label: 'Review Status', render: (r) => <span className="text-xs text-gray-500">{r.review_status || '-'}</span> },
    {
      key: 'final_urls', label: 'Final URL', sortable: false,
      render: (r) => r.final_urls
        ? <span className="text-xs text-blue-600 max-w-[160px] truncate block">{r.final_urls}</span>
        : <Badge variant="red">MISSING</Badge>,
    },
    { key: 'issue_level', label: 'Level', render: (r) => <IssueLevelBadge level={r.issue_level} /> },
    {
      key: 'recommended_fix', label: 'Recommended Fix', sortable: false,
      render: (r) => <span className="text-xs text-gray-500 max-w-[240px] block">{r.recommended_fix}</span>,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Policy Issues"
        description={`${issues.length} issues: ${criticalCount} critical, ${warningCount} warnings`}
        actions={
          issues.length > 0 ? (
            <ExportButton
              label="Export CSV"
              onClick={() => exportPolicyIssuesCSV(issues)}
            />
          ) : undefined
        }
      />

      {criticalCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 mb-4">
          <strong>{criticalCount} critical policy {criticalCount === 1 ? 'issue' : 'issues'} detected.</strong>{' '}
          These ads may not be serving. Review immediately in Google Ads.
        </div>
      )}

      <Card>
        <CardBody className="p-0 px-5 py-4">
          <DataTable
            columns={columns}
            data={issues}
            emptyMessage="No policy issues detected. Import google_ads_policy CSV to check."
          />
        </CardBody>
      </Card>
    </PageContainer>
  );
}
