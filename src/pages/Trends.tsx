import { useMemo, useState } from 'react';
import { AlertTriangle, BarChart2, Copy, Download, TrendingUp } from 'lucide-react';
import { PageContainer, PageHeader, Card, CardBody, CardHeader } from '../components/Layout';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { useApp } from '../context/AppContext';
import { buildDiagnosticsModel, buildTrendModel } from '../lib/trendsDiagnostics';
import type { CampaignTrendSummary, TrendDailyRow, TrendMetricCard, TrendPreset } from '../lib/trendsDiagnostics';

const PRESETS: TrendPreset[] = ['7d', '30d', '90d', '180d'];

const TONE: Record<TrendMetricCard['tone'], string> = {
  ok: 'text-emerald-700 border-emerald-200 bg-emerald-50',
  warn: 'text-amber-700 border-amber-200 bg-amber-50',
  safe: 'text-blue-700 border-blue-200 bg-blue-50',
  missing: 'text-gray-600 border-gray-200 bg-gray-50',
};

function MetricCard({ card }: { card: TrendMetricCard }) {
  return (
    <div className={`rounded-xl border p-4 ${TONE[card.tone]}`}>
      <div className="text-xs uppercase tracking-wide font-semibold opacity-70">{card.label}</div>
      <div className="text-2xl font-bold mt-1">{card.displayValue}</div>
    </div>
  );
}

function TrendSparkline({ rows }: { rows: TrendDailyRow[] }) {
  if (rows.length === 0) return <div className="text-sm text-gray-400">No trend data.</div>;
  const maxCost = Math.max(...rows.map((row) => row.cost), 1);
  const maxConv = Math.max(...rows.map((row) => row.conversions), 1);
  const costLine = line(rows.map((row) => row.cost), maxCost);
  const convLine = line(rows.map((row) => row.conversions), maxConv);
  return (
    <svg viewBox="0 0 100 40" className="w-full h-52" role="img" aria-label="Cost and conversion trend">
      <polyline points={costLine} fill="none" stroke="currentColor" strokeWidth="1.8" className="text-blue-500" />
      <polyline points={convLine} fill="none" stroke="currentColor" strokeWidth="1.8" className="text-emerald-500" />
    </svg>
  );
}

