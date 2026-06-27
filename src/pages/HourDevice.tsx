import { useMemo, useState } from 'react';
import { PageContainer, PageHeader, Card, CardBody } from '../components/Layout';
import { DataTable, type Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { useApp } from '../context/AppContext';
import { fmtCurrency, fmtPercent } from '../lib/metrics/calculations';

interface HourSummary {
  hour: number;
  device: string;
  campaign: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  cpa: number;
  ctr: number;
}

export function HourDevice() {
  const { data, settings } = useApp();
  const [groupBy, setGroupBy] = useState<'hour' | 'device' | 'both'>('hour');

  const rows = useMemo((): HourSummary[] => {
    const map = new Map<string, HourSummary>();

    for (const r of data.hourDevice) {
      const key = groupBy === 'hour'
        ? `${r.hour}`
        : groupBy === 'device'
        ? r.device
        : `${r.hour}__${r.device}`;

      const existing = map.get(key);
      if (existing) {
        existing.impressions += r.impressions;
        existing.clicks += r.clicks;
        existing.cost += r.cost;
        existing.conversions += r.conversions;
      } else {
        map.set(key, {
          hour: r.hour,
          device: r.device,
          campaign: r.campaign_name,
          impressions: r.impressions,
          clicks: r.clicks,
          cost: r.cost,
          conversions: r.conversions,
          cpa: 0,
          ctr: 0,
        });
      }
    }

    return Array.from(map.values()).map((r) => ({
      ...r,
      cpa: r.conversions > 0 ? r.cost / r.conversions : 0,
      ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
    })).sort((a, b) => {
      if (groupBy === 'hour') return a.hour - b.hour;
      return b.cost - a.cost;
    });
  }, [data.hourDevice, groupBy]);

  const columns: Column<HourSummary>[] = [
    ...(groupBy !== 'device' ? [{
      key: 'hour',
      label: 'Hour',
      render: (r: HourSummary) => <span className="font-mono text-gray-800 font-medium">{String(r.hour).padStart(2, '0')}:00</span>,
    } as Column<HourSummary>] : []),
    ...(groupBy !== 'hour' ? [{
      key: 'device',
      label: 'Device',
      render: (r: HourSummary) => <Badge variant="blue">{r.device}</Badge>,
    } as Column<HourSummary>] : []),
    { key: 'impressions', label: 'Impressions', align: 'right', render: (r) => r.impressions.toLocaleString() },
    { key: 'clicks', label: 'Clicks', align: 'right', render: (r) => r.clicks.toLocaleString() },
    { key: 'ctr', label: 'CTR', align: 'right', render: (r) => fmtPercent(r.ctr) },
    { key: 'cost', label: 'Cost', align: 'right', render: (r) => fmtCurrency(r.cost, settings.currency) },
    { key: 'conversions', label: 'Conv.', align: 'right', render: (r) => r.conversions.toFixed(1) },
    {
      key: 'cpa', label: 'CPA', align: 'right',
      render: (r) => (
        <span className={r.cpa > 0 && r.cpa <= settings.target_cpa ? 'text-emerald-600' : r.cpa > settings.target_cpa ? 'text-red-600' : ''}>
          {r.cpa > 0 ? fmtCurrency(r.cpa, settings.currency) : '-'}
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader title="Hour / Device" description="Performance breakdown by hour and device" />

      <div className="flex gap-2 mb-4">
        {([['hour', 'By Hour'], ['device', 'By Device'], ['both', 'Hour + Device']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setGroupBy(key)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              groupBy === key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardBody className="p-0 px-5 py-4">
          <DataTable
            columns={columns}
            data={rows}
            emptyMessage="No hour/device data. Import google_hour_device CSV."
          />
        </CardBody>
      </Card>
    </PageContainer>
  );
}
