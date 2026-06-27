import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  RefreshCw, Loader2, Download, AlertTriangle, CheckCircle,
  XCircle, Minus, GitCompare, Info,
} from 'lucide-react';
import { PageContainer, PageHeader, Card, CardHeader, CardBody, EmptyState } from '../components/Layout';
import { useApp } from '../context/AppContext';
import {
  buildReconciledRecords, aggregateGadsByCampaign, aggregateNormalizedVoluumByCampaign,
} from '../lib/reconciliation/engine';
import type { ReconciledRecord, MatchType } from '../lib/reconciliation/types';
import { discrepancyLevel } from '../lib/reconciliation/types';
import { loadCampaignMappings, type CampaignMapping } from '../lib/googleAds/api';
import { fetchVoluumReport, resolveDateRange, type DateRangePreset } from '../lib/voluum/api';
import { normalizeRows } from '../lib/voluum/normalize';
import type { NormalizedVoluumRow } from '../lib/voluum/types';
import { fmtCurrency } from '../lib/metrics/calculations';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MATCH_LABELS: Record<MatchType, string> = {
  exact: 'Exact', fuzzy: 'Fuzzy', manual: 'Manual', unmatched: 'Unmatched',
};
const MATCH_COLORS: Record<MatchType, string> = {
  exact:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  fuzzy:     'bg-blue-50 text-blue-700 border-blue-200',
  manual:    'bg-violet-50 text-violet-700 border-violet-200',
  unmatched: 'bg-gray-100 text-gray-500 border-gray-200',
};
const DISC_COLORS = { low: 'text-emerald-600', medium: 'text-amber-600', high: 'text-red-600 font-semibold' };
const DISC_BG     = { low: 'bg-emerald-50', medium: 'bg-amber-50', high: 'bg-red-50' };

function MatchBadge({ type }: { type: MatchType }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${MATCH_COLORS[type]}`}>
      {type === 'exact' && <CheckCircle size={10} className="mr-1" />}
      {type === 'unmatched' && <XCircle size={10} className="mr-1" />}
      {type === 'fuzzy' && <Minus size={10} className="mr-1" />}
      {MATCH_LABELS[type]}
    </span>
  );
}

function DiscBadge({ pct }: { pct: number }) {
  const level = discrepancyLevel(pct);
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DISC_BG[level]} ${DISC_COLORS[level]}`}>
      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

const DATE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'today',     label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7',     label: 'Last 7d' },
  { value: 'last14',    label: 'Last 14d' },
  { value: 'last30',    label: 'Last 30d' },
];

function exportToCsv(rows: ReconciledRecord[]) {
  const headers = [
    'Campaign','Match Type','Confidence',
    'V Visits','V Clicks','V Conv','V Revenue','V Cost','V ROI',
    'G Clicks','G Impr','G Cost','G Conv','G CTR',
    'Click Disc','Click Disc %','Conv Disc','Cost Disc','True ROI','Attr Gap',
  ];
  const lines = rows.map((r) => [
    `"${r.campaignName}"`, r.matchType, r.matchConfidence.toFixed(2),
    r.voluum_visits, r.voluum_clicks, r.voluum_conversions,
    r.voluum_revenue.toFixed(2), r.voluum_cost.toFixed(2), (r.voluum_roi * 100).toFixed(1) + '%',
    r.gads_clicks, r.gads_impressions, r.gads_cost.toFixed(2),
    r.gads_conversions, (r.gads_ctr * 100).toFixed(2) + '%',
    r.click_discrepancy, r.click_discrepancy_pct.toFixed(1) + '%',
    r.conv_discrepancy, r.cost_discrepancy.toFixed(2),
    r.true_roi.toFixed(1) + '%', r.attribution_gap,
  ].join(','));
  const csv  = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'reconciliation.csv'; a.click();
  URL.revokeObjectURL(url);
}

