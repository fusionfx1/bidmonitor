import { useMemo } from 'react';
import { PageContainer, PageHeader, Card, CardBody } from '../components/Layout';
import { DataTable, type Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { useApp } from '../context/AppContext';
import { fmtCurrency } from '../lib/metrics/calculations';

interface SearchTermSummary {
  search_term: string;
  campaign: string;
  ad_group: string;
  clicks: number;
  cost: number;
  conversions: number;
  cpa: number;
  recommendation: string;
  reason: string;
}

export function SearchTerms() {
  const { data, settings } = useApp();

  const rows = useMemo((): SearchTermSummary[] => {
    const map = new Map<string, SearchTermSummary>();

    for (const st of data.searchTerms) {
      const key = `${st.search_term}__${st.campaign_id}__${st.ad_group_id}`;
      const existing = map.get(key);
      if (existing) {
        existing.clicks += st.clicks;
        existing.cost += st.cost;
        existing.conversions += st.conversions;
      } else {
        map.set(key, {
          search_term: st.search_term,
          campaign: st.campaign_name,
          ad_group: st.ad_group_name,
          clicks: st.clicks,
          cost: st.cost,
          conversions: st.conversions,
          cpa: 0,
          recommendation: 'HOLD',
          reason: '',
        });
      }
    }

    return Array.from(map.values()).map((st) => {
      const cpa = st.conversions > 0 ? st.cost / st.conversions : 0;
      let recommendation = 'HOLD';
      let reason = '';

      if (st.conversions > 0 && cpa <= settings.target_cpa) {
        recommendation = 'KEEP';
        reason = `Converting at ${fmtCurrency(cpa, settings.currency)} CPA`;
      } else if (st.cost >= settings.payout * 0.7 && st.conversions === 0) {
        recommendation = 'NEGATIVE_CANDIDATE';
        reason = `Cost ${fmtCurrency(st.cost, settings.currency)} with 0 conv`;
      } else if (st.clicks >= settings.min_clicks && st.conversions === 0) {
        recommendation = 'NEGATIVE_CANDIDATE';
        reason = `${st.clicks} clicks with 0 conv`;
      } else if (st.conversions > 0 && cpa > settings.target_cpa) {
        recommendation = 'REVIEW';
        reason = `CPA ${fmtCurrency(cpa, settings.currency)} > target`;
      }

      return { ...st, cpa, recommendation, reason };
    }).sort((a, b) => b.cost - a.cost);
  }, [data, settings]);

  const columns: Column<SearchTermSummary>[] = [
    { key: 'search_term', label: 'Search Term', render: (r) => <span className="font-medium text-gray-900">{r.search_term}</span>, width: '220px' },
    { key: 'campaign', label: 'Campaign', render: (r) => <span className="text-xs text-gray-500 max-w-[140px] truncate block">{r.campaign}</span> },
    { key: 'ad_group', label: 'Ad Group', render: (r) => <span className="text-xs text-gray-500 max-w-[120px] truncate block">{r.ad_group}</span> },
    { key: 'clicks', label: 'Clicks', align: 'right', render: (r) => r.clicks.toLocaleString() },
    { key: 'cost', label: 'Cost', align: 'right', render: (r) => fmtCurrency(r.cost, settings.currency) },
    { key: 'conversions', label: 'Conv.', align: 'right', render: (r) => r.conversions.toFixed(1) },
    {
      key: 'cpa', label: 'CPA', align: 'right',
      render: (r) => <span className={r.cpa > 0 && r.cpa <= settings.target_cpa ? 'text-emerald-600' : r.cpa > settings.target_cpa ? 'text-red-600' : ''}>{r.cpa > 0 ? fmtCurrency(r.cpa, settings.currency) : '-'}</span>,
    },
    {
      key: 'recommendation', label: 'Recommendation', sortable: false,
      render: (r) => {
        const v: Record<string, string> = { KEEP: 'green', NEGATIVE_CANDIDATE: 'red', REVIEW: 'amber', HOLD: 'gray' };
        return <Badge variant={(v[r.recommendation] as 'green' | 'red' | 'amber' | 'gray') ?? 'gray'}>{r.recommendation.replace(/_/g, ' ')}</Badge>;
      },
    },
    { key: 'reason', label: 'Reason', render: (r) => <span className="text-xs text-gray-500">{r.reason}</span>, sortable: false },
  ];

  return (
    <PageContainer>
      <PageHeader title="Search Terms" description={`${rows.length} unique search terms`} />
      <Card>
        <CardBody className="p-0 px-5 py-4">
          <DataTable
            columns={columns}
            data={rows}
            emptyMessage="No search term data. Import google_search_terms CSV."
          />
        </CardBody>
      </Card>
    </PageContainer>
  );
}
