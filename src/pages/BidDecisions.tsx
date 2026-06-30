import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { PageContainer, PageHeader, Card, CardBody, ExportButton } from '../components/Layout';
import { DataTable, type Column } from '../components/DataTable';
import { ActionBadge } from '../components/Badge';
import { useApp } from '../context/AppContext';
import { computeBidDecisions } from '../lib/decisionEngine/bidDecisions';
import { exportBidDecisionsCSV } from '../lib/export';
import { fmtCurrency, fmtPercent } from '../lib/metrics/calculations';
import { actionQueueBlockedReason, buildKeywordBidActionPackage, queueKeywordBidAction } from '../lib/actionQueue';
import type { BidDecision, ApprovalStatus } from '../types';

const APPROVAL_OPTIONS: ApprovalStatus[] = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'WATCHLIST'];

type RowState = Record<string, string>;

export function BidDecisions() {
  const { data, settings, bidApprovals, setBidApproval } = useApp();
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [rowState, setRowState] = useState<RowState>({});
  const blockedReason = actionQueueBlockedReason(settings);

  const decisions = useMemo(
    () => computeBidDecisions(
      data.keywords, data.auctionKeywords, data.auctionCampaigns,
      data.voluum, settings, bidApprovals
    ),
    [data, settings, bidApprovals]
  );

  const filtered = filterAction === 'ALL'
    ? decisions
    : decisions.filter((d) => d.action === filterAction);

  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: decisions.length };
    for (const d of decisions) counts[d.action] = (counts[d.action] || 0) + 1;
    return counts;
  }, [decisions]);

  const mark = (key: string, value: string) => setRowState((prev) => ({ ...prev, [key]: value }));

  const copyRow = async (row: BidDecision) => {
    try {
      await navigator.clipboard.writeText(buildKeywordBidActionPackage(row, settings).json);
      mark(row.keyword_key, 'copied');
      setTimeout(() => mark(row.keyword_key, ''), 1500);
    } catch (e) {
      mark(row.keyword_key, String(e instanceof Error ? e.message : e));
    }
  };

  const pushRow = async (row: BidDecision) => {
    try {
      mark(row.keyword_key, 'working');
      await queueKeywordBidAction(row, settings);
      mark(row.keyword_key, 'queued');
    } catch (e) {
      mark(row.keyword_key, String(e instanceof Error ? e.message : e));
    }
  };

  const columns: Column<BidDecision>[] = [
    { key: 'keyword', label: 'Keyword', render: (r) => <span className="font-medium text-gray-900 max-w-[160px] truncate block">{r.keyword}</span>, width: '160px' },
    { key: 'match_type', label: 'Match', render: (r) => <span className="text-xs bg-gray-100 rounded px-1.5 py-0.5">{r.match_type}</span> },
    { key: 'campaign', label: 'Campaign', render: (r) => <span className="text-xs text-gray-500 max-w-[120px] truncate block">{r.campaign}</span> },
    { key: 'current_bid', label: 'Current Bid', align: 'right', render: (r) => r.current_bid > 0 ? fmtCurrency(r.current_bid, settings.currency) : '-' },
    { key: 'recommended_bid', label: 'Rec. Bid', align: 'right', render: (r) => r.recommended_bid != null ? <span className="font-mono font-semibold text-blue-700">{fmtCurrency(r.recommended_bid, settings.currency)}</span> : <span className="text-gray-400">-</span> },
    { key: 'cost', label: 'Cost', align: 'right', render: (r) => fmtCurrency(r.cost, settings.currency) },
    { key: 'clicks', label: 'Clicks', align: 'right', render: (r) => r.clicks.toLocaleString() },
    { key: 'used_conversions', label: 'Used Conv.', align: 'right', render: (r) => r.used_conversions.toFixed(1) },
    { key: 'cpa', label: 'CPA', align: 'right', render: (r) => <span className={r.cpa > 0 && r.cpa <= settings.target_cpa ? 'text-emerald-600' : r.cpa > settings.target_cpa ? 'text-red-600' : ''}>{r.cpa > 0 ? fmtCurrency(r.cpa, settings.currency) : '-'}</span> },
    { key: 'profit', label: 'Profit', align: 'right', render: (r) => <span className={r.profit > 0 ? 'text-emerald-600' : r.profit < 0 ? 'text-red-600' : ''}>{fmtCurrency(r.profit, settings.currency)}</span> },
    { key: 'search_impression_share', label: 'IS', align: 'right', render: (r) => r.search_impression_share > 0 ? fmtPercent(r.search_impression_share) : '-' },
    { key: 'rank_lost', label: 'Rank Lost', align: 'right', render: (r) => r.rank_lost > 0 ? <span className={r.rank_lost >= 0.3 ? 'text-amber-600' : ''}>{fmtPercent(r.rank_lost)}</span> : '-' },
    { key: 'action', label: 'Action', render: (r) => <ActionBadge action={r.action} />, sortable: false },
    { key: 'reason', label: 'Reason', render: (r) => <span className="text-xs text-gray-500 max-w-[200px] block">{r.reason}</span>, sortable: false },
    {
      key: 'approval_status', label: 'Approval', sortable: false,
      render: (r) => (
        <select value={r.approval_status} onChange={(e) => setBidApproval(r.keyword_key, e.target.value as ApprovalStatus)} onClick={(e) => e.stopPropagation()} className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
          {APPROVAL_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      ),
    },
    {
      key: 'queue', label: 'Queue', sortable: false,
      render: (r) => {
        const state = rowState[r.keyword_key];
        const actionable = r.action === 'INCREASE_BID' || r.action === 'DECREASE_BID';
        const disabled = Boolean(blockedReason) || !actionable || r.approval_status !== 'APPROVED' || state === 'working';
        return <div className="flex items-center gap-2"><button disabled={disabled} title={blockedReason ?? (r.approval_status !== 'APPROVED' ? 'Set approval to APPROVED first' : '')} onClick={(event) => { event.stopPropagation(); void pushRow(r); }} className="px-2 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-40">{state === 'working' ? 'Working' : state === 'queued' ? 'Queued' : 'Queue'}</button><button disabled={!actionable} onClick={(event) => { event.stopPropagation(); void copyRow(r); }} className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40">{state === 'copied' ? 'Copied' : 'Copy'}</button>{state && !['working', 'queued', 'copied'].includes(state) && <span className="text-xs text-red-600">{state}</span>}</div>;
      },
    },
  ];

  const actionFilters = ['ALL', 'INCREASE_BID', 'DECREASE_BID', 'PAUSE_CANDIDATE', 'INCREASE_BUDGET_CANDIDATE', 'HOLD'];

  return (
    <PageContainer>
      <PageHeader title="Bid Decisions" description="Review recommendations, approve rows, then write approved rows to the Sheet queue." actions={decisions.length > 0 ? <ExportButton label="Export CSV" onClick={() => exportBidDecisionsCSV(decisions)} /> : undefined} />

      {settings.action_mode === 'disabled' && <div className="bg-gray-100 border border-gray-200 rounded-xl p-4 text-sm text-gray-600 mb-4 flex items-center gap-2"><AlertTriangle size={16} className="flex-shrink-0" />Auto-bid mode is disabled. Enable it in Settings to see actionable recommendations.</div>}
      {blockedReason && settings.action_mode !== 'disabled' && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-4">Queue disabled: {blockedReason}</div>}

      <div className="flex gap-2 mb-4 flex-wrap">
        {actionFilters.map((action) => <button key={action} onClick={() => setFilterAction(action)} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${filterAction === action ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{action.replace(/_/g, ' ')} {actionCounts[action] != null ? `(${actionCounts[action]})` : ''}</button>)}
      </div>

      <Card>
        <CardBody className="p-0 px-5 py-4">
          <DataTable columns={columns} data={filtered} emptyMessage="No bid decisions generated. Import google_keywords and google_auction_proxy_keywords CSVs." rowKey={(r) => (r as unknown as BidDecision).keyword_key} />
        </CardBody>
      </Card>
    </PageContainer>
  );
}