type MatchFilter = 'all' | MatchType;
type DiscFilter  = 'all' | 'low' | 'medium' | 'high';

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CrossPlatformReconciliation() {
  const { data, settings } = useApp();

  const [voluumRows,   setVoluumRows]   = useState<NormalizedVoluumRow[]>([]);
  const [mappings,     setMappings]     = useState<CampaignMapping[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [lastSync,     setLastSync]     = useState<string | null>(null);
  const [isMock,       setIsMock]       = useState(false);
  const [preset,       setPreset]       = useState<DateRangePreset>('last7');
  const [matchFilter,  setMatchF]       = useState<MatchFilter>('all');
  const [discFilter,   setDiscF]        = useState<DiscFilter>('all');
  const [search,       setSearch]       = useState('');

  const sync = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mappingsResult, reportResult] = await Promise.all([
        loadCampaignMappings(),
        (async () => {
          const { from, to } = resolveDateRange(preset);
          return fetchVoluumReport({ from, to, groupBy: 'campaign', limit: 500 });
        })(),
      ]);
      setMappings(mappingsResult);

      if (reportResult.credentialsMissing) {
        setIsMock(true);
        setVoluumRows([]);
      } else {
        setIsMock(false);
        const { from, to } = resolveDateRange(preset);
        const dateRange = `${from.slice(0, 10)} / ${to.slice(0, 10)}`;
        setVoluumRows(normalizeRows(reportResult.rows ?? [], dateRange));
      }
      setLastSync(new Date().toISOString());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [preset]);

  useEffect(() => { sync(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const gadsAgg = useMemo(
    () => aggregateGadsByCampaign(data.campaigns),
    [data.campaigns]
  );

  const voluumAgg = useMemo(
    () => aggregateNormalizedVoluumByCampaign(voluumRows),
    [voluumRows]
  );

  const allRecords = useMemo(
    () => buildReconciledRecords(voluumAgg, gadsAgg, mappings),
    [voluumAgg, gadsAgg, mappings]
  );

  const filtered = useMemo(() => allRecords.filter((r) => {
    if (matchFilter !== 'all' && r.matchType !== matchFilter) return false;
    if (discFilter  !== 'all' && discrepancyLevel(r.click_discrepancy_pct) !== discFilter) return false;
    if (search && !r.campaignName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [allRecords, matchFilter, discFilter, search]);

  const summary = useMemo(() => {
    const totalRev  = allRecords.reduce((s, r) => s + r.voluum_revenue, 0);
    const totalCost = allRecords.reduce((s, r) => s + r.gads_cost, 0);
    return {
      totalGadsCost:  gadsAgg.reduce((s, r) => s + r.cost, 0),
      totalVRev:      voluumAgg.reduce((s, r) => s + r.revenue, 0),
      totalVConv:     voluumAgg.reduce((s, r) => s + r.conversions, 0),
      totalGConv:     gadsAgg.reduce((s, r) => s + r.conversions, 0),
      exactCount:     allRecords.filter((r) => r.matchType === 'exact').length,
      fuzzyCount:     allRecords.filter((r) => r.matchType === 'fuzzy').length,
      unmatchedCount: allRecords.filter((r) => r.matchType === 'unmatched').length,
      highDiscCount:  allRecords.filter((r) => discrepancyLevel(r.click_discrepancy_pct) === 'high').length,
      trueRoi:        totalCost > 0 ? ((totalRev - totalCost) / totalCost) * 100 : 0,
    };
  }, [allRecords, gadsAgg, voluumAgg]);

  const hasGads = data.campaigns.length > 0;

  return (
    <PageContainer>
      <PageHeader
        title="Cross-Platform Reconciliation"
        description="Voluum live API vs Google Ads campaigns — detect click, conversion, and cost discrepancies"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {DATE_PRESETS.map((p) => (
                <button key={p.value} onClick={() => setPreset(p.value)}
                  className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${preset === p.value ? 'bg-gray-900 text-white border-gray-900 font-medium' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={sync} disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Sync Voluum
            </button>
            <button onClick={() => exportToCsv(filtered)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Download size={12} /> CSV
            </button>
          </div>
        }
      />

      {/* Status banners */}
      {isMock && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 text-xs text-amber-800">
          <AlertTriangle size={13} />
          Voluum credentials not configured — no live data. Configure in the <strong>Voluum</strong> page.
        </div>
      )}
      {!isMock && lastSync && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 mb-4 text-xs text-emerald-800">
          <CheckCircle size={13} />
          Voluum synced · {voluumRows.length} campaigns · last sync {new Date(lastSync).toLocaleTimeString()}
        </div>
      )}
      {!hasGads && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 text-xs text-blue-800">
          <Info size={14} className="flex-shrink-0 mt-0.5" />
          Google Ads side is empty — import Google Ads campaign data via <strong>Import Data</strong> to enable matching.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4 text-xs text-red-700">
          <XCircle size={13} /> {error}
        </div>
      )}

      {!hasGads && voluumRows.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState message="Import Google Ads campaigns and sync Voluum to see cross-platform reconciliation." icon={<GitCompare size={32} />} />
          </CardBody>
        </Card>
      ) : (
        <>
          {/* KPI summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-5">
            {[
              { label: 'GAds Cost',   value: fmtCurrency(summary.totalGadsCost, settings.currency) },
              { label: 'Voluum Rev',  value: fmtCurrency(summary.totalVRev, settings.currency) },
              { label: 'True ROI',    value: `${summary.trueRoi.toFixed(1)}%`, color: summary.trueRoi >= 0 ? 'text-emerald-600' : 'text-red-600' },
              { label: 'V Conv',      value: summary.totalVConv.toLocaleString() },
              { label: 'G Conv',      value: summary.totalGConv.toLocaleString() },
              { label: 'Exact',       value: String(summary.exactCount),     color: 'text-emerald-600' },
              { label: 'Fuzzy',       value: String(summary.fuzzyCount),     color: 'text-blue-600' },
              { label: 'High Disc.',  value: String(summary.highDiscCount),  color: summary.highDiscCount > 0 ? 'text-red-600' : 'text-gray-400' },
            ].map(({ label, value, color = 'text-gray-900' }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                <div className="text-xs text-gray-500 mb-1">{label}</div>
                <div className={`text-lg font-bold leading-none ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <Card className="mb-4">
            <CardBody className="flex flex-wrap gap-3 items-end">
              <div>
                <div className="text-xs font-medium text-gray-600 mb-1">Match Type</div>
                <div className="flex gap-1">
                  {(['all', 'exact', 'fuzzy', 'manual', 'unmatched'] as const).map((v) => (
                    <button key={v} onClick={() => setMatchF(v)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-colors capitalize ${matchFilter === v ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                      {v === 'all' ? 'All' : MATCH_LABELS[v]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-600 mb-1">Discrepancy</div>
                <div className="flex gap-1">
                  {([['all','All'],['low','<5%'],['medium','5–15%'],['high','>15%']] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setDiscF(v)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${discFilter === v ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="text-xs font-medium text-gray-600 mb-1">Search</div>
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Campaign name…"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="text-xs text-gray-400 self-center">{filtered.length} / {allRecords.length} rows</div>
            </CardBody>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader title="Campaign Reconciliation" />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="px-4 py-3 text-left font-medium">Campaign</th>
                    <th className="px-3 py-3 text-center font-medium">Match</th>
                    <th className="px-3 py-3 text-right font-medium">V Clicks</th>
                    <th className="px-3 py-3 text-right font-medium">G Clicks</th>
                    <th className="px-3 py-3 text-center font-medium">Disc %</th>
                    <th className="px-3 py-3 text-right font-medium">V Conv</th>
                    <th className="px-3 py-3 text-right font-medium">G Conv</th>
                    <th className="px-3 py-3 text-right font-medium">V Cost</th>
                    <th className="px-3 py-3 text-right font-medium">G Cost</th>
                    <th className="px-3 py-3 text-right font-medium">True ROI</th>
                    <th className="px-3 py-3 text-right font-medium">Attr Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const level = discrepancyLevel(r.click_discrepancy_pct);
                    return (
                      <tr key={r.campaignName} className={`border-b border-gray-50 hover:bg-gray-50/40 transition-colors ${level === 'high' ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[220px]">
                          <div className="truncate" title={r.campaignName}>{r.campaignName}</div>
                          {r.matchType === 'fuzzy' && (
                            <div className="text-gray-400 font-normal text-xs">{(r.matchConfidence * 100).toFixed(0)}% similarity</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center"><MatchBadge type={r.matchType} /></td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{r.voluum_clicks.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{r.gads_clicks.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-center">
                          {r.matchType !== 'unmatched' ? <DiscBadge pct={r.click_discrepancy_pct} /> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{r.voluum_conversions.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{r.gads_conversions.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{fmtCurrency(r.voluum_cost, settings.currency)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{fmtCurrency(r.gads_cost, settings.currency)}</td>
                        <td className={`px-3 py-2.5 text-right font-medium ${r.true_roi >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {r.matchType !== 'unmatched' ? `${r.true_roi.toFixed(1)}%` : '—'}
                        </td>
                        <td className={`px-3 py-2.5 text-right ${r.attribution_gap > 0 ? 'text-blue-600' : r.attribution_gap < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {r.matchType !== 'unmatched' ? (r.attribution_gap > 0 ? `+${r.attribution_gap}` : String(r.attribution_gap)) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="py-12 text-center text-sm text-gray-400">No records match the current filters.</div>
              )}
            </div>
          </Card>
        </>
      )}
    </PageContainer>
  );
}
