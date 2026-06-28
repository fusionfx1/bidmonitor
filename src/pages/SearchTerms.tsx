import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { PageContainer, PageHeader, Card, CardBody } from '../components/Layout';
import { DataTable, type Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { useApp } from '../context/AppContext';
import { fmtCurrency, fmtPercent } from '../lib/metrics/calculations';
import { buildKeywordAnalysis, keywordAnalysisToCsv } from '../lib/keywordAnalysis';
import type { AnalysisEntity } from '../lib/keywordAnalysis';

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function bucketVariant(bucket: string): 'green' | 'amber' | 'red' | 'blue' | 'gray' {
  if (bucket === 'Profitable') return 'green';
  if (bucket === 'Costly' || bucket === 'Zero Conv') return 'red';
  if (bucket === 'Low Data') return 'gray';
  if (bucket === 'Fluke' || bucket === 'Meh') return 'amber';
  return 'blue';
}

export function SearchTerms() {
  const { data, settings } = useApp();
  const [text, setText] = useState('');
  const model = useMemo(() => buildKeywordAnalysis(data, settings, { text: text || undefined }), [data, settings, text]);
  const rows = model.tabs.search_terms;

  const columns = useMemo<Column<AnalysisEntity>[]>(() => [
    { key: 'label', label: 'Search Term', render: (row) => <span className="font-medium text-gray-900">{row.label}</span>, width: '240px' },
    { key: 'campaign', label: 'Campaign', render: (row) => <span className="text-xs text-gray-500 max-w-[150px] truncate block">{row.campaign}</span> },
    { key: 'adGroup', label: 'Ad Group', render: (row) => <span className="text-xs text-gray-500 max-w-[130px] truncate block">{row.adGroup}</span> },
    { key: 'clicks', label: 'Clicks', align: 'right', render: (row) => row.clicks.toLocaleString() },
    { key: 'cost', label: 'Cost', align: 'right', render: (row) => fmtCurrency(row.cost, settings.currency) },
    { key: 'conversions', label: 'Conv.', align: 'right', render: (row) => row.conversions.toFixed(1) },
    { key: 'cvr', label: 'CVR', align: 'right', render: (row) => fmtPercent(row.cvr) },
    { key: 'cpa', label: 'CPA', align: 'right', render: (row) => row.cpa === null ? '—' : fmtCurrency(row.cpa, settings.currency) },
    { key: 'bucket', label: 'Bucket', render: (row) => <Badge variant={bucketVariant(row.bucket)}>{row.bucket}</Badge> },
    { key: 'badges', label: 'Badges', sortable: false, render: (row) => <div className="flex gap-1 flex-wrap">{row.badges.slice(0, 3).map((badge) => <Badge key={badge} variant={bucketVariant(badge)}>{badge}</Badge>)}</div> },
  ], [settings.currency]);

  return (
    <PageContainer>
      <PageHeader
        title="Search Terms"
        description={`${rows.length} search term entities · candidates remain review/export-only`}
        actions={(
          <button
            onClick={() => downloadText('search_terms_review_only.csv', keywordAnalysisToCsv(rows, model.candidates))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Download size={12} /> Export CSV
          </button>
        )}
      />
      <Card className="mb-5">
        <CardBody>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Filter by search term, campaign, or badge"
            className="w-full md:w-96 px-3 py-1.5 rounded-lg border border-gray-200 text-sm"
          />
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <DataTable columns={columns} data={rows} emptyMessage="No search term data. Import google_search_terms CSV." rowKey={(row) => row.id} />
        </CardBody>
      </Card>
    </PageContainer>
  );
}
