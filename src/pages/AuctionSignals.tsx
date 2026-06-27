import { useMemo } from 'react';
import { PageContainer, PageHeader, Card, CardBody } from '../components/Layout';
import { DataTable, type Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { SignalBadge } from '../components/Badge';
import { useApp } from '../context/AppContext';
import { computeAuctionSignals } from '../lib/decisionEngine/auctionSignals';
import { fmtPercent } from '../lib/metrics/calculations';
import type { AuctionSignalRow } from '../types';

export function AuctionSignals() {
  const { data } = useApp();

  const rows = useMemo(
    () => computeAuctionSignals(data.auctionCampaigns, data.auctionKeywords),
    [data.auctionCampaigns, data.auctionKeywords]
  );

  const campRows = rows.filter((r) => r.type === 'campaign');
  const kwRows = rows.filter((r) => r.type === 'keyword');

  const columns: Column<AuctionSignalRow>[] = [
    {
      key: 'name', label: 'Name',
      render: (r) => <span className="font-medium text-gray-900 max-w-[200px] truncate block">{r.name}</span>,
      width: '200px',
    },
    {
      key: 'type', label: 'Type',
      render: (r) => <Badge variant={r.type === 'campaign' ? 'blue' : 'gray'}>{r.type}</Badge>,
    },
    { key: 'campaign_name', label: 'Campaign', render: (r) => <span className="text-xs text-gray-500 max-w-[140px] truncate block">{r.campaign_name}</span> },
    {
      key: 'search_impression_share', label: 'IS', align: 'right',
      render: (r) => r.search_impression_share > 0 ? fmtPercent(r.search_impression_share) : '-',
    },
    {
      key: 'rank_lost', label: 'Rank Lost IS', align: 'right',
      render: (r) => (
        <span className={r.rank_lost > 0.2 ? 'text-amber-600 font-medium' : ''}>
          {r.rank_lost > 0 ? fmtPercent(r.rank_lost) : '-'}
        </span>
      ),
    },
    {
      key: 'budget_lost', label: 'Budget Lost IS', align: 'right',
      render: (r) => (
        <span className={r.budget_lost > 0.2 ? 'text-blue-600 font-medium' : ''}>
          {r.budget_lost > 0 ? fmtPercent(r.budget_lost) : '-'}
        </span>
      ),
    },
    {
      key: 'top_impression_pct', label: 'Top IS %', align: 'right',
      render: (r) => r.top_impression_pct > 0 ? fmtPercent(r.top_impression_pct) : '-',
    },
    {
      key: 'abs_top_impression_pct', label: 'Abs Top %', align: 'right',
      render: (r) => r.abs_top_impression_pct > 0 ? fmtPercent(r.abs_top_impression_pct) : '-',
    },
    { key: 'conversions', label: 'Conv.', align: 'right', render: (r) => r.conversions.toFixed(1) },
    { key: 'bid_signal', label: 'Bid Signal', render: (r) => <span className="text-xs text-gray-500">{r.bid_signal || '-'}</span>, sortable: false },
    {
      key: 'label', label: 'Signal Label', sortable: false,
      render: (r) => <SignalBadge label={r.label} />,
    },
    {
      key: 'description', label: 'Interpretation', sortable: false,
      render: (r) => <span className="text-xs text-gray-500 max-w-[240px] block">{r.description}</span>,
    },
  ];

  return (
    <PageContainer>
      <PageHeader title="Auction Signals" description="Impression share, rank loss, and bid signal interpretation" />

      <div className="space-y-6">
        <Card>
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Campaign-Level Signals ({campRows.length})</h2>
          </div>
          <CardBody className="p-0 px-5 py-4">
            <DataTable
              columns={columns}
              data={campRows}
              emptyMessage="No auction campaign data. Import google_auction_proxy_campaigns CSV."
            />
          </CardBody>
        </Card>

        <Card>
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Keyword-Level Signals ({kwRows.length})</h2>
          </div>
          <CardBody className="p-0 px-5 py-4">
            <DataTable
              columns={columns}
              data={kwRows}
              emptyMessage="No auction keyword data. Import google_auction_proxy_keywords CSV."
            />
          </CardBody>
        </Card>
      </div>
    </PageContainer>
  );
}
