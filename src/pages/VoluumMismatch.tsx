import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { PageContainer, PageHeader, Card, CardBody } from '../components/Layout';
import { DataTable, type Column } from '../components/DataTable';
import { MismatchBadge } from '../components/Badge';
import { useApp } from '../context/AppContext';
import { computeVoluumMismatch } from '../lib/decisionEngine/voluumMismatch';
import { fmtCurrency } from '../lib/metrics/calculations';
import type { VoluumMismatchRow } from '../types';

export function VoluumMismatch() {
  const { data, settings } = useApp();

  const rows = useMemo(
    () => computeVoluumMismatch(data.voluum, data.campaigns),
    [data.voluum, data.campaigns]
  );

  const hasVoluum = data.voluum.length > 0;
  const mismatchCount = rows.filter((r) => r.flag !== 'OK' && r.flag !== 'NO_VOLUUM_DATA').length;

  const columns: Column<VoluumMismatchRow>[] = [
    { key: 'campaign_id', label: 'Campaign ID', render: (r) => <span className="text-xs font-mono text-gray-500">{r.campaign_id}</span> },
    { key: 'google_clicks', label: 'Google Clicks', align: 'right', render: (r) => r.google_clicks.toLocaleString() },
    {
      key: 'voluum_visits', label: 'Voluum Visits', align: 'right',
      render: (r) => (
        <span className={r.voluum_visits === 0 && r.google_clicks > 0 ? 'text-red-600 font-medium' : ''}>
          {r.voluum_visits.toLocaleString()}
        </span>
      ),
    },
    { key: 'google_conversions', label: 'Google Conv.', align: 'right', render: (r) => r.google_conversions.toFixed(1) },
    {
      key: 'voluum_conversions', label: 'Voluum Conv.', align: 'right',
      render: (r) => r.voluum_conversions.toFixed(1),
    },
    { key: 'google_cost', label: 'Google Cost', align: 'right', render: (r) => fmtCurrency(r.google_cost, settings.currency) },
    {
      key: 'voluum_revenue', label: 'Voluum Revenue', align: 'right',
      render: (r) => <span className={r.voluum_revenue > 0 ? 'text-emerald-600' : ''}>{fmtCurrency(r.voluum_revenue, settings.currency)}</span>,
    },
    {
      key: 'voluum_profit', label: 'Voluum Profit', align: 'right',
      render: (r) => (
        <span className={r.voluum_profit > 0 ? 'text-emerald-600 font-medium' : r.voluum_profit < 0 ? 'text-red-600' : ''}>
          {fmtCurrency(r.voluum_profit, settings.currency)}
        </span>
      ),
    },
    { key: 'flag', label: 'Flag', render: (r) => <MismatchBadge flag={r.flag} /> },
    { key: 'description', label: 'Notes', render: (r) => <span className="text-xs text-gray-500 max-w-[240px] block">{r.description}</span>, sortable: false },
  ];

  return (
    <PageContainer>
      <PageHeader title="Voluum Mismatch" description="Compare Google Ads tracking vs. Voluum tracker data" />

      {!hasVoluum && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-center gap-2 mb-4">
          <AlertTriangle size={16} className="flex-shrink-0" />
          Voluum data is not imported. Import <code className="font-mono bg-amber-100 px-1 rounded">voluum_performance</code> CSV to enable mismatch detection.
          Currently showing Google campaign data with NO_VOLUUM_DATA flag.
        </div>
      )}

      {hasVoluum && mismatchCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 flex items-center gap-2 mb-4">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <strong>{mismatchCount} tracking {mismatchCount === 1 ? 'mismatch' : 'mismatches'} detected.</strong>{' '}
          Check your tracking pixel and postback URL configuration.
        </div>
      )}

      <Card>
        <CardBody className="p-0 px-5 py-4">
          <DataTable
            columns={columns}
            data={rows}
            emptyMessage="Import google_campaigns and optionally voluum_performance to see mismatch analysis."
          />
        </CardBody>
      </Card>
    </PageContainer>
  );
}
