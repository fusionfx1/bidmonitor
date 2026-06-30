import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Info, Loader2, RefreshCw } from 'lucide-react';
import { PageContainer, PageHeader } from '../components/Layout';
import { useApp } from '../context/AppContext';
import { fetchVoluumHealth } from '../lib/voluum/api';
import { computeSyncHealth } from '../lib/syncHealth';
import { getVoluumLiveImportStatus } from '../lib/importSources';
import { DiagnosticsSourceCards, DiagnosticsSheetTabs } from '../components/DiagnosticsSourceCards';
import type { VoluumHealth } from '../lib/voluum/types';

export function DiagnosticsV2() {
  const { data, settings, syncState, syncSheet } = useApp();
  const [voluumHealth, setVoluumHealth] = useState<VoluumHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [voluumError, setVoluumError] = useState<string | null>(null);

  const scriptHealth = useMemo(() => computeSyncHealth(data.syncLog), [data.syncLog]);
  const voluumImport = useMemo(() => getVoluumLiveImportStatus(data), [data]);

  const checkVoluum = useCallback(async () => {
    setChecking(true);
    setVoluumError(null);
    try {
      setVoluumHealth(await fetchVoluumHealth());
    } catch (e) {
      setVoluumError(String(e));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { checkVoluum(); }, [checkVoluum]);

  const hasSheetData = data.campaigns.length > 0;
  const hasVoluumRows = voluumImport.status === 'synced';
  const liveMode = Boolean(hasSheetData && hasVoluumRows);

  return (
    <PageContainer>
      <PageHeader
        title="Connection Diagnostics"
        description="Separate status for Google Sheet data, script runs, and live API imports."
        actions={<div className="flex gap-2"><button onClick={checkVoluum} disabled={checking} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50">{checking ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}Check Voluum</button>{settings.sheet_id && <button onClick={() => syncSheet()} disabled={syncState.running} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">{syncState.running ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}Sync Sheet</button>}</div>}
      />

      <div className={`mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 ${liveMode ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>
        {liveMode ? <CheckCircle size={16} /> : <Info size={16} />}
        <span className="text-sm font-medium">{liveMode ? 'Live mode' : 'Partial mode'}</span>
        <span className="text-sm">Sheet: {hasSheetData ? 'loaded' : 'not loaded'} · Voluum import: {hasVoluumRows ? `${voluumImport.rows.toLocaleString()} rows` : 'not loaded'}</span>
      </div>

      <DiagnosticsSourceCards
        data={data}
        settings={settings}
        syncState={syncState}
        scriptHealth={scriptHealth}
        voluumHealth={voluumHealth}
        voluumError={voluumError}
        voluumImport={voluumImport}
      />
      <DiagnosticsSheetTabs data={data} syncState={syncState} />
    </PageContainer>
  );
}
