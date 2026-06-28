import { useMemo, useState } from 'react';
import { BarChart2, Globe2, Layers3, Network, ShieldCheck } from 'lucide-react';
import { PageContainer, PageHeader } from '../components/Layout';
import { KPICard } from '../components/KPICard';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { useApp } from '../context/AppContext';
import { buildAdvancedViews } from '../lib/advancedViews';
import type { AdvancedBucket, AdvancedProposal, AllocationRow, SegmentPerformanceRow, TreemapRow } from '../lib/advancedViews';

type TabId = 'allocation' | 'geo' | 'placements' | 'treemap' | 'pmax';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'allocation', label: 'Allocation' },
  { id: 'geo', label: 'Geo' },
  { id: 'placements', label: 'Placements' },
  { id: 'treemap', label: 'Treemap' },
  { id: 'pmax', label: 'PMax Assets' },
];

function currency(value: number, code: string): string {
  return `${code || 'THB'} ${value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function percent(value: number | null): string {
  return value === null ? 'N/A' : `${value.toFixed(1)}%`;
}

function bucketVariant(bucket: AdvancedBucket): 'green' | 'amber' | 'red' | 'gray' | 'blue' {
  if (bucket === 'Profitable') return 'green';
  if (bucket === 'Costly' || bucket === 'Zero Conv') return 'red';
  if (bucket === 'Low Data') return 'gray';
  return 'amber';
}

function exportProposals(proposals: AdvancedProposal[]): void {
  const header = 'kind,entity,campaign,cost,proposal_only,remote_apply_allowed,reason';
  const body = proposals.map((row) => [
    row.kind,
    csv(row.entity),
    csv(row.campaign),
    row.cost.toFixed(2),
    'true',
    'false',
    csv(row.reason),
  ].join(',')).join('\n');
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `advanced-view-proposals-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdvancedViews() {
  const { data, settings } = useApp();
  const [activeTab, setActiveTab] = useState<TabId>('allocation');
  const [query, setQuery] = useState('');
  const model = useMemo(() => buildAdvancedViews(data, settings), [data, settings]);
  const normalizedQuery = query.trim().toLowerCase();

  const allocationColumns = useMemo<Column<AllocationRow>[]>(() => [
    { key: 'campaign', label: 'Campaign' },
    { key: 'channel', label: 'Channel' },
    { key: 'cost', label: 'Cost', align: 'right', render: (row) => currency(row.cost, settings.currency) },
    { key: 'spendShare', label: 'Spend Share', align: 'right', render: (row) => `${(row.spendShare * 100).toFixed(1)}%` },
    { key: 'conversions', label: 'Conv.', align: 'right', render: (row) => row.conversions.toFixed(1) },
    { key: 'cpa', label: 'CPA', align: 'right', render: (row) => row.cpa === null ? 'N/A' : currency(row.cpa, settings.currency) },
    { key: 'roi', label: 'ROI', align: 'right', render: (row) => percent(row.roi) },
    { key: 'profit', label: 'Profit', align: 'right', render: (row) => currency(row.profit, settings.currency) },
  ], [settings.currency]);

  const segmentColumns = useMemo<Column<SegmentPerformanceRow>[]>(() => [
    { key: 'label', label: 'Segment' },
    { key: 'campaign', label: 'Campaign' },
    { key: 'cost', label: 'Cost', align: 'right', render: (row) => currency(row.cost, settings.currency) },
    { key: 'conversions', label: 'Conv.', align: 'right', render: (row) => row.conversions.toFixed(1) },
    { key: 'cpa', label: 'CPA', align: 'right', render: (row) => row.cpa === null ? 'N/A' : currency(row.cpa, settings.currency) },
    { key: 'roi', label: 'ROI', align: 'right', render: (row) => percent(row.roi) },
    { key: 'bucket', label: 'Bucket', render: (row) => <Badge variant={bucketVariant(row.bucket)}>{row.bucket}</Badge> },
    { key: 'reviewStatus', label: 'Review', render: (row) => <Badge variant="blue">{row.reviewStatus.replace(/_/g, ' ')}</Badge> },
    { key: 'remoteApplyAllowed', label: 'Apply', render: () => <Badge variant="gray">Proposal only</Badge> },
  ], [settings.currency]);

  const treemapColumns = useMemo<Column<TreemapRow>[]>(() => [
    { key: 'level', label: 'Level', render: (row) => <Badge variant="purple">{row.level.replace(/_/g, ' ')}</Badge> },
    { key: 'label', label: 'Entity' },
    { key: 'parent', label: 'Parent' },
    { key: 'cost', label: 'Cost', align: 'right', render: (row) => currency(row.cost, settings.currency) },
    { key: 'share', label: 'Share', align: 'right', render: (row) => `${(row.share * 100).toFixed(1)}%` },
    { key: 'conversions', label: 'Conv.', align: 'right', render: (row) => row.conversions.toFixed(1) },
    { key: 'profit', label: 'Profit', align: 'right', render: (row) => currency(row.profit, settings.currency) },
    { key: 'bucket', label: 'Bucket', render: (row) => <Badge variant={bucketVariant(row.bucket)}>{row.bucket}</Badge> },
  ], [settings.currency]);

  const filteredAllocation = model.allocation.filter((row) => matchesQuery([row.campaign, row.channel, row.accountId], normalizedQuery));
  const filteredGeo = model.geo.filter((row) => matchesQuery([row.label, row.campaign, row.signal], normalizedQuery));
  const filteredPlacements = model.placements.filter((row) => matchesQuery([row.label, row.campaign, row.signal], normalizedQuery));
  const filteredTreemap = model.treemap.filter((row) => matchesQuery([row.label, row.parent, row.level], normalizedQuery));
  const filteredPmax = model.pmaxAssets.filter((row) => matchesQuery([row.label, row.parent, row.level], normalizedQuery));

  return (
    <PageContainer>
      <PageHeader
        title="MCC Advanced Views"
        description="Allocation, geo, placements, treemap, and PMax asset views. Exclusion ideas stay proposal-only."
        actions={
          <button
            type="button"
            onClick={() => exportProposals(model.proposals)}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            Export proposals
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total Spend" value={currency(model.summary.totalCost, settings.currency)} icon={<BarChart2 size={18} />} />
        <KPICard label="Profit" value={currency(model.summary.totalProfit, settings.currency)} color={model.summary.totalProfit >= 0 ? 'green' : 'red'} icon={<Network size={18} />} />
        <KPICard label="Segments" value={model.summary.geoRows + model.summary.placementRows} sub={`${model.summary.geoRows} geo · ${model.summary.placementRows} placements`} icon={<Globe2 size={18} />} />
        <KPICard label="Proposal-only" value={model.summary.proposalOnlyCandidates} sub="No v1 remote apply path" color="blue" icon={<ShieldCheck size={18} />} />
      </div>

      {model.summary.staleFailClosed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Google sync is stale or failed. Advanced views remain visible for diagnosis, but all exclusion/allocation ideas are fail-closed and proposal-only.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  activeTab === tab.id ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search campaign, segment, asset…"
            className="w-full md:w-72 px-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
        </div>

        {activeTab === 'allocation' && (
          <DataTable columns={allocationColumns} data={filteredAllocation} emptyMessage="No campaign allocation data imported." rowKey={(row) => row.id} />
        )}
        {activeTab === 'geo' && (
          <DataTable columns={segmentColumns} data={filteredGeo} emptyMessage="No geo performance data imported." rowKey={(row) => row.id} />
        )}
        {activeTab === 'placements' && (
          <DataTable columns={segmentColumns} data={filteredPlacements} emptyMessage="No placement performance data imported." rowKey={(row) => row.id} />
        )}
        {activeTab === 'treemap' && (
          <DataTable columns={treemapColumns} data={filteredTreemap} emptyMessage="No treemap source data imported." rowKey={(row) => row.id} />
        )}
        {activeTab === 'pmax' && (
          <DataTable columns={treemapColumns} data={filteredPmax} emptyMessage="No PMax asset performance data imported." rowKey={(row) => row.id} />
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Layers3 size={16} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">Review Queue Preview</h3>
          <Badge variant="gray">export only</Badge>
        </div>
        <DataTable
          columns={[
            { key: 'kind', label: 'Kind', render: (row) => <Badge variant="amber">{row.kind.replace(/_/g, ' ')}</Badge> },
            { key: 'entity', label: 'Entity' },
            { key: 'campaign', label: 'Campaign' },
            { key: 'cost', label: 'Cost', align: 'right', render: (row) => currency(row.cost, settings.currency) },
            { key: 'remoteApplyAllowed', label: 'Apply', render: () => <Badge variant="gray">remoteApplyAllowed=false</Badge> },
            { key: 'reason', label: 'Reason' },
          ] satisfies Column<AdvancedProposal>[]}
          data={model.proposals}
          emptyMessage="No geo, placement, or allocation proposals."
          rowKey={(row) => row.id}
        />
      </div>
    </PageContainer>
  );
}

function matchesQuery(values: string[], query: string): boolean {
  return !query || values.some((value) => value.toLowerCase().includes(query));
}

function csv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
