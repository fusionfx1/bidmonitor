import { useMemo, useState } from 'react';
import { AlertTriangle, Copy, ShieldCheck } from 'lucide-react';
import { PageContainer, PageHeader, Card, CardBody, CardHeader } from '../components/Layout';
import { DataTable, type Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { useApp } from '../context/AppContext';
import { fmtCurrency } from '../lib/metrics/calculations';
import {
  buildProposalQueue,
  defaultProposalGuardrails,
  rejectedOutOfScopeProposal,
  type ProposalFeedContractRow,
  type ProposalQueueItem,
} from '../lib/proposalQueue';

function stateVariant(state: string): 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'purple' {
  if (state === 'ready' || state === 'approved' || state === 'dry_run') return 'green';
  if (state.includes('deny') || state.includes('failed')) return 'red';
  if (state.includes('skipped')) return 'amber';
  if (state === 'rolled_back') return 'purple';
  return 'gray';
}

function riskVariant(risk: string): 'green' | 'red' | 'amber' | 'gray' {
  if (risk === 'low') return 'green';
  if (risk === 'high') return 'red';
  if (risk === 'medium') return 'amber';
  return 'gray';
}

function formatValue(value: number | string | null, currency: string): string {
  if (typeof value === 'number') return fmtCurrency(value, currency);
  return value ?? '-';
}

export function AutoBidFeed() {
  const { data, settings } = useApp();
  const [localAllowlistOn, setLocalAllowlistOn] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const visibleCampaignIds = useMemo(
    () => [...new Set(data.campaigns.map((row) => row.campaign_id).filter(Boolean))],
    [data.campaigns]
  );
  const guardrails = useMemo(() => ({
    ...defaultProposalGuardrails(settings),
    allowlistedCampaignIds: localAllowlistOn ? visibleCampaignIds : [],
  }), [localAllowlistOn, settings, visibleCampaignIds]);
  const model = useMemo(() => buildProposalQueue(data, settings, guardrails), [data, settings, guardrails]);
  const outOfScope = useMemo(() => [
    rejectedOutOfScopeProposal('SET_BID', 'Bid changes are review/export-only in v1.'),
    rejectedOutOfScopeProposal('ADD_NEGATIVE_KEYWORD', 'Task 5 negative candidates are review/export-only in v1.'),
    rejectedOutOfScopeProposal('SET_DEVICE_MODIFIER', 'Device modifiers are later-phase only.'),
  ], []);

  const copyText = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const proposalColumns = useMemo<Column<ProposalQueueItem>[]>(() => [
    { key: 'action', label: 'Action', render: (row) => <Badge variant="blue">{row.action}</Badge> },
    { key: 'campaignName', label: 'Campaign', render: (row) => <span className="font-medium text-gray-900">{row.campaignName}</span> },
    { key: 'oldValue', label: 'Old', align: 'right', render: (row) => formatValue(row.oldValue, settings.currency) },
    { key: 'newValue', label: 'New', align: 'right', render: (row) => formatValue(row.newValue, settings.currency) },
    { key: 'risk', label: 'Risk', render: (row) => <Badge variant={riskVariant(row.risk)}>{row.risk}</Badge> },
    { key: 'approvalStatus', label: 'Approval', render: (row) => <Badge>{row.approvalStatus}</Badge> },
    { key: 'auditState', label: 'State', render: (row) => <Badge variant={stateVariant(row.auditState)}>{row.auditState}</Badge> },
    {
      key: 'reason',
      label: 'Guardrail',
      sortable: false,
      render: (row) => <span className="max-w-[320px] block text-xs text-gray-500">{row.guardrail.reasons.join(' ')}</span>,
    },
    { key: 'expiresAt', label: 'Expires', render: (row) => new Date(row.expiresAt).toLocaleString() },
  ], [settings.currency]);

  const feedColumns = useMemo<Column<ProposalFeedContractRow>[]>(() => [
    { key: 'proposal_id', label: 'Proposal' },
    { key: 'action', label: 'Action', render: (row) => <Badge variant="blue">{row.action}</Badge> },
    { key: 'campaign_id', label: 'Campaign ID' },
    { key: 'expected_current_value', label: 'Expected', align: 'right', render: (row) => formatValue(row.expected_current_value, settings.currency) },
    { key: 'target_value', label: 'Target', align: 'right', render: (row) => formatValue(row.target_value, settings.currency) },
    { key: 'mode', label: 'Mode', render: (row) => <Badge variant="green">{row.mode}</Badge> },
    { key: 'token_hint', label: 'Token', render: (row) => <Badge>{row.token_hint}</Badge> },
  ], [settings.currency]);

  return (
    <PageContainer>
      <PageHeader
        title="Proposal Queue"
        description="Review-only campaign update queue, dry-run feed preview, guardrails, audit states, and rollback metadata."
        actions={(
          <button
            onClick={() => void copyText('debug', model.debugPacket)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
          >
            <Copy size={14} />
            {copied === 'debug' ? 'Copied' : 'Copy Debug Packet'}
          </button>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="Ready" value={String(model.readyCount)} />
        <Kpi label="Blocked" value={String(model.blockedCount)} />
        <Kpi label="Freshness" value={model.freshnessStatus} />
        <Kpi label="Kill switch" value={model.killSwitchOn ? 'ON' : 'OFF'} />
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-900 mb-4 flex gap-3">
        <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
        <div>
          <strong>Safety lane:</strong> this page does not mutate Google Ads and does not publish live apply rows. v1 feed scope is only SET_BUDGET, PAUSE_CAMPAIGN, ENABLE_CAMPAIGN, and SET_CAMPAIGN_LABEL. Bid and negative-keyword candidates remain review/export-only.
        </div>
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Guardrail controls"
          actions={<ShieldCheck size={16} className="text-emerald-500" />}
        />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <label className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
              <input
                type="checkbox"
                checked={localAllowlistOn}
                onChange={(event) => setLocalAllowlistOn(event.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="font-medium text-gray-900 block">Local allowlist preview</span>
                <span className="text-xs text-gray-500">Off by default. Turning this on only previews feed eligibility for visible campaigns; it does not persist or apply.</span>
              </span>
            </label>
            <Guardrail label="Mode required" value="dry_run + apply disabled" />
            <Guardrail label="Max budget delta" value={`${guardrails.maxBudgetChangePercent}%`} />
            <Guardrail label="Max actions / campaign / day" value={String(guardrails.maxActionsPerCampaignPerDay)} />
            <Guardrail label="Allowlisted campaigns" value={String(guardrails.allowlistedCampaignIds.length)} />
            <Guardrail label="Audit states" value={String(model.auditStates.length)} />
          </div>
        </CardBody>
      </Card>

      <Card className="mb-5">
        <CardHeader title="Proposal queue" />
        <CardBody>
          <DataTable
            columns={proposalColumns}
            data={model.proposals}
            emptyMessage="No campaign proposal rows. Create budget proposals from Budget Optimizer first."
            rowKey={(row) => row.id}
          />
        </CardBody>
      </Card>

      <Card className="mb-5">
        <CardHeader
          title="Dry-run feed contract preview"
          actions={(
            <button
              onClick={() => void copyText('feed', JSON.stringify(model.feedPreview, null, 2))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
            >
              <Copy size={14} />
              {copied === 'feed' ? 'Copied' : 'Copy Feed JSON'}
            </button>
          )}
        />
        <CardBody>
          <DataTable
            columns={feedColumns}
            data={model.feedPreview}
            emptyMessage="No feed-eligible preview rows. Guardrails are fail-closed until mode, freshness, and allowlist pass."
            rowKey={(row) => row.proposal_id}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Out-of-scope v1 actions" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {outOfScope.map((item) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                <Badge variant="red">{item.campaignName}</Badge>
                <p className="mt-2 text-xs text-gray-500">{item.dryRunPreview}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </PageContainer>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function Guardrail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-semibold text-gray-900">{value}</div>
    </div>
  );
}
