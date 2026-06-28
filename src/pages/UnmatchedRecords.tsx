import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Link2, Trash2, Plus, Loader2, CheckCircle, XCircle,
  AlertTriangle, RefreshCw,
} from 'lucide-react';
import { PageContainer, PageHeader, Card, CardHeader, CardBody, EmptyState } from '../components/Layout';
import { useApp } from '../context/AppContext';
import {
  buildReconciledRecords, aggregateGadsByCampaign, aggregateNormalizedVoluumByCampaign,
} from '../lib/reconciliation/engine';
import {
  loadCampaignMappings, saveCampaignMapping, deleteCampaignMapping,
  CAMPAIGN_MAPPING_WRITES_ENABLED,
  type CampaignMapping,
} from '../lib/googleAds/api';
import { fetchVoluumReport, resolveDateRange } from '../lib/voluum/api';
import { normalizeRows } from '../lib/voluum/normalize';
import type { NormalizedVoluumRow } from '../lib/voluum/types';

export function UnmatchedRecords() {
  const { data } = useApp();

  const [voluumRows, setVoluumRows] = useState<NormalizedVoluumRow[]>([]);
  const [mappings,   setMappings]   = useState<CampaignMapping[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState<string | null>(null);
  const [selectedGads, setSelectedGads] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mappingsResult, reportResult] = await Promise.all([
        loadCampaignMappings(),
        (async () => {
          const { from, to } = resolveDateRange('last7');
          return fetchVoluumReport({ from, to, groupBy: 'campaign', limit: 500 });
        })(),
      ]);
      setMappings(mappingsResult);
      if (!reportResult.credentialsMissing) {
        const { from, to } = resolveDateRange('last7');
        setVoluumRows(normalizeRows(reportResult.rows ?? [], `${from.slice(0,10)}/${to.slice(0,10)}`));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const gadsAgg   = useMemo(() => aggregateGadsByCampaign(data.campaigns),          [data.campaigns]);
  const voluumAgg = useMemo(() => aggregateNormalizedVoluumByCampaign(voluumRows),   [voluumRows]);

  const allRecords = useMemo(
    () => buildReconciledRecords(voluumAgg, gadsAgg, mappings),
    [voluumAgg, gadsAgg, mappings]
  );

  const unmatchedVoluum = allRecords.filter((r) => r.matchType === 'unmatched' && r.voluum_clicks > 0);
  const unmatchedGads   = allRecords.filter((r) => r.matchType === 'unmatched' && r.gads_clicks  > 0);
  const gadsNames       = gadsAgg.map((r) => r.campaignName);

  async function handleSaveMapping(voluumName: string) {
    if (!CAMPAIGN_MAPPING_WRITES_ENABLED) {
      setError('Campaign mapping writes are disabled in review-only mode.');
      return;
    }
    const gadsName = selectedGads[voluumName];
    if (!gadsName) return;
    setSaving(voluumName);
    setError(null);
    try {
      await saveCampaignMapping({ voluum_campaign_name: voluumName, gads_campaign_name: gadsName });
      setSuccess(`Mapped "${voluumName}" → "${gadsName}"`);
      setTimeout(() => setSuccess(null), 3000);
      await load();
      setSelectedGads((p) => { const n = { ...p }; delete n[voluumName]; return n; });
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(null);
    }
  }

  async function handleDelete(id: string) {
    if (!CAMPAIGN_MAPPING_WRITES_ENABLED) {
      setError('Campaign mapping deletes are disabled in review-only mode.');
      return;
    }
    setDeleting(id);
    setError(null);
    try {
      await deleteCampaignMapping(id);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(null);
    }
  }

  const hasData = data.campaigns.length > 0 || voluumRows.length > 0;

  return (
    <PageContainer>
      <PageHeader
        title="Unmatched Records"
        description="Campaigns in one platform that couldn't be auto-matched — create manual mappings to fix them"
        actions={
          <button onClick={load} disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Refresh
          </button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4 text-xs text-red-700">
          <XCircle size={13} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 mb-4 text-xs text-emerald-700">
          <CheckCircle size={13} /> {success}
        </div>
      )}

      {!hasData ? (
        <Card>
          <CardBody>
            <EmptyState
              message="Import Google Ads campaigns and configure Voluum to detect unmatched records."
              icon={<Link2 size={32} />}
            />
          </CardBody>
        </Card>
      ) : (
        <>
          {/* Saved manual mappings */}
          <Card className="mb-5">
            <CardHeader
              title={`Manual Mappings (${mappings.length})`}
              actions={<span className="text-xs text-gray-400">Review-only · Supabase writes disabled</span>}
            />
            {mappings.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-400 text-center">No manual mappings yet.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {mappings.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-medium text-gray-800 max-w-[200px] truncate" title={m.voluum_campaign_name}>{m.voluum_campaign_name}</span>
                      <Link2 size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-gray-600 max-w-[200px] truncate" title={m.gads_campaign_name}>{m.gads_campaign_name}</span>
                    </div>
                    <button
                      onClick={() => handleDelete(m.id!)}
                      disabled={!CAMPAIGN_MAPPING_WRITES_ENABLED || deleting === m.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title={CAMPAIGN_MAPPING_WRITES_ENABLED ? 'Remove mapping' : 'Mapping deletes disabled in review-only mode'}
                    >
                      {deleting === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Unmatched Voluum */}
            <Card>
              <CardHeader
                title={`In Voluum, not in Google Ads (${unmatchedVoluum.length})`}
                actions={unmatchedVoluum.length > 0 ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{unmatchedVoluum.length}</span> : undefined}
              />
              {unmatchedVoluum.length === 0 ? (
                <div className="px-4 py-6 text-sm text-emerald-600 text-center flex items-center justify-center gap-2">
                  <CheckCircle size={16} /> All Voluum campaigns matched.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {unmatchedVoluum.map((r) => (
                    <div key={r.campaignName} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="text-sm font-medium text-gray-800 max-w-[220px] truncate" title={r.campaignName}>{r.campaignName}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{r.voluum_clicks.toLocaleString()} clicks · {r.voluum_conversions} conv</div>
                        </div>
                        <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={selectedGads[r.campaignName] ?? ''}
                          onChange={(e) => setSelectedGads((p) => ({ ...p, [r.campaignName]: e.target.value }))}
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                          <option value="">— Select Google Ads campaign —</option>
                          {gadsNames.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <button
                          onClick={() => handleSaveMapping(r.campaignName)}
                          disabled={!CAMPAIGN_MAPPING_WRITES_ENABLED || !selectedGads[r.campaignName] || saving === r.campaignName}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                          title={CAMPAIGN_MAPPING_WRITES_ENABLED ? 'Map campaign' : 'Mapping writes disabled in review-only mode'}
                        >
                          {saving === r.campaignName ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                          Map
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Unmatched GAds */}
            <Card>
              <CardHeader
                title={`In Google Ads, not in Voluum (${unmatchedGads.length})`}
                actions={unmatchedGads.length > 0 ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{unmatchedGads.length}</span> : undefined}
              />
              {unmatchedGads.length === 0 ? (
                <div className="px-4 py-6 text-sm text-emerald-600 text-center flex items-center justify-center gap-2">
                  <CheckCircle size={16} /> All Google Ads campaigns matched.
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {unmatchedGads.map((r) => (
                    <div key={r.campaignName} className="px-4 py-3 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-gray-800 max-w-[260px] truncate" title={r.campaignName}>{r.campaignName}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                        {r.gads_clicks.toLocaleString()} clicks · ฿{r.gads_cost.toFixed(0)} cost
                        </div>
                      </div>
                      <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </PageContainer>
  );
}
