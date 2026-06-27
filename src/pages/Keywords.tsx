import { useMemo } from 'react';
import { PageContainer, PageHeader, Card, CardBody } from '../components/Layout';
import { DataTable, type Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { useApp } from '../context/AppContext';
import { fmtCurrency, fmtPercent } from '../lib/metrics/calculations';

interface KwSummary {
  keyword_key: string;
  keyword: string;
  match_type: string;
  campaign: string;
  ad_group: string;
  status: string;
  current_bid: number;
  spend: number;
  clicks: number;
  conversions: number;
  revenue: number;
  profit: number;
  roi: number;
  cpa: number;
  search_impression_share: number;
  rank_lost: number;
  absolute_top_rate: number;
  recommended_action: string;
}

export function Keywords() {
  const { data, settings } = useApp();

  const rows = useMemo((): KwSummary[] => {
    const map = new Map<string, KwSummary>();

    for (const k of data.keywords) {
      const existing = map.get(k.keyword_key);
      if (existing) {
        existing.spend += k.cost;
        existing.clicks += k.clicks;
        existing.conversions += k.conversions;
        if (k.keyword_cpc_bid > 0) existing.current_bid = k.keyword_cpc_bid;
      } else {
        map.set(k.keyword_key, {
          keyword_key: k.keyword_key,
          keyword: k.keyword,
          match_type: k.match_type,
          campaign: k.campaign_name,
          ad_group: k.ad_group_name,
          status: k.keyword_status,
          current_bid: k.keyword_cpc_bid,
          spend: k.cost,
          clicks: k.clicks,
          conversions: k.conversions,
          revenue: k.conversion_value,
          profit: 0,
          roi: 0,
          cpa: 0,
          search_impression_share: 0,
          rank_lost: 0,
          absolute_top_rate: 0,
          recommended_action: 'HOLD',
        });
      }
    }

    // Merge auction data
    for (const ak of data.auctionKeywords) {
      const k = map.get(ak.keyword_key);
      if (k) {
        k.search_impression_share = ak.search_impression_share;
        k.rank_lost = ak.search_rank_lost_impression_share;
        k.absolute_top_rate = ak.absolute_top_impression_percentage;
      }
    }

    return Array.from(map.values()).map((k) => {
      const hasVol = data.voluum.length > 0;
      const volData = hasVol
        ? data.voluum.filter((v) => v.keyword_key === k.keyword_key)
        : [];
      const revenue = hasVol && volData.length > 0
        ? volData.reduce((s, v) => s + v.revenue, 0)
        : k.revenue;
      const usedConv = hasVol && volData.length > 0
        ? volData.reduce((s, v) => s + v.voluum_conversions, 0)
        : k.conversions;

      const cpa = usedConv > 0 ? k.spend / usedConv : 0;
      const profit = revenue - k.spend;
      const roi = k.spend > 0 ? ((revenue - k.spend) / k.spend) * 100 : 0;

      let action = 'HOLD';
      if (k.clicks >= settings.min_clicks && k.spend >= settings.payout * 1.2 && usedConv === 0) action = 'PAUSE';
      else if (usedConv >= 2 && cpa <= settings.target_cpa && k.rank_lost >= 0.3) action = 'INCREASE_BID';
      else if (k.clicks >= settings.min_clicks && k.spend >= settings.payout * 0.8 && usedConv === 0) action = 'DECREASE_BID';

      return { ...k, revenue, profit, roi, cpa, recommended_action: action };
    }).sort((a, b) => b.spend - a.spend);
  }, [data, settings]);

  const columns: Column<KwSummary>[] = [
    { key: 'keyword', label: 'Keyword', render: (r) => <span className="font-medium text-gray-900">{r.keyword}</span>, width: '180px' },
    { key: 'match_type', label: 'Match', render: (r) => <Badge>{r.match_type}</Badge> },
    { key: 'campaign', label: 'Campaign', render: (r) => <span className="text-xs text-gray-500 max-w-[140px] truncate block">{r.campaign}</span> },
    { key: 'ad_group', label: 'Ad Group', render: (r) => <span className="text-xs text-gray-500 max-w-[120px] truncate block">{r.ad_group}</span> },
    { key: 'status', label: 'Status', render: (r) => <Badge variant={r.status === 'ENABLED' ? 'green' : 'amber'}>{r.status}</Badge> },
    { key: 'current_bid', label: 'CPC Bid', align: 'right', render: (r) => r.current_bid > 0 ? fmtCurrency(r.current_bid, settings.currency) : '-' },
    { key: 'spend', label: 'Spend', align: 'right', render: (r) => fmtCurrency(r.spend, settings.currency) },
    { key: 'clicks', label: 'Clicks', align: 'right', render: (r) => r.clicks.toLocaleString() },
    { key: 'conversions', label: 'Conv.', align: 'right', render: (r) => r.conversions.toFixed(1) },
    { key: 'revenue', label: 'Revenue', align: 'right', render: (r) => fmtCurrency(r.revenue, settings.currency) },
    {
      key: 'profit', label: 'Profit', align: 'right',
      render: (r) => <span className={r.profit > 0 ? 'text-emerald-600' : r.profit < 0 ? 'text-red-600' : ''}>{fmtCurrency(r.profit, settings.currency)}</span>,
    },
    { key: 'roi', label: 'ROI', align: 'right', render: (r) => `${r.roi.toFixed(1)}%` },
    {
      key: 'cpa', label: 'CPA', align: 'right',
      render: (r) => <span className={r.cpa > 0 && r.cpa <= settings.target_cpa ? 'text-emerald-600' : r.cpa > settings.target_cpa ? 'text-red-600' : ''}>{r.cpa > 0 ? fmtCurrency(r.cpa, settings.currency) : '-'}</span>,
    },
    { key: 'search_impression_share', label: 'IS', align: 'right', render: (r) => r.search_impression_share > 0 ? fmtPercent(r.search_impression_share) : '-' },
    { key: 'rank_lost', label: 'Rank Lost', align: 'right', render: (r) => r.rank_lost > 0 ? <span className={r.rank_lost > 0.2 ? 'text-amber-600' : ''}>{fmtPercent(r.rank_lost)}</span> : '-' },
    { key: 'absolute_top_rate', label: 'Abs Top', align: 'right', render: (r) => r.absolute_top_rate > 0 ? fmtPercent(r.absolute_top_rate) : '-' },
    {
      key: 'recommended_action', label: 'Action', sortable: false,
      render: (r) => {
        const v: Record<string, string> = { INCREASE_BID: 'green', DECREASE_BID: 'amber', PAUSE: 'red', HOLD: 'gray' };
        return <Badge variant={(v[r.recommended_action] as 'green' | 'amber' | 'red' | 'gray') ?? 'gray'}>{r.recommended_action.replace(/_/g, ' ')}</Badge>;
      },
    },
  ];

  return (
    <PageContainer>
      <PageHeader title="Keywords" description={`${rows.length} keywords`} />
      <Card>
        <CardBody className="p-0 px-5 py-4">
          <DataTable
            columns={columns}
            data={rows}
            emptyMessage="No keyword data. Import google_keywords CSV."
          />
        </CardBody>
      </Card>
    </PageContainer>
  );
}
