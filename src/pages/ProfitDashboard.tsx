import { useMemo, useState } from 'react';
import { DollarSign, AlertTriangle, Info } from 'lucide-react';
import { PageContainer, PageHeader, Card, CardHeader, CardBody, EmptyState } from '../components/Layout';
import { useApp } from '../context/AppContext';
import { buildProfitRows, sumProfitRows } from '../lib/attribution';
import { TZ_BKK, TZ_LABELS } from '../lib/timezone';
import { fmtCurrency } from '../lib/metrics/calculations';

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function TzBadge({ tz }: { tz: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
      <Info size={10} />
      {TZ_LABELS[tz] ?? tz}
    </span>
  );
}

function KpiBox({ label, value, sub, color = 'default' }: {
  label: string; value: string; sub?: string;
  color?: 'default' | 'green' | 'red' | 'blue';
}) {
  const col = color === 'green' ? 'text-emerald-600' : color === 'red' ? 'text-red-600' : color === 'blue' ? 'text-blue-600' : 'text-gray-900';
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold leading-none ${col}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function roiColor(roi: number): string {
  if (roi > 0.5) return 'text-emerald-600 font-semibold';
  if (roi > 0)   return 'text-emerald-500';
  if (roi < 0)   return 'text-red-600 font-semibold';
  return 'text-gray-400';
}

function profitColor(p: number): string {
  if (p > 0) return 'text-emerald-600 font-medium';
  if (p < 0) return 'text-red-600 font-medium';
  return 'text-gray-400';
}

const RANGE_OPTIONS = [
  { label: 'All',     days: 0  },
  { label: 'Last 7',  days: 7  },
  { label: 'Last 14', days: 14 },
  { label: 'Last 30', days: 30 },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ProfitDashboard() {
  const { data, settings } = useApp();
  const [rangeDays, setRangeDays] = useState(14);

  const allRows = useMemo(
    () => buildProfitRows(data.campaigns, data.voluum),
    [data.campaigns, data.voluum]
  );

  const rows = useMemo(() => {
    if (!rangeDays) return allRows;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    const cutStr = cutoff.toISOString().slice(0, 10);
    return allRows.filter((r) => r.date_bkk >= cutStr);
  }, [allRows, rangeDays]);

  const totals = useMemo(() => sumProfitRows(rows), [rows]);
  const hasData = data.campaigns.length > 0 || data.voluum.length > 0;

  return (
    <PageContainer>
      <PageHeader
        title="Profit Dashboard"
        description="True ad performance — cost by Google Ads date, revenue attributed to click/visit date"
        actions={
          <div className="flex items-center gap-2">
            <TzBadge tz={TZ_BKK} />
          </div>
        }
      />

      {/* Attribution model notice */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-5 text-xs text-blue-800">
        <Info size={14} className="flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Attribution:</span> Revenue is assigned to the{' '}
          <strong>visit/click date (Asia/Bangkok)</strong>, not the postback date. Cost comes from Google Ads
          reports in Asia/Bangkok time. Both sources use the same timezone — no cross-timezone
          mismatch in this view.
        </div>
      </div>

      {!hasData ? (
        <Card>
          <CardBody>
            <EmptyState
              message="Import Google Ads campaigns and Voluum data to see profit attribution."
              icon={<DollarSign size={32} />}
            />
          </CardBody>
        </Card>
      ) : (
        <>
          {/* Date range */}
          <div className="flex items-center gap-1 mb-4">
            {RANGE_OPTIONS.map((o) => (
              <button
                key={o.days}
                onClick={() => setRangeDays(o.days)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  rangeDays === o.days
                    ? 'bg-gray-900 text-white border-gray-900 font-medium'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* KPI summary */}
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3 mb-5">
            <KpiBox label="Cost"      value={fmtCurrency(totals.cost, settings.currency)} />
            <KpiBox label="Revenue"   value={fmtCurrency(totals.revenue, settings.currency)} color={totals.revenue > 0 ? 'green' : 'default'} />
            <KpiBox label="Profit"    value={fmtCurrency(totals.profit, settings.currency)}  color={totals.profit > 0 ? 'green' : totals.profit < 0 ? 'red' : 'default'} />
            <KpiBox label="ROI"       value={`${(totals.roi * 100).toFixed(1)}%`}            color={totals.roi > 0 ? 'green' : totals.roi < 0 ? 'red' : 'default'} />
            <KpiBox label="Impr."     value={totals.impressions.toLocaleString()} />
            <KpiBox label="Clicks (G)" value={totals.clicks_google.toLocaleString()} />
            <KpiBox label="Conv. (V)" value={totals.conversions_voluum.toLocaleString()} />
            <KpiBox label="CPA"       value={totals.cpa > 0 ? fmtCurrency(totals.cpa, settings.currency) : '—'} />
            <KpiBox label="EPC"       value={totals.epc > 0 ? fmtCurrency(totals.epc, settings.currency) : '—'} />
          </div>

          {/* Warning when Voluum missing */}
          {data.voluum.length === 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 text-xs text-amber-800">
              <AlertTriangle size={13} />
              Voluum data not imported — revenue and profit columns will be zero.
            </div>
          )}

          {/* Daily table */}
          <Card>
            <CardHeader
              title={`Daily Performance (${rows.length} days)`}
              actions={<TzBadge tz={TZ_BKK} />}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="px-4 py-3 text-left font-medium">Date (BKK)</th>
                    <th className="px-3 py-3 text-right font-medium">Cost</th>
                    <th className="px-3 py-3 text-right font-medium">Clicks (G)</th>
                    <th className="px-3 py-3 text-right font-medium">Visits (V)</th>
                    <th className="px-3 py-3 text-right font-medium">Conv. (V)</th>
                    <th className="px-3 py-3 text-right font-medium">Revenue</th>
                    <th className="px-3 py-3 text-right font-medium">Profit</th>
                    <th className="px-3 py-3 text-right font-medium">ROI</th>
                    <th className="px-3 py-3 text-right font-medium">CPA</th>
                    <th className="px-3 py-3 text-right font-medium">EPC</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.date_bkk} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-gray-800 font-medium font-mono text-xs">{r.date_bkk}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{fmtCurrency(r.cost, settings.currency)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{r.clicks_google.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{r.visits_voluum.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{r.conversions_voluum}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{fmtCurrency(r.revenue, settings.currency)}</td>
                      <td className={`px-3 py-2.5 text-right ${profitColor(r.profit)}`}>{fmtCurrency(r.profit, settings.currency)}</td>
                      <td className={`px-3 py-2.5 text-right ${roiColor(r.roi)}`}>{r.cost > 0 ? `${(r.roi * 100).toFixed(1)}%` : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{r.cpa > 0 ? fmtCurrency(r.cpa, settings.currency) : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{r.epc > 0 ? fmtCurrency(r.epc, settings.currency) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals footer */}
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-sm">
                    <td className="px-4 py-3 text-gray-700">Totals</td>
                    <td className="px-3 py-3 text-right text-gray-800">{fmtCurrency(totals.cost, settings.currency)}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{totals.clicks_google.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{rows.reduce((s, r) => s + r.visits_voluum, 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{totals.conversions_voluum}</td>
                    <td className="px-3 py-3 text-right text-gray-800">{fmtCurrency(totals.revenue, settings.currency)}</td>
                    <td className={`px-3 py-3 text-right ${profitColor(totals.profit)}`}>{fmtCurrency(totals.profit, settings.currency)}</td>
                    <td className={`px-3 py-3 text-right ${roiColor(totals.roi)}`}>{totals.cost > 0 ? `${(totals.roi * 100).toFixed(1)}%` : '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{totals.cpa > 0 ? fmtCurrency(totals.cpa, settings.currency) : '—'}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{totals.epc > 0 ? fmtCurrency(totals.epc, settings.currency) : '—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      )}
    </PageContainer>
  );
}
