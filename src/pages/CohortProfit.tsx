import { useMemo, useState } from 'react';
import { CalendarDays, Info, AlertTriangle } from 'lucide-react';
import { PageContainer, PageHeader, Card, CardHeader, CardBody, EmptyState } from '../components/Layout';
import { useApp } from '../context/AppContext';
import { buildCohortRows } from '../lib/attribution';
import { TZ_BKK, TZ_LABELS } from '../lib/timezone';
import { fmtCurrency } from '../lib/metrics/calculations';

function TzBadge({ tz }: { tz: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
      <Info size={10} />
      {TZ_LABELS[tz] ?? tz}
    </span>
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

export function CohortProfit() {
  const { data, settings } = useApp();
  const [rangeDays, setRangeDays] = useState(14);

  const allRows = useMemo(
    () => buildCohortRows(data.campaigns, data.voluum),
    [data.campaigns, data.voluum]
  );

  const rows = useMemo(() => {
    if (!rangeDays) return allRows;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    const cutStr = cutoff.toISOString().slice(0, 10);
    return allRows.filter((r) => r.click_date_bkk >= cutStr);
  }, [allRows, rangeDays]);

  const hasData = data.campaigns.length > 0 || data.voluum.length > 0;

  const totalCost     = rows.reduce((s, r) => s + r.cost,           0);
  const totalRevD0    = rows.reduce((s, r) => s + r.revenue_d0,     0);
  const totalRevD1    = rows.reduce((s, r) => s + r.revenue_d1,     0);
  const totalRevD3    = rows.reduce((s, r) => s + r.revenue_d3,     0);
  const totalRevD7    = rows.reduce((s, r) => s + r.revenue_d7,     0);
  const totalFinalRev = rows.reduce((s, r) => s + r.final_revenue,  0);
  const totalProfit   = totalFinalRev - totalCost;
  const totalRoi      = totalCost > 0 ? totalProfit / totalCost : 0;
  const hasDelayed    = rows.some((r) => r.revenue_d1 > 0 || r.revenue_d3 > 0 || r.revenue_d7 > 0);

  return (
    <PageContainer>
      <PageHeader
        title="Cohort Profit"
        description="Revenue lifecycle per click cohort — D0 (same day) through D+7 delayed postbacks"
        actions={
          <div className="flex items-center gap-2">
            <TzBadge tz={TZ_BKK} />
          </div>
        }
      />

      {/* Explanation banner */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-5 text-xs text-blue-800">
        <Info size={14} className="flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Cohort model:</span> Each row represents all clicks on a
          given <strong>click_date_bkk</strong>. D0 is revenue from the same day; D1/D3/D7 capture
          delayed postbacks arriving 1, 3, or 7 days later. Final revenue and profit accumulate
          across all windows. Requires daily-granularity Voluum data to populate D1+ columns.
        </div>
      </div>

      {!hasData ? (
        <Card>
          <CardBody>
            <EmptyState
              message="Import Google Ads campaigns and Voluum data to see cohort profit analysis."
              icon={<CalendarDays size={32} />}
            />
          </CardBody>
        </Card>
      ) : (
        <>
          {/* Range selector */}
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
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Cost</div>
              <div className="text-xl font-bold text-gray-900">{fmtCurrency(totalCost, settings.currency)}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Rev D0</div>
              <div className="text-xl font-bold text-gray-700">{fmtCurrency(totalRevD0, settings.currency)}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Rev D1+</div>
              <div className={`text-xl font-bold ${totalRevD1 + totalRevD3 + totalRevD7 > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                {fmtCurrency(totalRevD1 + totalRevD3 + totalRevD7, settings.currency)}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Final Rev</div>
              <div className={`text-xl font-bold ${totalFinalRev > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                {fmtCurrency(totalFinalRev, settings.currency)}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Final Profit</div>
              <div className={`text-xl font-bold ${profitColor(totalProfit)}`}>
                {fmtCurrency(totalProfit, settings.currency)}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Final ROI</div>
              <div className={`text-xl font-bold ${roiColor(totalRoi)}`}>
                {totalCost > 0 ? `${(totalRoi * 100).toFixed(1)}%` : '—'}
              </div>
            </div>
          </div>

          {!hasDelayed && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 text-xs text-amber-800">
              <AlertTriangle size={13} />
              D1/D3/D7 columns are all zero. Import Voluum data that includes multiple days of postback history
              to populate delayed revenue columns.
            </div>
          )}

          <Card>
            <CardHeader
              title={`Click Cohorts (${rows.length} days)`}
              actions={<TzBadge tz={TZ_BKK} />}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="px-4 py-3 text-left font-medium">Click Date (BKK)</th>
                    <th className="px-3 py-3 text-right font-medium">Cost</th>
                    <th className="px-3 py-3 text-right font-medium">Clicks</th>
                    <th className="px-3 py-3 text-right font-medium">Rev D0</th>
                    <th className="px-3 py-3 text-right font-medium">Rev D1</th>
                    <th className="px-3 py-3 text-right font-medium">Rev D3</th>
                    <th className="px-3 py-3 text-right font-medium">Rev D7</th>
                    <th className="px-3 py-3 text-right font-medium">Final Rev</th>
                    <th className="px-3 py-3 text-right font-medium">Final Profit</th>
                    <th className="px-3 py-3 text-right font-medium">Final ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.click_date_bkk} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-gray-800 font-medium font-mono text-xs">{r.click_date_bkk}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{fmtCurrency(r.cost, settings.currency)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{r.clicks.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{fmtCurrency(r.revenue_d0, settings.currency)}</td>
                      <td className={`px-3 py-2.5 text-right ${r.revenue_d1 > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                        {r.revenue_d1 > 0 ? fmtCurrency(r.revenue_d1, settings.currency) : '—'}
                      </td>
                      <td className={`px-3 py-2.5 text-right ${r.revenue_d3 > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                        {r.revenue_d3 > 0 ? fmtCurrency(r.revenue_d3, settings.currency) : '—'}
                      </td>
                      <td className={`px-3 py-2.5 text-right ${r.revenue_d7 > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                        {r.revenue_d7 > 0 ? fmtCurrency(r.revenue_d7, settings.currency) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-800 font-medium">{fmtCurrency(r.final_revenue, settings.currency)}</td>
                      <td className={`px-3 py-2.5 text-right ${profitColor(r.final_profit)}`}>{fmtCurrency(r.final_profit, settings.currency)}</td>
                      <td className={`px-3 py-2.5 text-right ${roiColor(r.final_roi)}`}>
                        {r.cost > 0 ? `${(r.final_roi * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-sm">
                    <td className="px-4 py-3 text-gray-700">Totals</td>
                    <td className="px-3 py-3 text-right text-gray-800">{fmtCurrency(totalCost, settings.currency)}</td>
                    <td className="px-3 py-3 text-right text-gray-700">
                      {rows.reduce((s, r) => s + r.clicks, 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-800">{fmtCurrency(totalRevD0, settings.currency)}</td>
                    <td className={`px-3 py-3 text-right ${totalRevD1 > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                      {totalRevD1 > 0 ? fmtCurrency(totalRevD1, settings.currency) : '—'}
                    </td>
                    <td className={`px-3 py-3 text-right ${totalRevD3 > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                      {totalRevD3 > 0 ? fmtCurrency(totalRevD3, settings.currency) : '—'}
                    </td>
                    <td className={`px-3 py-3 text-right ${totalRevD7 > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                      {totalRevD7 > 0 ? fmtCurrency(totalRevD7, settings.currency) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-800">{fmtCurrency(totalFinalRev, settings.currency)}</td>
                    <td className={`px-3 py-3 text-right ${profitColor(totalProfit)}`}>{fmtCurrency(totalProfit, settings.currency)}</td>
                    <td className={`px-3 py-3 text-right ${roiColor(totalRoi)}`}>
                      {totalCost > 0 ? `${(totalRoi * 100).toFixed(1)}%` : '—'}
                    </td>
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