function line(values: number[], max: number): string {
  return values.map((value, index) => {
    const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 36 - (value / max) * 32;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function formatCurrency(value: number, currency: string): string {
  return `${currency || 'THB'} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number | null): string {
  return value === null ? 'N/A' : `${value.toFixed(1)}%`;
}

function downloadText(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function dailyCsv(rows: TrendDailyRow[]): string {
  const header = 'date,impressions,clicks,cost,conversions,value,ctr,cpa,roi,cost_ma7,cost_ma28';
  const body = rows.map((row) => [
    row.date,
    row.impressions,
    row.clicks,
    row.cost.toFixed(2),
    row.conversions.toFixed(2),
    row.value.toFixed(2),
    row.ctr.toFixed(4),
    row.cpa?.toFixed(2) ?? '',
    row.roi?.toFixed(2) ?? '',
    row.costMa7?.toFixed(2) ?? '',
    row.costMa28?.toFixed(2) ?? '',
  ].join(',')).join('\n');
  return `${header}\n${body}`;
}

export function Trends() {
  const { data, settings } = useApp();
  const [preset, setPreset] = useState<TrendPreset>('30d');
  const [campaignId, setCampaignId] = useState('');
  const [allCampaigns, setAllCampaigns] = useState(true);
  const model = useMemo(
    () => buildTrendModel(data, settings, { preset, campaignId, includeAllCampaigns: allCampaigns }),
    [data, settings, preset, campaignId, allCampaigns]
  );
  const diagnostics = useMemo(() => buildDiagnosticsModel(data, settings), [data, settings]);

  const dailyColumns = useMemo<Column<TrendDailyRow>[]>(() => [
    { key: 'date', label: 'Date' },
    { key: 'cost', label: 'Cost', align: 'right', render: (row) => formatCurrency(row.cost, settings.currency) },
    { key: 'conversions', label: 'Conv.', align: 'right', render: (row) => row.conversions.toFixed(1) },
    { key: 'value', label: 'Value', align: 'right', render: (row) => formatCurrency(row.value, settings.currency) },
    { key: 'cpa', label: 'CPA', align: 'right', render: (row) => row.cpa === null ? 'N/A' : formatCurrency(row.cpa, settings.currency) },
    { key: 'roi', label: 'ROI', align: 'right', render: (row) => formatPercent(row.roi) },
    { key: 'costMa7', label: '7d MA', align: 'right', render: (row) => row.costMa7 === null ? '—' : formatCurrency(row.costMa7, settings.currency) },
    { key: 'costMa28', label: '28d MA', align: 'right', render: (row) => row.costMa28 === null ? '—' : formatCurrency(row.costMa28, settings.currency) },
  ], [settings.currency]);

  const campaignColumns = useMemo<Column<CampaignTrendSummary>[]>(() => [
    { key: 'campaignName', label: 'Campaign', render: (row) => <div><div className="font-medium text-gray-900">{row.campaignName}</div><div className="text-xs text-gray-400">{row.channel}</div></div> },
    { key: 'cost', label: 'Cost', align: 'right', render: (row) => formatCurrency(row.cost, settings.currency) },
    { key: 'conversions', label: 'Conv.', align: 'right', render: (row) => row.conversions.toFixed(1) },
    { key: 'profit', label: 'Profit', align: 'right', render: (row) => formatCurrency(row.profit, settings.currency) },
    { key: 'cpa', label: 'CPA', align: 'right', render: (row) => row.cpa === null ? 'N/A' : formatCurrency(row.cpa, settings.currency) },
    { key: 'verdict', label: 'Verdict', render: (row) => <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.verdict === 'winner' ? 'bg-emerald-50 text-emerald-700' : row.verdict === 'loser' ? 'bg-red-50 text-red-700' : row.verdict === 'insufficient' ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-700'}`}>{row.verdict}</span> },
    { key: 'reason', label: 'Reason', render: (row) => <span className="text-xs text-gray-500">{row.reason}</span>, sortable: false },
  ], [settings.currency]);

  return (
    <PageContainer>
      <PageHeader
        title="Account Trends"
        description="Read-only moving averages, pacing, driver diagnostics, and debug packet from imported data"
        actions={(
          <div className="flex gap-2">
            <button onClick={() => downloadText('trend_daily.csv', dailyCsv(model.dailyRows), 'text/csv')} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50">
              <Download size={12} /> Export daily CSV
            </button>
            <button onClick={() => navigator.clipboard?.writeText(diagnostics.copyPrompt)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50">
              <Copy size={12} /> Copy prompt
            </button>
          </div>
        )}
      />

      <Card className="mb-5">
        <CardBody>
          <div className="flex flex-wrap items-center gap-3">
            <select value={preset} onChange={(event) => setPreset(event.target.value as TrendPreset)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
              {PRESETS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={allCampaigns} onChange={(event) => setAllCampaigns(event.target.checked)} />
              All campaigns
            </label>
            <select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} disabled={allCampaigns} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-50">
              <option value="">Select campaign</option>
              {model.campaignOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <span className="ml-auto text-xs text-gray-500">
              Month projection: <strong>{formatCurrency(model.pacing.projectedMonthSpend, settings.currency)}</strong>
            </span>
          </div>
        </CardBody>
      </Card>

      {diagnostics.staleFailClosed && (
        <div className="mb-5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <AlertTriangle size={16} /> Stale Google sync detected. Diagnostics stay visible, but scaling decisions are fail-closed.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
        {model.metricCards.map((card) => <MetricCard key={card.id} card={card} />)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2">
          <CardHeader title="Cost vs conversion trend" actions={<span className="text-xs text-gray-400">Blue cost · Green conversions</span>} />
          <CardBody><TrendSparkline rows={model.dailyRows} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Diagnostics" actions={<TrendingUp size={14} className="text-gray-400" />} />
          <CardBody className="space-y-3">
            <div className="text-sm font-medium text-gray-800">{diagnostics.autoInsight}</div>
            <div className="text-xs text-gray-500">{diagnostics.recommendedAction}</div>
            <div className="space-y-1">
              {diagnostics.quickWins.map((win) => <div key={win} className="text-xs bg-gray-50 rounded-lg px-3 py-2 text-gray-600">{win}</div>)}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
        <Card>
          <CardHeader title="Campaign classification" />
          <CardBody><DataTable columns={campaignColumns} data={model.campaignSummaries} emptyMessage="No campaign trend data." /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Daily rows" actions={<BarChart2 size={14} className="text-gray-400" />} />
          <CardBody><DataTable columns={dailyColumns} data={model.dailyRows} emptyMessage="No daily trend data." /></CardBody>
        </Card>
      </div>
    </PageContainer>
  );
}
