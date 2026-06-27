import { useMemo, useState } from 'react';
import { GitCompare, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { PageContainer, PageHeader, Card, CardHeader, CardBody, EmptyState } from '../components/Layout';
import { useApp } from '../context/AppContext';
import { buildReconciliationRows } from '../lib/attribution';
import { TZ_BKK, TZ_LA, TZ_LABELS } from '../lib/timezone';
import { fmtCurrency } from '../lib/metrics/calculations';

function TzBadge({ tz }: { tz: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
      <Info size={10} />
      {TZ_LABELS[tz] ?? tz}
    </span>
  );
}

function RiskBadge({ risk }: { risk: boolean }) {
  if (risk) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
        <AlertTriangle size={10} />
        Split
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
      <CheckCircle size={10} />
      Aligned
    </span>
  );
}

function diffColor(d: number): string {
  if (d > 0)  return 'text-emerald-600 font-medium';
  if (d < 0)  return 'text-red-600 font-medium';
  return 'text-gray-400';
}

const RANGE_OPTIONS = [
  { label: 'All',     days: 0  },
  { label: 'Last 7',  days: 7  },
  { label: 'Last 14', days: 14 },
  { label: 'Last 30', days: 30 },
];

export function NetworkReconciliation() {
  const { data, settings } = useApp();
  const [rangeDays, setRangeDays] = useState(14);

  const allRows = useMemo(
    () => buildReconciliationRows(data.campaigns, data.voluum),
    [data.campaigns, data.voluum]
  );

  const rows = useMemo(() => {
    if (!rangeDays) return allRows;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    const cutStr = cutoff.toISOString().slice(0, 10);
    return allRows.filter((r) => r.bkk_date >= cutStr);
  }, [allRows, rangeDays]);

  const splitCount = rows.filter((r) => r.has_tz_risk).length;
  const hasData = data.campaigns.length > 0 || data.voluum.length > 0;

  const totalDiff = rows.reduce((s, r) => s + r.difference, 0);

  return (
    <PageContainer>
      <PageHeader
        title="Network Reconciliation"
        description="Compare BKK-attributed revenue against affiliate network (America/Los_Angeles) date buckets"
        actions={
          <div className="flex items-center gap-2">
            <TzBadge tz={TZ_BKK} />
            <TzBadge tz={TZ_LA} />
          </div>
        }
      />

      {/* Explanation banner */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-5 text-xs text-blue-800">
        <Info size={14} className="flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">How it works:</span> Because Asia/Bangkok (UTC+7) and
          America/Los_Angeles (UTC-8 to UTC-7) have different midnight boundaries, a single BKK calendar
          date can span <strong>two LA calendar dates</strong>. This report shows where BKK revenue
          differs from what the affiliate network reports under their LA date buckets.{' '}
          <span className="font-semibold">Split</span> rows indicate dates where day-boundary divergence
          exists.
        </div>
      </div>

      {!hasData ? (
        <Card>
          <CardBody>
            <EmptyState
              message="Import Google Ads campaigns and Voluum data to see the reconciliation report."
              icon={<GitCompare size={32} />}
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

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Total Rows</div>
              <div className="text-xl font-bold text-gray-900">{rows.length}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Split Dates</div>
              <div className="text-xl font-bold text-amber-600">{splitCount}</div>
              <div className="text-xs text-gray-400 mt-0.5">BKK date spans 2 LA dates</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">Total Rev (BKK)</div>
              <div className="text-xl font-bold text-gray-900">
                {fmtCurrency(rows.reduce((s, r) => s + r.revenue_bkk, 0), settings.currency)}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="text-xs text-gray-500 mb-1">BKK vs LA Diff</div>
              <div className={`text-xl font-bold ${diffColor(totalDiff)}`}>
                {totalDiff !== 0 ? fmtCurrency(totalDiff, settings.currency) : '—'}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">revenue_bkk − revenue_la</div>
            </div>
          </div>

          {splitCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 text-xs text-amber-800">
              <AlertTriangle size={13} />
              <strong>{splitCount} date{splitCount > 1 ? 's' : ''}</strong> where a single BKK date maps to two
              LA calendar dates — revenue totals may appear different depending on which timezone the network
              uses for daily settlement.
            </div>
          )}

          <Card>
            <CardHeader
              title={`Date Reconciliation (${rows.length} rows)`}
              actions={
                <div className="flex items-center gap-2">
                  <TzBadge tz={TZ_BKK} />
                  <TzBadge tz={TZ_LA} />
                </div>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="px-4 py-3 text-left font-medium">BKK Date</th>
                    <th className="px-3 py-3 text-left font-medium">LA Date(s)</th>
                    <th className="px-3 py-3 text-center font-medium">TZ Risk</th>
                    <th className="px-3 py-3 text-right font-medium">Cost (BKK)</th>
                    <th className="px-3 py-3 text-right font-medium">Rev (BKK)</th>
                    <th className="px-3 py-3 text-right font-medium">Rev (LA est.)</th>
                    <th className="px-3 py-3 text-right font-medium">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.bkk_date} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-gray-800 font-medium font-mono text-xs">{r.bkk_date}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {r.la_dates.map((d) => (
                            <span key={d} className="font-mono text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                              {d}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <RiskBadge risk={r.has_tz_risk} />
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{fmtCurrency(r.cost_bkk, settings.currency)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{fmtCurrency(r.revenue_bkk, settings.currency)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500 italic">{fmtCurrency(r.revenue_la, settings.currency)}</td>
                      <td className={`px-3 py-2.5 text-right ${diffColor(r.difference)}`}>
                        {r.difference !== 0 ? fmtCurrency(r.difference, settings.currency) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-sm">
                    <td className="px-4 py-3 text-gray-700" colSpan={3}>Totals</td>
                    <td className="px-3 py-3 text-right text-gray-800">
                      {fmtCurrency(rows.reduce((s, r) => s + r.cost_bkk, 0), settings.currency)}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-800">
                      {fmtCurrency(rows.reduce((s, r) => s + r.revenue_bkk, 0), settings.currency)}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-600 italic">
                      {fmtCurrency(rows.reduce((s, r) => s + r.revenue_la, 0), settings.currency)}
                    </td>
                    <td className={`px-3 py-3 text-right ${diffColor(totalDiff)}`}>
                      {totalDiff !== 0 ? fmtCurrency(totalDiff, settings.currency) : '—'}
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
