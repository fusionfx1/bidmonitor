import { useMemo } from 'react';
import {
  DollarSign, MousePointerClick, Eye, TrendingUp, BarChart2,
  Layers, AlertTriangle, Gavel, MinusCircle, Activity, ShieldAlert,
  Clock, XCircle, RefreshCw,
} from 'lucide-react';
import { PageContainer, PageHeader, Card, CardBody } from '../components/Layout';
import { KPICard } from '../components/KPICard';
import { useApp } from '../context/AppContext';
import { sumField, fmtCurrency, fmtPercent } from '../lib/metrics/calculations';
import { computeBidDecisions } from '../lib/decisionEngine/bidDecisions';
import { computeNegativeCandidates } from '../lib/decisionEngine/negativeCandidates';
import { computePolicyIssues } from '../lib/decisionEngine/policyIssues';
import { computeSyncHealth, relativeTime } from '../lib/syncHealth';
import type { FreshnessStatus } from '../lib/syncHealth';
import type { SyncLogStatus } from '../types';

// ─── Sync status banner ───────────────────────────────────────────────────────

const FRESHNESS_CFG: Record<FreshnessStatus, { bg: string; border: string; dot: string; label: string }> = {
  OK:      { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-400', label: 'Fresh' },
  STALE:   { bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-400',   label: 'Stale' },
  ERROR:   { bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-400',     label: 'Error' },
  UNKNOWN: { bg: 'bg-gray-50',    border: 'border-gray-200',    dot: 'bg-gray-300',    label: 'Unknown' },
};

const STATUS_BADGE: Record<SyncLogStatus, string> = {
  SUCCESS: 'bg-emerald-100 text-emerald-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  FAILED:  'bg-red-100 text-red-700',
};

function FreshnessDot({ status }: { status: FreshnessStatus }) {
  const cfg = FRESHNESS_CFG[status];
  return <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot} flex-shrink-0`} />;
}

function SyncBanner() {
  const { data } = useApp();
  const health = useMemo(() => computeSyncHealth(data.syncLog), [data.syncLog]);
  const cfg = FRESHNESS_CFG[health.freshnessStatus];

  if (health.freshnessStatus === 'UNKNOWN' && health.totalRuns === 0) {
    return (
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 mb-4 text-xs text-gray-500">
        <RefreshCw size={12} className="flex-shrink-0 text-gray-400" />
        <span>
          Script run log not found. Add a <code className="font-mono bg-gray-100 px-1 rounded">google_sync_log</code> tab
          to your Google Sheet to track hourly Google Ads Script runs.
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 ${cfg.bg} border ${cfg.border} rounded-xl px-4 py-2.5 mb-4`}>
      {/* Freshness */}
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
        <FreshnessDot status={health.freshnessStatus} />
        <span>{cfg.label}</span>
      </div>

      {/* Runs today */}
      <div className="flex items-center gap-1 text-xs text-gray-600">
        <RefreshCw size={11} className="text-gray-400" />
        <span>
          Script runs today: <strong className="text-gray-800">{health.runsToday}</strong>
          <span className="text-gray-400"> / {health.expectedRunsToday} expected</span>
        </span>
      </div>

      {/* Last run */}
      {health.lastScriptRunAt && (
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <Clock size={11} className="text-gray-400" />
          <span title={new Date(health.lastScriptRunAt).toLocaleString()}>
            Last run: <strong className="text-gray-800">{relativeTime(health.lastScriptRunAt)}</strong>
          </span>
        </div>
      )}

      {/* Status badge */}
      {health.lastStatus && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[health.lastStatus]}`}>
          {health.lastStatus}
        </span>
      )}

      {/* Error message */}
      {health.lastErrorMessage && health.freshnessStatus === 'ERROR' && (
        <div className="flex items-center gap-1 text-xs text-red-600">
          <XCircle size={11} />
          <span className="truncate max-w-xs">{health.lastErrorMessage}</span>
        </div>
      )}

      {/* Total runs chip */}
      <div className="ml-auto text-xs text-gray-400 flex items-center gap-1">
        <Activity size={11} />
        {health.totalRuns} total runs
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Overview() {
  const { data, settings, bidApprovals, negApprovals } = useApp();

  const kpis = useMemo(() => {
    const { campaigns, voluum } = data;
    const hasVoluum = voluum.length > 0;

    const totalSpend = sumField(campaigns, 'cost');
    const clicks = sumField(campaigns, 'clicks');
    const impressions = sumField(campaigns, 'impressions');
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const avgCpc = clicks > 0 ? totalSpend / clicks : 0;
    const googleConversions = sumField(campaigns, 'conversions');
    const voluumConversions = hasVoluum ? sumField(voluum, 'voluum_conversions') : 0;
    const revenue = hasVoluum
      ? sumField(voluum, 'revenue')
      : sumField(campaigns, 'conversion_value');
    const profit = revenue - totalSpend;
    const roi = totalSpend > 0 ? ((revenue - totalSpend) / totalSpend) * 100 : 0;
    const usedConv = hasVoluum ? voluumConversions : googleConversions;
    const cpa = usedConv > 0 ? totalSpend / usedConv : 0;

    const policyIssues = computePolicyIssues(data.policy);
    const bidDecisions = computeBidDecisions(
      data.keywords, data.auctionKeywords, data.auctionCampaigns,
      data.voluum, settings, bidApprovals
    );
    const negCandidates = computeNegativeCandidates(data.searchTerms, settings, negApprovals);

    const bidPending = bidDecisions.filter((d) => d.action !== 'HOLD' && d.approval_status === 'PENDING_REVIEW').length;
    const rankLostCamps = data.auctionCampaigns.filter((c) => c.search_rank_lost_impression_share > 0.2).length;
    const budgetLostCamps = data.auctionCampaigns.filter((c) => c.search_budget_lost_impression_share > 0.2).length;

    return {
      totalSpend, clicks, impressions, ctr, avgCpc,
      googleConversions, voluumConversions, revenue, profit, roi, cpa,
      policyIssuesCount: policyIssues.length,
      bidActionsPending: bidPending,
      negativeCandidatesCount: negCandidates.length,
      campaignsRankLost: rankLostCamps,
      campaignsBudgetLost: budgetLostCamps,
    };
  }, [data, settings, bidApprovals, negApprovals]);

  const hasData = data.campaigns.length > 0;

  return (
    <PageContainer>
      <PageHeader
        title="Overview"
        description={hasData ? `Showing aggregated metrics from imported data` : undefined}
      />

      <SyncBanner />

      {!hasData && (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <Layers size={40} className="text-gray-300 mx-auto mb-3" />
              <h3 className="text-gray-600 font-medium mb-1">No data imported yet</h3>
              <p className="text-gray-400 text-sm">Go to Import Data to load your Google Ads CSV exports.</p>
            </div>
          </CardBody>
        </Card>
      )}

      {hasData && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
            <KPICard
              label="Total Spend"
              value={fmtCurrency(kpis.totalSpend, settings.currency)}
              color="default"
              icon={<DollarSign size={16} />}
            />
            <KPICard
              label="Clicks"
              value={kpis.clicks.toLocaleString()}
              icon={<MousePointerClick size={16} />}
            />
            <KPICard
              label="Impressions"
              value={kpis.impressions.toLocaleString()}
              icon={<Eye size={16} />}
            />
            <KPICard
              label="CTR"
              value={fmtPercent(kpis.ctr)}
              icon={<Activity size={16} />}
            />
            <KPICard
              label="Avg CPC"
              value={fmtCurrency(kpis.avgCpc, settings.currency)}
              icon={<BarChart2 size={16} />}
            />
            <KPICard
              label="Google Conv."
              value={kpis.googleConversions.toFixed(1)}
              icon={<TrendingUp size={16} />}
            />
            <KPICard
              label="Voluum Conv."
              value={data.voluum.length > 0 ? kpis.voluumConversions.toFixed(1) : 'N/A'}
              sub={data.voluum.length === 0 ? 'Voluum not connected' : undefined}
              color={data.voluum.length === 0 ? 'amber' : 'default'}
            />
            <KPICard
              label="Revenue"
              value={fmtCurrency(kpis.revenue, settings.currency)}
              color={kpis.revenue > 0 ? 'green' : 'default'}
              icon={<DollarSign size={16} />}
            />
            <KPICard
              label="Profit"
              value={fmtCurrency(kpis.profit, settings.currency)}
              color={kpis.profit > 0 ? 'green' : kpis.profit < 0 ? 'red' : 'default'}
            />
            <KPICard
              label="ROI"
              value={`${kpis.roi.toFixed(1)}%`}
              color={kpis.roi > 0 ? 'green' : kpis.roi < 0 ? 'red' : 'default'}
            />
            <KPICard
              label="CPA"
              value={kpis.cpa > 0 ? fmtCurrency(kpis.cpa, settings.currency) : 'N/A'}
              sub={`Target: ${fmtCurrency(settings.target_cpa, settings.currency)}`}
              color={kpis.cpa > 0 && kpis.cpa <= settings.target_cpa ? 'green' : kpis.cpa > settings.target_cpa ? 'red' : 'default'}
            />
            <KPICard
              label="Policy Issues"
              value={kpis.policyIssuesCount}
              color={kpis.policyIssuesCount > 0 ? 'red' : 'green'}
              icon={<ShieldAlert size={16} />}
            />
            <KPICard
              label="Bid Actions Pending"
              value={kpis.bidActionsPending}
              color={kpis.bidActionsPending > 0 ? 'amber' : 'green'}
              icon={<Gavel size={16} />}
            />
            <KPICard
              label="Negative Candidates"
              value={kpis.negativeCandidatesCount}
              color={kpis.negativeCandidatesCount > 0 ? 'amber' : 'green'}
              icon={<MinusCircle size={16} />}
            />
            <KPICard
              label="Rank-Lost Campaigns"
              value={kpis.campaignsRankLost}
              color={kpis.campaignsRankLost > 0 ? 'amber' : 'green'}
            />
            <KPICard
              label="Budget-Lost Campaigns"
              value={kpis.campaignsBudgetLost}
              color={kpis.campaignsBudgetLost > 0 ? 'blue' : 'green'}
            />
          </div>

          {data.voluum.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-center gap-2">
              <AlertTriangle size={16} className="flex-shrink-0" />
              Voluum data is not connected. Revenue and conversion metrics are sourced from Google Ads data only.
              Import <code className="font-mono bg-amber-100 px-1 rounded">voluum_performance</code> CSV to enable Voluum analytics.
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
