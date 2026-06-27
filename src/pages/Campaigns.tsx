import { useMemo } from 'react';
import { PageContainer, PageHeader, Card, CardBody } from '../components/Layout';
import { DataTable, type Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { useApp } from '../context/AppContext';
import { fmtCurrency, fmtPercent } from '../lib/metrics/calculations';

interface CampaignSummary {
  campaign_id: string;
  campaign_name: string;
  status: string;
  serving_status: string;
  bidding_strategy_type: string;
  spend: number;
  clicks: number;
  conversions: number;
  cpa: number;
  revenue: number;
  profit: number;
  roi: number;
  search_impression_share: number;
  rank_lost: number;
  budget_lost: number;
  bid_signal: string;
}

export function Campaigns() {
  const { data, settings } = useApp();

  const rows = useMemo((): CampaignSummary[] => {
    const map = new Map<string, CampaignSummary>();

    for (const c of data.campaigns) {
      const existing = map.get(c.campaign_id);
      if (existing) {
        existing.spend += c.cost;
        existing.clicks += c.clicks;
        existing.conversions += c.conversions;
        const rev = data.voluum.length > 0
          ? data.voluum.filter((v) => v.campaign_id === c.campaign_id).reduce((s, v) => s + v.revenue, 0)
          : c.conversion_value;
        existing.revenue = rev;
      } else {
        const vRev = data.voluum.length > 0
          ? data.voluum.filter((v) => v.campaign_id === c.campaign_id).reduce((s, v) => s + v.revenue, 0)
          : c.conversion_value;
        map.set(c.campaign_id, {
          campaign_id: c.campaign_id,
          campaign_name: c.campaign_name,
          status: c.campaign_status,
          serving_status: c.serving_status,
          bidding_strategy_type: c.bidding_strategy_type,
          spend: c.cost,
          clicks: c.clicks,
          conversions: c.conversions,
          cpa: 0,
          revenue: vRev,
          profit: 0,
          roi: 0,
          search_impression_share: 0,
          rank_lost: 0,
          budget_lost: 0,
          bid_signal: '',
        });
      }
    }

    // Merge auction data
    for (const ac of data.auctionCampaigns) {
      const c = map.get(ac.campaign_id);
      if (c) {
        c.search_impression_share = ac.search_impression_share;
        c.rank_lost = ac.search_rank_lost_impression_share;
        c.budget_lost = ac.search_budget_lost_impression_share;
        c.bid_signal = ac.bid_signal;
      }
    }

    return Array.from(map.values()).map((c) => ({
      ...c,
      cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
      profit: c.revenue - c.spend,
      roi: c.spend > 0 ? ((c.revenue - c.spend) / c.spend) * 100 : 0,
    })).sort((a, b) => b.spend - a.spend);
  }, [data]);

  const columns: Column<CampaignSummary>[] = [
    {
      key: 'campaign_name', label: 'Campaign',
      render: (r) => <span className="font-medium text-gray-900 max-w-xs truncate block">{r.campaign_name}</span>,
      width: '200px',
    },
    {
      key: 'status', label: 'Status',
      render: (r) => (
        <Badge variant={r.status === 'ENABLED' ? 'green' : r.status === 'PAUSED' ? 'amber' : 'red'}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: 'serving_status', label: 'Serving',
      render: (r) => (
        <Badge variant={r.serving_status === 'SERVING' ? 'green' : 'gray'}>
          {r.serving_status || '-'}
        </Badge>
      ),
    },
    { key: 'bidding_strategy_type', label: 'Bidding', render: (r) => <span className="text-xs text-gray-500">{r.bidding_strategy_type || '-'}</span> },
    { key: 'spend', label: 'Spend', align: 'right', render: (r) => fmtCurrency(r.spend, settings.currency) },
    { key: 'clicks', label: 'Clicks', align: 'right', render: (r) => r.clicks.toLocaleString() },
    { key: 'conversions', label: 'Conv.', align: 'right', render: (r) => r.conversions.toFixed(1) },
    {
      key: 'cpa', label: 'CPA', align: 'right',
      render: (r) => (
        <span className={r.cpa > 0 && r.cpa <= settings.target_cpa ? 'text-emerald-600 font-medium' : r.cpa > settings.target_cpa ? 'text-red-600' : ''}>
          {r.cpa > 0 ? fmtCurrency(r.cpa, settings.currency) : '-'}
        </span>
      ),
    },
    { key: 'revenue', label: 'Revenue', align: 'right', render: (r) => fmtCurrency(r.revenue, settings.currency) },
    {
      key: 'profit', label: 'Profit', align: 'right',
      render: (r) => (
        <span className={r.profit > 0 ? 'text-emerald-600 font-medium' : r.profit < 0 ? 'text-red-600' : ''}>
          {fmtCurrency(r.profit, settings.currency)}
        </span>
      ),
    },
    { key: 'roi', label: 'ROI', align: 'right', render: (r) => `${r.roi.toFixed(1)}%` },
    {
      key: 'search_impression_share', label: 'IS', align: 'right',
      render: (r) => r.search_impression_share > 0 ? fmtPercent(r.search_impression_share) : '-',
    },
    {
      key: 'rank_lost', label: 'Rank Lost', align: 'right',
      render: (r) => (
        <span className={r.rank_lost > 0.2 ? 'text-amber-600' : ''}>
          {r.rank_lost > 0 ? fmtPercent(r.rank_lost) : '-'}
        </span>
      ),
    },
    {
      key: 'budget_lost', label: 'Budget Lost', align: 'right',
      render: (r) => (
        <span className={r.budget_lost > 0.2 ? 'text-blue-600' : ''}>
          {r.budget_lost > 0 ? fmtPercent(r.budget_lost) : '-'}
        </span>
      ),
    },
    { key: 'bid_signal', label: 'Bid Signal', render: (r) => <span className="text-xs text-gray-500">{r.bid_signal || '-'}</span> },
  ];

  return (
    <PageContainer>
      <PageHeader title="Campaigns" description={`${rows.length} campaigns`} />
      <Card>
        <CardBody className="overflow-x-auto p-0 px-5 py-4">
          <DataTable
            columns={columns}
            data={rows}
            emptyMessage="No campaign data. Import google_campaigns CSV."
          />
        </CardBody>
      </Card>
    </PageContainer>
  );
}
