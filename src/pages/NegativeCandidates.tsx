import { useMemo, useState } from 'react';
import { PageContainer, PageHeader, Card, CardBody, ExportButton } from '../components/Layout';
import { DataTable, type Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { useApp } from '../context/AppContext';
import { computeNegativeCandidates } from '../lib/decisionEngine/negativeCandidates';
import { exportNegativeCandidatesCSV } from '../lib/export';
import { fmtCurrency } from '../lib/metrics/calculations';
import type { NegativeCandidate, ApprovalStatus } from '../types';

const APPROVAL_OPTIONS: ApprovalStatus[] = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'WATCHLIST'];

export function NegativeCandidates() {
  const { data, settings, negApprovals, setNegApproval } = useApp();
  const [filterType, setFilterType] = useState<string>('ALL');

  const candidates = useMemo(
    () => computeNegativeCandidates(data.searchTerms, settings, negApprovals),
    [data.searchTerms, settings, negApprovals]
  );

  const filtered = filterType === 'ALL'
    ? candidates
    : candidates.filter((c) => c.negative_type === filterType);

  const phraseCount = candidates.filter((c) => c.negative_type === 'NEGATIVE_PHRASE_CANDIDATE').length;
  const exactCount = candidates.filter((c) => c.negative_type === 'NEGATIVE_EXACT_CANDIDATE').length;

  const columns: Column<NegativeCandidate>[] = [
    { key: 'search_term', label: 'Search Term', render: (r) => <span className="font-medium text-gray-900 max-w-[200px] truncate block">{r.search_term}</span>, width: '200px' },
    { key: 'campaign', label: 'Campaign', render: (r) => <span className="text-xs text-gray-500 max-w-[140px] truncate block">{r.campaign}</span> },
    { key: 'ad_group', label: 'Ad Group', render: (r) => <span className="text-xs text-gray-500 max-w-[120px] truncate block">{r.ad_group}</span> },
    { key: 'clicks', label: 'Clicks', align: 'right', render: (r) => r.clicks.toLocaleString() },
    { key: 'cost', label: 'Cost', align: 'right', render: (r) => <span className="text-red-600 font-medium">{fmtCurrency(r.cost, settings.currency)}</span> },
    { key: 'conversions', label: 'Conv.', align: 'right', render: (r) => r.conversions.toFixed(1) },
    {
      key: 'negative_type', label: 'Type', sortable: false,
      render: (r) => (
        <Badge variant={r.negative_type === 'NEGATIVE_PHRASE_CANDIDATE' ? 'purple' : 'red'}>
          {r.negative_type === 'NEGATIVE_PHRASE_CANDIDATE' ? 'PHRASE' : 'EXACT'}
        </Badge>
      ),
    },
    { key: 'reason', label: 'Reason', render: (r) => <span className="text-xs text-gray-500">{r.reason}</span>, sortable: false },
    {
      key: 'approval_status', label: 'Approval', sortable: false,
      render: (r) => {
        const key = `${r.search_term}__${r.campaign}__${r.ad_group}`;
        return (
          <select
            value={r.approval_status}
            onChange={(e) => setNegApproval(key, e.target.value as ApprovalStatus)}
            onClick={(e) => e.stopPropagation()}
            className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {APPROVAL_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        );
      },
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Negative Candidates"
        description={`${candidates.length} candidates: ${phraseCount} phrase, ${exactCount} exact`}
        actions={
          candidates.length > 0 ? (
            <ExportButton label="Export CSV" onClick={() => exportNegativeCandidatesCSV(candidates)} />
          ) : undefined
        }
      />

      <div className="flex gap-2 mb-4">
        {[
          { key: 'ALL', label: `All (${candidates.length})` },
          { key: 'NEGATIVE_PHRASE_CANDIDATE', label: `Phrase (${phraseCount})` },
          { key: 'NEGATIVE_EXACT_CANDIDATE', label: `Exact (${exactCount})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterType(key)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              filterType === key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardBody className="p-0 px-5 py-4">
          <DataTable
            columns={columns}
            data={filtered}
            emptyMessage="No negative candidates found. Import google_search_terms CSV."
          />
        </CardBody>
      </Card>
    </PageContainer>
  );
}
