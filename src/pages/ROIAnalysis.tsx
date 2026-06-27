import { useState, useMemo, useEffect, useCallback } from 'react';
import { TrendingUp, DollarSign, Target, Info, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { PageContainer, PageHeader, Card, CardHeader, CardBody, EmptyState } from '../components/Layout';
import { useApp } from '../context/AppContext';
import {
  buildReconciledRecords, aggregateGadsByCampaign, aggregateNormalizedVoluumByCampaign,
} from '../lib/reconciliation/engine';
import { fetchVoluumReport, resolveDateRange, type DateRangePreset } from '../lib/voluum/api';
import { normalizeRows } from '../lib/voluum/normalize';
import type { NormalizedVoluumRow } from '../lib/voluum/types';
import { fmtCurrency } from '../lib/metrics/calculations';

const DATE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'last7',  label: 'Last 7d' },
  { value: 'last14', label: 'Last 14d' },
  { value: 'last30', label: 'Last 30d' },
];

// ─── Mini bar pair (pure CSS) ─────────────────────────────────────────────────

function BarPair({ label, aVal, bVal, aLabel, bLabel, aColor, bColor, fmt }: {
  label: string; aVal: number; bVal: number;
  aLabel: string; bLabel: string; aColor: string; bColor: string;
  fmt: (n: number) => string;
}) {
  const max  = Math.max(Math.abs(aVal), Math.abs(bVal), 0.01);
  const aPct = (Math.abs(aVal) / max) * 100;
  const bPct = (Math.abs(bVal) / max) * 100;
  return (
    <div className="py-2 border-b border-gray-50 last:border-0">
      <div className="text-xs text-gray-600 mb-1.5 truncate" title={label}>{label}</div>
      {[
        { pct: aPct, color: aColor, lbl: aLabel, val: aVal },
        { pct: bPct, color: bColor, lbl: bLabel, val: bVal },
      ].map(({ pct, color, lbl, val }) => (
        <div key={lbl} className="flex items-center gap-2 mb-0.5">
          <div className="w-20 text-right text-xs text-gray-500 flex-shrink-0">{lbl}</div>
          <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
            <div className={`h-full rounded ${color} transition-all`} style={{ width: `${pct}%` }} />
          </div>
          <div className="w-20 text-xs font-medium text-gray-700">{fmt(val)}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Funnel step ──────────────────────────────────────────────────────────────

function FunnelStep({ label, value, sub, pct, color }: {
  label: string; value: string; sub?: string; pct?: number; color: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className={`w-full ${color} rounded-xl px-4 py-4 text-center`}>
        <div className="text-xs text-white/70 mb-0.5">{label}</div>
        <div className="text-2xl font-bold text-white leading-none">{value}</div>
        {sub && <div className="text-xs text-white/70 mt-0.5">{sub}</div>}
      </div>
      {pct !== undefined && (
        <div className="flex flex-col items-center my-1">
          <div className="w-0.5 h-3 bg-gray-300" />
          <div className="text-xs text-gray-500 font-medium">{pct.toFixed(1)}%</div>
          <div className="w-0.5 h-3 bg-gray-300" />
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ROIAnalysis() {
  const { data, settings } = useApp();

  const [voluumRows, setVoluumRows] = useState<NormalizedVoluumRow[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [isMock,     setIsMock]     = useState(false);
  const [preset,     setPreset]     = useState<DateRangePreset>('last7');

  const sync = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = resolveDateRange(preset);
      const res = await fetchVoluumReport({ from, to, groupBy: 'campaign', limit: 500 });
      if (res.credentialsMissing) {
        setIsMock(true);
        setVoluumRows([]);
      } else {
        setIsMock(false);
        const dateRange = `${from.slice(0, 10)} / ${to.slice(0, 10)}`;
        setVoluumRows(normalizeRows(res.rows ?? [], dateRange));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [preset]);

  useEffect(() => { sync(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const gadsAgg   = useMemo(() => aggregateGadsByCampaign(data.campaigns),          [data.campaigns]);
  const voluumAgg = useMemo(() => aggregateNormalizedVoluumByCampaign(voluumRows),   [voluumRows]);
  const records   = useMemo(
    () => buildReconciledRecords(voluumAgg, gadsAgg).filter((r) => r.matchType !== 'unmatched'),
    [voluumAgg, gadsAgg]
  );

  const totals = useMemo(() => {
    const totalGCost   = records.reduce((s, r) => s + r.gads_cost, 0);
    const totalVRev    = records.reduce((s, r) => s + r.voluum_revenue, 0);
    const totalVCost   = records.reduce((s, r) => s + r.voluum_cost, 0);
    const totalGImpr   = gadsAgg.reduce((s, r) => s + r.impressions, 0);
    const totalGClicks = gadsAgg.reduce((s, r) => s + r.clicks, 0);
    const totalVVisits = voluumAgg.reduce((s, r) => s + r.visits, 0);
    const totalVConv   = voluumAgg.reduce((s, r) => s + r.conversions, 0);
    const totalGConv   = gadsAgg.reduce((s, r) => s + r.conversions, 0);
    return {
      totalGCost, totalVRev, totalVCost,
      totalGImpr, totalGClicks, totalVVisits, totalVConv, totalGConv,
      voluumROI: totalVCost > 0 ? ((totalVRev - totalVCost) / totalVCost) * 100 : 0,
      trueROI:   totalGCost > 0 ? ((totalVRev - totalGCost) / totalGCost) * 100 : 0,
      attrGap:   totalVConv - totalGConv,
    };
  }, [records, gadsAgg, voluumAgg]);

  const fmtC   = (n: number) => fmtCurrency(n, settings.currency);
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;
  const topCampaigns = records.slice(0, 10);
  const hasData = data.campaigns.length > 0 || voluumRows.length > 0;

  return (
    <PageContainer>
      <PageHeader
        title="ROI & Attribution Analysis"
        description="Voluum revenue vs Google Ads spend — true ROI, conversion funnel, and attribution gaps"
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
              Sync
            </button>
          </div>
        }
      />

      {isMock && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 text-xs text-amber-800">
          <AlertTriangle size={13} />
          Voluum credentials not configured — no live data. Google Ads data shown from import only.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4 text-xs text-red-700">
          <Info size={13} /> {error}
        </div>
      )}

      {!hasData ? (
        <Card>
          <CardBody>
            <EmptyState message="Import Google Ads campaigns and sync Voluum to see ROI analysis." icon={<TrendingUp size={32} />} />
          </CardBody>
        </Card>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
            {[
              { label: 'GAds Spend', value: fmtC(totals.totalGCost),  color: 'text-gray-900',                                                    icon: DollarSign },
              { label: 'Voluum Rev', value: fmtC(totals.totalVRev),   color: 'text-gray-900',                                                    icon: DollarSign },
              { label: 'Voluum ROI', value: fmtPct(totals.voluumROI), color: totals.voluumROI >= 0 ? 'text-emerald-600' : 'text-red-600',        icon: TrendingUp },
              { label: 'True ROI',   value: fmtPct(totals.trueROI),   color: totals.trueROI  >= 0 ? 'text-emerald-600' : 'text-red-600',        icon: TrendingUp },
              { label: 'V Conv',     value: totals.totalVConv.toLocaleString(), color: 'text-gray-900',                                           icon: Target },
              { label: 'Attr. Gap',  value: (totals.attrGap >= 0 ? '+' : '') + totals.attrGap.toLocaleString(),
                color: totals.attrGap > 0 ? 'text-blue-600' : totals.attrGap < 0 ? 'text-red-600' : 'text-gray-400', icon: Target },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                  <Icon size={11} /> {label}
                </div>
                <div className={`text-xl font-bold leading-none ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* ROI discrepancy notice */}
          {Math.abs(totals.trueROI - totals.voluumROI) > 5 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 text-xs text-amber-800">
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                <strong>ROI discrepancy detected.</strong> Voluum ROI ({fmtPct(totals.voluumROI)}) uses Voluum's
                tracked cost; True ROI ({fmtPct(totals.trueROI)}) uses actual Google Ads spend. A gap &gt;5%
                usually means Voluum cost tracking is not fully synced with Google Ads billing.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
            {/* Conversion funnel */}
            <Card>
              <CardHeader title="Conversion Funnel" />
              <CardBody>
                <div className="space-y-0">
                  <FunnelStep label="Impressions (Google Ads)" value={totals.totalGImpr.toLocaleString()} color="bg-slate-600" />
                  <FunnelStep
                    label="Clicks (Google Ads)" value={totals.totalGClicks.toLocaleString()}
                    sub={`CTR: ${totals.totalGImpr > 0 ? ((totals.totalGClicks / totals.totalGImpr) * 100).toFixed(2) : 0}%`}
                    pct={totals.totalGImpr > 0 ? (totals.totalGClicks / totals.totalGImpr) * 100 : undefined}
                    color="bg-blue-600"
                  />
                  <FunnelStep
                    label="Visits (Voluum)" value={totals.totalVVisits.toLocaleString()}
                    sub="After landing page redirect"
                    pct={totals.totalGClicks > 0 ? (totals.totalVVisits / totals.totalGClicks) * 100 : undefined}
                    color="bg-indigo-500"
                  />
                  <FunnelStep
                    label="Conversions (Voluum)" value={totals.totalVConv.toLocaleString()}
                    sub={`CVR: ${totals.totalVVisits > 0 ? ((totals.totalVConv / totals.totalVVisits) * 100).toFixed(2) : 0}%`}
                    pct={totals.totalVVisits > 0 ? (totals.totalVConv / totals.totalVVisits) * 100 : undefined}
                    color="bg-emerald-600"
                  />
                </div>
                {totals.totalGConv > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    Google Ads tracked <strong>{totals.totalGConv.toLocaleString()}</strong> conversions.
                    Attribution gap: <strong className={totals.attrGap >= 0 ? 'text-blue-600' : 'text-red-600'}>
                      {totals.attrGap >= 0 ? '+' : ''}{totals.attrGap}
                    </strong>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* ROI comparison */}
            <Card>
              <CardHeader title="Voluum ROI vs True ROI — Top Campaigns" />
              <CardBody>
                {topCampaigns.length === 0
                  ? <div className="text-sm text-gray-400 py-4 text-center">No matched campaigns.</div>
                  : topCampaigns.map((r) => (
                      <BarPair
                        key={r.campaignName} label={r.campaignName}
                        aVal={r.voluum_roi * 100} bVal={r.true_roi}
                        aLabel="V ROI" bLabel="True ROI"
                        aColor="bg-blue-400" bColor={r.true_roi >= 0 ? 'bg-emerald-500' : 'bg-red-500'}
                        fmt={(n) => `${n.toFixed(1)}%`}
                      />
                    ))
                }
              </CardBody>
            </Card>
          </div>

          {/* Cost comparison */}
          <Card>
            <CardHeader title="Spend Comparison — Voluum Cost vs Google Ads Cost" />
            <CardBody>
              {topCampaigns.length === 0
                ? <div className="text-sm text-gray-400 py-4 text-center">No matched campaigns.</div>
                : topCampaigns.map((r) => (
                    <BarPair
                      key={r.campaignName} label={r.campaignName}
                      aVal={r.voluum_cost} bVal={r.gads_cost}
                      aLabel="V Cost" bLabel="G Cost"
                      aColor="bg-amber-400" bColor="bg-slate-500"
                      fmt={fmtC}
                    />
                  ))
              }
            </CardBody>
          </Card>
        </>
      )}
    </PageContainer>
  );
}
