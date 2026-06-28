import { useMemo, useState } from 'react';
import { Download, Filter } from 'lucide-react';
import { PageContainer, PageHeader, Card, CardBody, CardHeader } from '../components/Layout';
import { DataTable, type Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { useApp } from '../context/AppContext';
import { fmtCurrency, fmtPercent } from '../lib/metrics/calculations';
import { buildKeywordAnalysis, keywordAnalysisToCsv } from '../lib/keywordAnalysis';
import type { AnalysisEntity, KeywordAnalysisTab, NGramRow, ReviewOnlyCandidate } from '../lib/keywordAnalysis';

const TABS: Array<{ id: KeywordAnalysisTab | 'candidates'; label: string }> = [
  { id: 'keywords', label: 'Keywords' },
  { id: 'search_terms', label: 'Search Terms' },
  { id: 'pmax_categories', label: 'PMax Categories' },
  { id: 'pmax_terms', label: 'PMax Terms' },
  { id: 'ngrams', label: 'N-grams' },
  { id: 'candidates', label: 'Review-only Candidates' },
];

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
  if (bucket === 'Fluke' || bucket === 'Meh') return 'amber';
  if (bucket === 'Low Data') return 'gray';
  return 'blue';
}

export function Keywords() {
  const { data, settings } = useApp();
  const [activeTab, setActiveTab] = useState<KeywordAnalysisTab | 'candidates'>('keywords');
  const [campaign, setCampaign] = useState('');
  const [text, setText] = useState('');
  const [minCost, setMinCost] = useState('');
  const [view, setView] = useState<'table' | 'tree' | 'treemap'>('table');

  const model = useMemo(() => buildKeywordAnalysis(data, settings, {
    campaign: campaign || undefined,
    text: text || undefined,
    minCost: minCost ? Number(minCost) : undefined,
  }), [data, settings, campaign, text, minCost]);

  const rows = activeTab === 'candidates' || activeTab === 'ngrams' ? [] : model.tabs[activeTab];
  const csvRows = activeTab === 'candidates' || activeTab === 'ngrams'
    ? Object.values(model.tabs).flat()
    : rows;

  const entityColumns = useMemo<Column<AnalysisEntity>[]>(() => [
    { key: 'label', label: 'Entity', render: (row) => <div><div className="font-medium text-gray-900">{row.label}</div><div className="text-xs text-gray-400">{row.matchType || row.tab}</div></div>, width: '220px' },
    { key: 'campaign', label: 'Campaign', render: (row) => <span className="text-xs text-gray-500 max-w-[160px] truncate block">{row.campaign}</span> },
    { key: 'adGroup', label: 'Ad Group', render: (row) => <span className="text-xs text-gray-500 max-w-[130px] truncate block">{row.adGroup || '—'}</span> },
    { key: 'cost', label: 'Cost', align: 'right', render: (row) => fmtCurrency(row.cost, settings.currency) },
    { key: 'clicks', label: 'Clicks', align: 'right', render: (row) => row.clicks.toLocaleString() },
    { key: 'conversions', label: 'Conv.', align: 'right', render: (row) => row.conversions.toFixed(1) },
    { key: 'ctr', label: 'CTR', align: 'right', render: (row) => fmtPercent(row.ctr) },
    { key: 'cvr', label: 'CVR', align: 'right', render: (row) => fmtPercent(row.cvr) },
    { key: 'cpa', label: 'CPA', align: 'right', render: (row) => row.cpa === null ? '—' : fmtCurrency(row.cpa, settings.currency) },
    { key: 'roi', label: 'ROI', align: 'right', render: (row) => row.roi === null ? '—' : `${row.roi.toFixed(1)}%` },
    { key: 'bucket', label: 'Bucket', render: (row) => <Badge variant={bucketVariant(row.bucket)}>{row.bucket}</Badge> },
    { key: 'badges', label: 'Badges', sortable: false, render: (row) => <div className="flex gap-1 flex-wrap">{row.badges.slice(0, 3).map((badge) => <Badge key={badge} variant={bucketVariant(badge)}>{badge}</Badge>)}</div> },
  ], [settings.currency]);

  const ngramColumns = useMemo<Column<NGramRow>[]>(() => [
    { key: 'ngram', label: 'N-gram', render: (row) => <span className="font-medium text-gray-900">{row.ngram}</span> },
    { key: 'tokens', label: 'Tokens', align: 'right' },
    { key: 'count', label: 'Count', align: 'right' },
    { key: 'cost', label: 'Cost', align: 'right', render: (row) => fmtCurrency(row.cost, settings.currency) },
    { key: 'clicks', label: 'Clicks', align: 'right' },
    { key: 'conversions', label: 'Conv.', align: 'right', render: (row) => row.conversions.toFixed(1) },
    { key: 'cpa', label: 'CPA', align: 'right', render: (row) => row.cpa === null ? '—' : fmtCurrency(row.cpa, settings.currency) },
    { key: 'bucket', label: 'Bucket', render: (row) => <Badge variant={bucketVariant(row.bucket)}>{row.bucket}</Badge> },
  ], [settings.currency]);

  const candidateColumns = useMemo<Column<ReviewOnlyCandidate>[]>(() => [
    { key: 'type', label: 'Candidate', render: (row) => <Badge variant={row.type.includes('NEGATIVE') || row.type.includes('PAUSE') ? 'red' : 'amber'}>{row.type.replace(/_/g, ' ')}</Badge> },
    { key: 'entityLabel', label: 'Entity', render: (row) => <span className="font-medium text-gray-900">{row.entityLabel}</span> },
    { key: 'campaign', label: 'Campaign' },
    { key: 'cost', label: 'Cost', align: 'right', render: (row) => fmtCurrency(row.cost, settings.currency) },
    { key: 'reason', label: 'Reason', render: (row) => <span className="text-xs text-gray-500">{row.reason}</span>, sortable: false },
    { key: 'exportOnly', label: 'Scope', render: () => <Badge variant="blue">export only</Badge>, sortable: false },
  ], [settings.currency]);

  return (
    <PageContainer>
      <PageHeader
        title="Keywords / Search / PMax / N-grams"
        description="Review-only analysis, filters, buckets, and export-only candidates. No remote apply path."
        actions={(
          <button
            onClick={() => downloadText('keyword_analysis_review_only.csv', keywordAnalysisToCsv(csvRows, model.candidates))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Download size={12} /> Export CSV
          </button>
        )}
      />

      <Card className="mb-5">
        <CardBody>
          <div className="flex flex-wrap items-center gap-3">
            <Filter size={14} className="text-gray-400" />
            <select value={campaign} onChange={(event) => setCampaign(event.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
              <option value="">All campaigns</option>
              {model.campaigns.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Text / badge filter" className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm" />
            <input value={minCost} onChange={(event) => setMinCost(event.target.value)} placeholder="Min cost" type="number" className="w-28 px-3 py-1.5 rounded-lg border border-gray-200 text-sm" />
            <select value={view} onChange={(event) => setView(event.target.value as 'table' | 'tree' | 'treemap')} className="ml-auto px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
              <option value="table">Table</option>
              <option value="tree">Tree</option>
              <option value="treemap">Treemap</option>
            </select>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
        {Object.entries(model.bucketMatrix).map(([bucket, count]) => (
          <div key={bucket} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className="text-xs text-gray-500">{bucket}</div>
            <div className="text-xl font-bold text-gray-900">{count}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader title={TABS.find((tab) => tab.id === activeTab)?.label ?? 'Analysis'} actions={<span className="text-xs text-gray-400">{view} view</span>} />
        <CardBody>
          {view !== 'table' && activeTab !== 'ngrams' && activeTab !== 'candidates' && (
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {rows.slice(0, 12).map((row) => (
                <div key={row.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="text-sm font-medium text-gray-900 truncate">{row.label}</div>
                  <div className="text-xs text-gray-500">{row.campaign}</div>
                  <div className="mt-2 flex justify-between text-xs">
                    <span>{fmtCurrency(row.cost, settings.currency)}</span>
                    <Badge variant={bucketVariant(row.bucket)}>{row.bucket}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'ngrams' ? (
            <DataTable columns={ngramColumns} data={model.ngrams} emptyMessage="No n-gram data. Import search terms." />
          ) : activeTab === 'candidates' ? (
            <DataTable columns={candidateColumns} data={model.candidates} emptyMessage="No review-only candidates." />
          ) : (
            <DataTable columns={entityColumns} data={rows} emptyMessage="No rows match current filters." rowKey={(row) => row.id} />
          )}
        </CardBody>
      </Card>

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800">
        Candidate rows are review/export-only. Negative-keyword and bid changes are not part of the v1 remote-apply pipeline.
      </div>
    </PageContainer>
  );
}
