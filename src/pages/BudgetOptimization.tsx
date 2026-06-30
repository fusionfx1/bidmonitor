import { useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { PageContainer, PageHeader, Card, CardBody, CardHeader } from '../components/Layout';
import { DataTable, type Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { useApp } from '../context/AppContext';
import { fmtCurrency } from '../lib/metrics/calculations';
import { buildBudgetOptimization } from '../lib/budgetOptimization';
import type { BudgetPacingRow, BudgetProposal, OptimizationPreset, ProfitCurvePoint } from '../lib/budgetOptimization';
import { actionQueueBlockedReason, buildBudgetActionPackage, queueBudgetAction } from '../lib/actionQueue';

const PRESETS: OptimizationPreset[] = ['none', 'conservative', 'balanced', 'aggressive'];

type RowState = Record<string, string>;

function statusVariant(status: string): 'green' | 'amber' | 'red' | 'gray' {
  if (status === 'over') return 'red';
  if (status === 'under') return 'amber';
  if (status === 'on_track') return 'green';
  return 'gray';
}

function formatPercent(value: number | null): string {
  return value === null ? 'N/A' : `${value.toFixed(1)}%`;
}

function ProfitCurve({ points, currency }: { points: ProfitCurvePoint[]; currency: string }) {
  if (points.length === 0) return <div className="text-sm text-gray-400">No curve data.</div>;
  const minProfit = Math.min(...points.map((point) => point.profit), 0);
  const maxProfit = Math.max(...points.map((point) => point.profit), 1);
  const range = Math.max(maxProfit - minProfit, 1);
  const line = points.map((point, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 36 - ((point.profit - minProfit) / range) * 32;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <div>
      <svg viewBox="0 0 100 40" className="w-full h-48" role="img" aria-label="profit curve">
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500" />
      </svg>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {points.map((point) => (
          <div key={point.cost} className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
            <div className="font-medium">{fmtCurrency(point.cost, currency)}</div>
            <div className={point.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}>{fmtCurrency(point.profit, currency)}</div>
            <Badge variant={point.zone === 'optimal' ? 'green' : point.zone === 'loss' ? 'red' : 'amber'}>{point.zone}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BudgetOptimization() {
  const { data, settings } = useApp();
  const [preset, setPreset] = useState<OptimizationPreset>('balanced');
  const [rowState, setRowState] = useState<RowState>({});
  const model = useMemo(() => buildBudgetOptimization(data, settings, preset), [data, settings, preset]);
  const blockedReason = actionQueueBlockedReason(settings);

  const copyRow = async (row: BudgetProposal) => {
    try {
      await navigator.clipboard.writeText(buildBudgetActionPackage(row, settings).json);
      setRowState((prev) => ({ ...prev, [row.id]: 'copied' }));
      setTimeout(() => setRowState((prev) => ({ ...prev, [row.id]: '' })), 1500);
    } catch (e) {
      setRowState((prev) => ({ ...prev, [row.id]: String(e instanceof Error ? e.message : e) }));
    }
  };

  const pushRow = async (row: BudgetProposal) => {
    try {
      setRowState((prev) => ({ ...prev, [row.id]: 'working' }));
      await queueBudgetAction(row, settings);
      setRowState((prev) => ({ ...prev, [row.id]: 'queued' }));
    } catch (e) {
      setRowState((prev) => ({ ...prev, [row.id]: String(e instanceof Error ? e.message : e) }));
    }
  };

  const pacingColumns = useMemo<Column<BudgetPacingRow>[]>(() => [
    { key: 'campaignName', label: 'Campaign', render: (row) => <span className="font-medium text-gray-900">{row.campaignName}</span> },
    { key: 'dailyBudget', label: 'Daily budget', align: 'right', render: (row) => fmtCurrency(row.dailyBudget, settings.currency) },
    { key: 'dailyAverage', label: '30d avg', align: 'right', render: (row) => fmtCurrency(row.dailyAverage, settings.currency) },
    { key: 'monthProjection', label: 'Month proj.', align: 'right', render: (row) => fmtCurrency(row.monthProjection, settings.currency) },
    { key: 'next30Projection', label: 'Next 30d', align: 'right', render: (row) => fmtCurrency(row.next30Projection, settings.currency) },
    { key: 'utilization', label: 'Util.', align: 'right', render: (row) => `${(row.utilization * 100).toFixed(1)}%` },
    { key: 'cpa', label: 'CPA', align: 'right', render: (row) => row.cpa === null ? 'N/A' : fmtCurrency(row.cpa, settings.currency) },
    { key: 'roi', label: 'ROI', align: 'right', render: (row) => formatPercent(row.roi) },
    { key: 'status', label: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{row.status.replace('_', ' ')}</Badge> },
    { key: 'recommendedBudget', label: 'Recommended', align: 'right', render: (row) => fmtCurrency(row.recommendedBudget, settings.currency) },
  ], [settings.currency]);

  const proposalColumns = useMemo<Column<BudgetProposal>[]>(() => [
    { key: 'campaignName', label: 'Campaign' },
    { key: 'currentBudget', label: 'Current', align: 'right', render: (row) => fmtCurrency(row.currentBudget, settings.currency) },
    { key: 'proposedBudget', label: 'Proposal', align: 'right', render: (row) => fmtCurrency(row.proposedBudget, settings.currency) },
    { key: 'deltaPercent', label: 'Delta', align: 'right', render: (row) => `${row.deltaPercent.toFixed(1)}%` },
    { key: 'projectedProfitDelta', label: 'Profit impact', align: 'right', render: (row) => fmtCurrency(row.projectedProfitDelta, settings.currency) },
    { key: 'reason', label: 'Reason', render: (row) => <span className="text-xs text-gray-500">{row.reason}</span>, sortable: false },
    { key: 'proposalOnly', label: 'Scope', render: () => <Badge variant="blue">sheet queue</Badge>, sortable: false },
    { key: 'queue', label: 'Queue', sortable: false, render: (row) => <div className="flex items-center gap-2"><button disabled={Boolean(blockedReason) || rowState[row.id] === 'working'} title={blockedReason ?? ''} onClick={(event) => { event.stopPropagation(); void pushRow(row); }} className="px-2 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-40">{rowState[row.id] === 'working' ? 'Working' : rowState[row.id] === 'queued' ? 'Queued' : 'Queue'}</button><button onClick={(event) => { event.stopPropagation(); void copyRow(row); }} className="px-2 py-1 text-xs rounded border border-gray-200">{rowState[row.id] === 'copied' ? 'Copied' : 'Copy'}</button>{rowState[row.id] && !['working', 'queued', 'copied'].includes(rowState[row.id]) && <span className="text-xs text-red-600">{rowState[row.id]}</span>}</div> },
  ], [blockedReason, rowState, settings]);

  return (
    <PageContainer>
      <PageHeader
        title="Budget Optimization"
        description="Pacing, sheet-queue budget optimization, and ProfitMax curve from local Google/Voluum data"
        actions={(
          <select value={preset} onChange={(event) => setPreset(event.target.value as OptimizationPreset)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">
            {PRESETS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        )}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
        <Kpi label="Month progress" value={`${(model.monthProgressPercent * 100).toFixed(1)}%`} />
        <Kpi label="Cost" value={fmtCurrency(model.totalCost, settings.currency)} />
        <Kpi label="Configured budget" value={fmtCurrency(model.configuredMonthlyBudget, settings.currency)} />
        <Kpi label="Variance" value={fmtCurrency(model.variance, settings.currency)} />
        <Kpi label="Next 30 forecast" value={fmtCurrency(model.next30Forecast, settings.currency)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
        <Card>
          <CardHeader title="Profit Curve / ProfitMax" actions={<SlidersHorizontal size={14} className="text-gray-400" />} />
          <CardBody>
            <ProfitCurve points={model.profitCurve} currency={settings.currency} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Optimization proposals" />
          <CardBody>
            <DataTable columns={proposalColumns} data={model.proposals} emptyMessage="No sheet-queue budget changes for this preset." rowKey={(row) => row.id} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Campaign budget pacing" />
        <CardBody>
          <DataTable columns={pacingColumns} data={model.rows} emptyMessage="No campaign data for pacing." rowKey={(row) => row.campaignId} />
        </CardBody>
      </Card>

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800">
        {blockedReason ? `Queue disabled: ${blockedReason}` : 'Queue enabled. Rows are written to the Google Sheet action queue.'}
      </div>
    </PageContainer>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
