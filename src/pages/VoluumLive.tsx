import { useState, useEffect, useCallback } from 'react';
import {
  Activity, RefreshCw, Loader2, AlertTriangle, CheckCircle,
  XCircle, TrendingUp, TrendingDown, Minus, Search,
} from 'lucide-react';
import { PageContainer, PageHeader, Card, CardHeader, CardBody, EmptyState } from '../components/Layout';
import type {
  NormalizedVoluumRow, VoluumHealth, VoluumRecommendation,
  GroupBy, RecommendationAction,
} from '../lib/voluum/types';
import { normalizeRows, computeTotals, fmtMoney, fmtPct, fmtOrDash } from '../lib/voluum/normalize';
import { buildRecommendations } from '../lib/voluum/recommendations';
import {
  fetchVoluumHealth, fetchVoluumReport, resolveDateRange,
  type DateRangePreset,
} from '../lib/voluum/api';

// ─── Mock data for demo mode ──────────────────────────────────────────────────

const MOCK_ROWS: NormalizedVoluumRow[] = [
  { campaignId: 'm1', campaignName: 'Demo — Installment Loans US', visits: 4820, clicks: 2150, conversions: 38, cost: 312.50, revenue: 1330.00, profit: 1017.50, roi: 3.26, ctr: 0.446, cvr: 0.018, epc: 0.619, cpa: 8.22, dateRange: 'demo', source: 'voluum-mock' },
  { campaignId: 'm2', campaignName: 'Demo — Credit Solutions TX',  visits: 2340, clicks: 890,  conversions: 12, cost: 145.00, revenue: 420.00,  profit: 275.00,  roi: 1.90, ctr: 0.380, cvr: 0.013, epc: 0.472, cpa: 12.08, dateRange: 'demo', source: 'voluum-mock' },
  { campaignId: 'm3', campaignName: 'Demo — Financial Funding CA', visits: 1900, clicks: 780,  conversions: 0,  cost: 220.00, revenue: 0,         profit: -220.00, roi: -1.0, ctr: 0.411, cvr: 0,     epc: 0,     cpa: 0,    dateRange: 'demo', source: 'voluum-mock' },
  { campaignId: 'm4', campaignName: 'Demo — Bad Credit Help',      visits: 890,  clicks: 72,   conversions: 2,  cost: 18.00,  revenue: 70.00,      profit: 52.00,   roi: 2.89, ctr: 0.081, cvr: 0.028, epc: 0.972, cpa: 9.00, dateRange: 'demo', source: 'voluum-mock' },
  { campaignId: 'm5', campaignName: 'Demo — Fast Approval Loans',  visits: 560,  clicks: 420,  conversions: 0,  cost: 0,      revenue: 0,          profit: 0,       roi: 0,    ctr: 0.750, cvr: 0,     epc: 0,     cpa: 0,    dateRange: 'demo', source: 'voluum-mock' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConnectionCard({ health, onRefresh }: { health: VoluumHealth | null; onRefresh: () => void }) {
  if (!health) return null;
  const ok = health.connected && !health.credentialsMissing;
  return (
    <div className={`flex items-center justify-between rounded-xl border px-5 py-3 mb-4 ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-center gap-3">
        {ok
          ? <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
          : <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />}
        <div>
          <div className={`text-sm font-medium ${ok ? 'text-emerald-800' : 'text-amber-800'}`}>
            {health.credentialsMissing ? 'Demo Mode — Credentials not configured' : ok ? 'Connected to Voluum' : `Connection error: ${health.error}`}
          </div>
          {health.tokenExpiresAt && (
            <div className="text-xs text-emerald-600">Token expires {new Date(health.tokenExpiresAt).toLocaleTimeString()}</div>
          )}
          {health.credentialsMissing && (
            <div className="text-xs text-amber-700">Set VOLUUM_ACCESS_ID and VOLUUM_ACCESS_KEY in Supabase Edge Function secrets to connect live data.</div>
          )}
        </div>
      </div>
      <button onClick={onRefresh} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
        <RefreshCw size={12} /> Recheck
      </button>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-gray-900 leading-none">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

const ACTION_STYLES: Record<RecommendationAction, { bg: string; text: string; icon: React.ReactNode }> = {
  SCALE:       { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: <TrendingUp  size={11} /> },
  WATCH:       { bg: 'bg-blue-50',    text: 'text-blue-700',    icon: <Minus       size={11} /> },
  CUT:         { bg: 'bg-red-50',     text: 'text-red-700',     icon: <TrendingDown size={11} /> },
  INVESTIGATE: { bg: 'bg-amber-50',   text: 'text-amber-700',   icon: <Search      size={11} /> },
};

function ActionBadge({ action }: { action: RecommendationAction }) {
  const s = ACTION_STYLES[action];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      {s.icon} {action}
    </span>
  );
}

const DATE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'today',     label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7',     label: 'Last 7 days' },
  { value: 'last14',    label: 'Last 14 days' },
  { value: 'last30',    label: 'Last 30 days' },
];

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'campaign',       label: 'Campaign' },
  { value: 'offer',          label: 'Offer' },
  { value: 'landingPage',    label: 'Landing Page' },
  { value: 'country',        label: 'Country' },
  { value: 'device',         label: 'Device' },
  { value: 'keyword',        label: 'Keyword' },
  { value: 'customVariable', label: 'Custom Variable' },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export function VoluumLive() {
  const [health,       setHealth]       = useState<VoluumHealth | null>(null);
  const [rows,         setRows]         = useState<NormalizedVoluumRow[]>([]);
  const [recommendations, setRecs]      = useState<VoluumRecommendation[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [lastSync,     setLastSync]     = useState<string | null>(null);
  const [isMock,       setIsMock]       = useState(false);

  const [preset,       setPreset]       = useState<DateRangePreset>('last7');
  const [groupBy,      setGroupBy]      = useState<GroupBy>('campaign');
  const [filterName,   setFilterName]   = useState('');

  const checkHealth = useCallback(async () => {
    try {
      const h = await fetchVoluumHealth();
      setHealth(h);
      return h;
    } catch {
      const fallback: VoluumHealth = { connected: false, credentialsMissing: true, tokenExpiresAt: null, lastCheckedAt: new Date().toISOString() };
      setHealth(fallback);
      return fallback;
    }
  }, []);

  const sync = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const h = await checkHealth();

      if (h.credentialsMissing) {
        // Demo mode
        const filtered = filterName
          ? MOCK_ROWS.filter((r) => r.campaignName.toLowerCase().includes(filterName.toLowerCase()))
          : MOCK_ROWS;
        setRows(filtered);
        setRecs(buildRecommendations(filtered));
        setIsMock(true);
        setLastSync(new Date().toISOString());
        return;
      }

      setIsMock(false);
      const { from, to } = resolveDateRange(preset);
      const raw = await fetchVoluumReport({ from, to, groupBy, campaignName: filterName || undefined });
      const dateRange = `${from.slice(0, 10)} / ${to.slice(0, 10)}`;
      const normalized = normalizeRows(raw.rows ?? [], dateRange);
      setRows(normalized);
      setRecs(buildRecommendations(normalized));
      setLastSync(new Date().toISOString());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [checkHealth, preset, groupBy, filterName]);

  // Initial load
  useEffect(() => { sync(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = computeTotals(rows);

  // Map recommendations by entity name for the table
  const recMap = Object.fromEntries(recommendations.map((r) => [r.entityName, r]));

  return (
    <PageContainer>
      <PageHeader
        title="Voluum"
        description="Live campaign performance from Voluum tracker"
        actions={
          <button
            onClick={sync}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Sync Voluum Now
          </button>
        }
      />

      {/* Connection status */}
      <ConnectionCard health={health} onRefresh={checkHealth} />

      {isMock && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4">
          <AlertTriangle size={13} />
          Showing demo data. Configure Voluum credentials to see live data.
        </div>
      )}

      {/* Controls */}
      <Card className="mb-4">
        <CardBody className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date Range</label>
            <div className="flex gap-1">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPreset(p.value)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    preset === p.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Group By</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              {GROUP_BY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Campaign Filter</label>
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Contains name…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={sync}
            disabled={loading}
            className="px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            Apply
          </button>

          {lastSync && (
            <div className="text-xs text-gray-400 self-center">
              Last sync {new Date(lastSync).toLocaleTimeString()}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
          <XCircle size={16} className="flex-shrink-0 mt-0.5" />
          <div><span className="font-medium">Error:</span> {error}</div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-3 mb-4">
        <KpiCard label="Visits"      value={totals.visits.toLocaleString()} />
        <KpiCard label="Clicks"      value={totals.clicks.toLocaleString()} />
        <KpiCard label="Conversions" value={totals.conversions.toLocaleString()} />
        <KpiCard label="Cost"        value={fmtMoney(totals.cost)} />
        <KpiCard label="Revenue"     value={fmtMoney(totals.revenue)} />
        <KpiCard label="Profit"      value={fmtMoney(totals.profit)} sub={totals.profit >= 0 ? undefined : 'Loss'} />
        <KpiCard label="ROI"         value={fmtPct(totals.roi, 1)} />
        <KpiCard label="CPA"         value={fmtOrDash(totals.cpa)} />
        <KpiCard label="EPC"         value={fmtOrDash(totals.epc)} />
      </div>

      {/* Data table */}
      <Card>
        <CardHeader
          title={`Results (${rows.length} rows)`}
          actions={
            isMock ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">DEMO</span> : undefined
          }
        />
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 size={20} className="animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState message="No data — run a sync or adjust the date range." icon={<Activity size={32} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="px-4 py-3 text-left font-medium">Campaign / Entity</th>
                  <th className="px-3 py-3 text-right font-medium">Visits</th>
                  <th className="px-3 py-3 text-right font-medium">Clicks</th>
                  <th className="px-3 py-3 text-right font-medium">Conv.</th>
                  <th className="px-3 py-3 text-right font-medium">Cost</th>
                  <th className="px-3 py-3 text-right font-medium">Revenue</th>
                  <th className="px-3 py-3 text-right font-medium">Profit</th>
                  <th className="px-3 py-3 text-right font-medium">ROI</th>
                  <th className="px-3 py-3 text-right font-medium">CPA</th>
                  <th className="px-4 py-3 text-left font-medium">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const rec = recMap[row.campaignName];
                  const profitColor = row.profit > 0 ? 'text-emerald-600' : row.profit < 0 ? 'text-red-600' : 'text-gray-500';
                  return (
                    <tr key={row.campaignId || row.campaignName} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[220px] truncate" title={row.campaignName}>
                        {row.campaignName}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{row.visits.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{row.clicks.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{row.conversions}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{fmtMoney(row.cost)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{fmtMoney(row.revenue)}</td>
                      <td className={`px-3 py-2.5 text-right font-medium ${profitColor}`}>{fmtMoney(row.profit)}</td>
                      <td className={`px-3 py-2.5 text-right font-medium ${row.roi >= 0.5 ? 'text-emerald-600' : row.roi < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {fmtPct(row.roi, 1)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{fmtOrDash(row.cpa)}</td>
                      <td className="px-4 py-2.5">
                        {rec ? (
                          <div>
                            <ActionBadge action={rec.action} />
                            <div className="text-xs text-gray-400 mt-0.5 max-w-[180px] truncate" title={rec.reason}>{rec.reason}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
