import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart2,
  Clock,
  DollarSign,
  Layers,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { PageContainer, PageHeader, Card, CardBody, CardHeader } from '../components/Layout';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { NavLink } from '../lib/router';
import { useApp } from '../context/AppContext';
import { buildMccDashboard } from '../lib/mccDashboard';
import type { DashboardTone, MccAccountRow, MccSparkPoint, MccSummaryCard } from '../lib/mccDashboard';
import { relativeTime } from '../lib/syncHealth';

const TONE_CLASS: Record<DashboardTone, { text: string; bg: string; border: string; dot: string }> = {
  ok: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  warn: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
  error: { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' },
  safe: { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500' },
  missing: { text: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400' },
};

function ToneBadge({ tone, children }: { tone: DashboardTone; children: ReactNode }) {
  const cfg = TONE_CLASS[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {children}
    </span>
  );
}

function SummaryCard({ card }: { card: MccSummaryCard }) {
  const icons: Record<string, ReactNode> = {
    total_cost: <DollarSign size={16} />,
    conversions: <TrendingUp size={16} />,
    true_value: <DollarSign size={16} />,
    cpa: <BarChart2 size={16} />,
    roi_roas: <Activity size={16} />,
    projected_month_spend: <Clock size={16} />,
    alerts: <AlertTriangle size={16} />,
  };
  const cfg = TONE_CLASS[card.tone];

  return (
    <div className={`bg-white rounded-xl border p-4 shadow-sm ${cfg.border}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</span>
        <span className={cfg.text}>{icons[card.id] ?? <Activity size={16} />}</span>
      </div>
      <div className={`text-2xl font-bold ${cfg.text}`}>{card.displayValue}</div>
      <div className="mt-3 space-y-1 text-xs text-gray-500">
        <p><span className="font-medium text-gray-700">Meaning:</span> {card.meaning}</p>
        <p><span className="font-medium text-gray-700">Action:</span> {card.action}</p>
        <p><span className="font-medium text-gray-700">Outcome:</span> {card.outcome}</p>
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: MccSparkPoint[] }) {
  if (points.length === 0) {
    return <span className="text-xs text-gray-400">No spend</span>;
  }

  const maxCost = Math.max(...points.map((point) => point.cost), 1);
  const polyline = points
    .map((point, index) => {
      const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
      const y = 32 - (point.cost / maxCost) * 28;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 36" className="w-28 h-9" role="img" aria-label="30-day cost sparkline">
      <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500" />
    </svg>
  );
}

function AlertChips({ row }: { row: MccAccountRow }) {
  if (row.alerts.length === 0) {
    return <ToneBadge tone="ok">Clear</ToneBadge>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {row.alerts.slice(0, 3).map((alert) => (
        <NavLink
          key={alert.id}
          to={alert.drillHref}
          className={`px-2 py-1 rounded-full text-xs font-medium border ${
            alert.level === 'critical'
              ? 'bg-red-50 border-red-200 text-red-700'
              : alert.level === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-gray-50 border-gray-200 text-gray-600'
          }`}
        >
          {alert.label}
        </NavLink>
      ))}
      {row.alerts.length > 3 && <span className="text-xs text-gray-400">+{row.alerts.length - 3}</span>}
    </div>
  );
}

function formatCurrency(value: number, currency: string): string {
  return `${currency || 'THB'} ${value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function formatPercent(value: number | null): string {
  return value === null ? 'N/A' : `${value.toFixed(1)}%`;
}

export function Overview() {
  const { data, settings, refreshData } = useApp();
  const [search, setSearch] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const model = useMemo(() => buildMccDashboard(data, settings), [data, settings]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return model.accountRows.filter((row) => {
      const accountMatches = !selectedAccountId || row.id === selectedAccountId;
      const queryMatches = !query || [row.name, row.accountId, row.customerId, row.sourceSheetId]
        .some((value) => value.toLowerCase().includes(query));
      return accountMatches && queryMatches;
    });
  }, [model.accountRows, search, selectedAccountId]);

  const columns = useMemo<Column<MccAccountRow>[]>(() => [
    {
      key: 'name',
      label: 'Account',
      render: (row) => (
        <div>
          <div className="font-medium text-gray-900">{row.name}</div>
          <div className="text-xs text-gray-400">{row.accountId} / {row.customerId}</div>
        </div>
      ),
    },
    { key: 'sparkline', label: '30d', render: (row) => <Sparkline points={row.sparkline} />, sortable: false },
    { key: 'cost', label: 'Cost', align: 'right', render: (row) => formatCurrency(row.cost, settings.currency) },
    { key: 'conversions', label: 'Conv.', align: 'right', render: (row) => row.conversions.toFixed(1) },
    { key: 'value', label: 'Value', align: 'right', render: (row) => formatCurrency(row.value, settings.currency) },
    { key: 'cpa', label: 'CPA', align: 'right', render: (row) => row.cpa === null ? 'N/A' : formatCurrency(row.cpa, settings.currency) },
    { key: 'roi', label: 'ROI', align: 'right', render: (row) => formatPercent(row.roi) },
    { key: 'roas', label: 'ROAS', align: 'right', render: (row) => formatPercent(row.roas) },
    { key: 'projectedMonthSpend', label: 'Month proj.', align: 'right', render: (row) => formatCurrency(row.projectedMonthSpend, settings.currency) },
    { key: 'alerts', label: 'Alerts', render: (row) => <AlertChips row={row} />, sortable: false },
    {
      key: 'drillHref',
      label: 'Drill',
      align: 'center',
      render: (row) => <NavLink to={row.drillHref} className="text-xs font-medium text-blue-600 hover:text-blue-800">Open</NavLink>,
      sortable: false,
    },
  ], [settings.currency]);

  const hasData = data.campaigns.length > 0 || model.accountRows.length > 0;

  return (
    <PageContainer>
      <PageHeader
        title="MCC Overview"
        description={hasData ? 'Read-only multi-account control view from imported Google Ads and Voluum data' : undefined}
      />

      <Card className="mb-4">
        <CardBody>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span>Action mode:</span>
              <ToneBadge tone={model.visibleActionMode === 'disabled' ? 'safe' : 'ok'}>
                {model.visibleActionMode === 'disabled' ? 'Disabled' : 'Review only'}
              </ToneBadge>
            </div>
            {model.freshness.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-sm text-gray-600">
                <ToneBadge tone={item.tone}>
                  {item.label}: {item.status}
                  {item.runsToday !== null && item.expectedRunsToday !== null ? ` ${item.runsToday}/${item.expectedRunsToday}` : ` ${item.rows} rows`}
                </ToneBadge>
                {item.lastAt && <span className="text-xs text-gray-400">{relativeTime(item.lastAt)}</span>}
              </div>
            ))}
            <button
              type="button"
              onClick={refreshData}
              className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw size={14} />
              Refresh local
            </button>
            <NavLink to="/settings" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              <Settings size={14} />
              Settings
            </NavLink>
          </div>
        </CardBody>
      </Card>

      {!hasData && (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <Layers size={40} className="text-gray-300 mx-auto mb-3" />
              <h3 className="text-gray-600 font-medium mb-1">No data imported yet</h3>
              <p className="text-gray-400 text-sm">Go to Import Data to load your Google Ads CSV exports.</p>
            </div>
          </CardBody>
        </Card>
      )}

      {hasData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {model.summaryCards.map((card) => <SummaryCard key={card.id} card={card} />)}
          </div>

          <Card>
            <CardHeader
              title="Account control table"
              actions={(
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search accounts"
                      className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <select
                    value={selectedAccountId}
                    onChange={(event) => setSelectedAccountId(event.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">All accounts</option>
                    {model.accountRows.map((row) => (
                      <option key={row.id} value={row.id}>{row.name}</option>
                    ))}
                  </select>
                </div>
              )}
            />
            <CardBody>
              <p className="text-xs text-gray-500 mb-3">
                Cost, conversions, value, CPA, ROI/ROAS, pacing, freshness, and drill-through alerts.
              </p>
              <DataTable
                columns={columns}
                data={filteredRows}
                emptyMessage="No accounts match the current filter."
                rowKey={(row) => row.id}
              />
            </CardBody>
          </Card>

          {!model.hasVoluum && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-center gap-2">
              <AlertTriangle size={16} className="flex-shrink-0" />
              Voluum data is not connected. Revenue and conversion metrics fall back to Google Ads conversion value until Voluum CSV is imported.
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
