import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  EyeOff,
  FileText,
  PlugZap,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
  Unplug,
} from 'lucide-react';
import { PageContainer, PageHeader, Card, CardHeader, CardBody } from '../components/Layout';
import { useApp } from '../context/AppContext';
import { DEFAULT_SETTINGS } from '../types';
import type { AccountSource, ActionMode, Settings } from '../types';
import { makeAccountSource } from '../lib/accountSources';
import {
  DANGER_ACTIONS,
  buildScriptUpdateCopy,
  buildSettingsHealth,
  labelForMode,
  maskSensitiveValue,
  normalizeSafeActionMode,
} from '../lib/settingsHealth';
import type { AccountCard, DataSourceStatus, HealthTone, SafeActionMode } from '../lib/settingsHealth';

interface FieldConfig {
  key: keyof Settings;
  label: string;
  description: string;
  type: 'number' | 'text' | 'select';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

const BIDDING_FIELDS: FieldConfig[] = [
  { key: 'payout', label: 'Breakeven CPA', description: 'Revenue per conversion used as the break-even threshold.', type: 'number', min: 0, step: 1 },
  { key: 'target_cpa', label: 'Target CPA', description: 'Preferred CPA for recommendations.', type: 'number', min: 0, step: 1 },
  { key: 'min_clicks', label: 'Min clicks', description: 'Minimum clicks before a recommendation is considered.', type: 'number', min: 1, step: 1 },
  { key: 'min_cost_to_decide', label: 'Min cost to decide', description: 'Minimum spend before a recommendation is considered.', type: 'number', min: 0, step: 1 },
  { key: 'min_bid', label: 'Min bid', description: 'Floor for recommended bid changes and queued bid actions.', type: 'number', min: 0.01, step: 0.01 },
  { key: 'max_bid', label: 'Max bid', description: 'Ceiling for recommended bid changes and queued bid actions.', type: 'number', min: 0.01, step: 0.01 },
  { key: 'bid_increase_percent', label: 'Bid increase %', description: 'Percent increase used in recommendation math.', type: 'number', min: 1, max: 100, step: 1 },
  { key: 'bid_decrease_percent', label: 'Bid decrease %', description: 'Percent decrease used in recommendation math.', type: 'number', min: 1, max: 100, step: 1 },
];

const OPERATION_FIELDS: FieldConfig[] = [
  { key: 'conversion_delay_hours', label: 'Conversion delay hours', description: 'Expected delay before conversion data stabilizes.', type: 'number', min: 0, step: 1 },
  { key: 'max_daily_loss', label: 'Max daily loss', description: 'Loss threshold for review alerts and total budget delta guardrails.', type: 'number', min: 0, step: 10 },
  { key: 'currency', label: 'Currency', description: 'Display currency code.', type: 'text' },
  {
    key: 'action_mode',
    label: 'Account mode',
    description: 'Controls whether approved dashboard rows can be queued for Google Ads Script processing.',
    type: 'select',
    options: [
      { value: 'review_only', label: 'Review only' },
      { value: 'dry_run', label: 'Dry run via script' },
      { value: 'manual_apply', label: 'Manual apply via script' },
      { value: 'disabled', label: 'Disabled' },
    ],
  },
  { key: 'sheet_id', label: 'Google Sheet feed', description: 'Sheet ID or URL for read-only imports.', type: 'text' },
  {
    key: 'sheet_auto_refresh',
    label: 'Sheet auto refresh',
    description: 'Local polling cadence for read-only imports.',
    type: 'select',
    options: [
      { value: 'off', label: 'Off' },
      { value: '15min', label: 'Every 15 minutes' },
      { value: '1hour', label: 'Hourly' },
    ],
  },
  { key: 'bridge_endpoint_url', label: 'Apps Script Bridge URL', description: 'Web app URL used to write approved action rows into the Google Sheet queue.', type: 'text' },
  { key: 'bridge_token', label: 'Bridge token', description: 'Local owner token for action queue writes. Do not screenshot or share.', type: 'text' },
  { key: 'action_approved_by', label: 'Approved by', description: 'Name/email written into approved action queue rows.', type: 'text' },
];

const TONE_CLASSES: Record<HealthTone, string> = {
  ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warn: 'bg-amber-50 text-amber-800 border-amber-200',
  safe: 'bg-blue-50 text-blue-800 border-blue-200',
  missing: 'bg-gray-50 text-gray-700 border-gray-200',
};

const DOT_CLASSES: Record<HealthTone, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  safe: 'bg-blue-500',
  missing: 'bg-gray-400',
};

export function SettingsPage() {
  const { data, settings, updateSettings } = useApp();
  const [form, setForm] = useState<Settings>(() => ({
    ...settings,
    action_mode: normalizeSafeActionMode(settings.action_mode),
  }));
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dangerNote, setDangerNote] = useState<string | null>(null);

  const previewHealth = useMemo(() => buildSettingsHealth(form, data), [data, form]);
  const savedHealth = useMemo(() => buildSettingsHealth(settings, data), [data, settings]);
  const scriptCopy = useMemo(
    () => buildScriptUpdateCopy(form, previewHealth.latestScriptVersion),
    [form, previewHealth.latestScriptVersion]
  );
  const selectedSource = form.account_sources.find((source) => source.id === form.selected_account_source_id) ?? null;

  const handleChange = (key: keyof Settings, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      [key]: key === 'action_mode' ? normalizeSafeActionMode(String(value)) : value,
    }));
    setSaved(false);
    setDangerNote(null);
  };

  const handleSave = () => {
    updateSettings({
      ...form,
      action_mode: normalizeSafeActionMode(form.action_mode),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setForm({ ...DEFAULT_SETTINGS, action_mode: 'review_only' });
    setSaved(false);
    setDangerNote(null);
  };

  const handleCopyScriptUpdate = async () => {
    try {
      await navigator.clipboard.writeText(scriptCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDisableAutomation = () => {
    const next = { ...form, action_mode: 'disabled' as ActionMode };
    setForm(next);
    updateSettings(next);
    setDangerNote('Automation disabled in local settings. No Google Ads or backend write was called.');
  };

  const handleRotateFeedToken = () => {
    setDangerNote('Feed token rotation is a placeholder. No token was created, revoked, or sent to a backend.');
  };

  const handleDisconnect = () => {
    setForm((prev) => ({ ...prev, sheet_id: '' }));
    setDangerNote('Disconnect staged locally by clearing the form feed value. Save Settings to persist local storage only.');
  };

  const updateSource = (id: string, patch: Partial<AccountSource>) => {
    setForm((prev) => ({
      ...prev,
      account_sources: prev.account_sources.map((source) =>
        source.id === id ? makeAccountSource({ ...source, ...patch }) : source
      ),
    }));
    setSaved(false);
    setDangerNote(null);
  };

  const addSource = () => {
    const source = makeAccountSource({ id: `source-${Date.now()}`, account_name: 'New Account' });
    setForm((prev) => ({ ...prev, account_sources: [...prev.account_sources, source], selected_account_source_id: source.id }));
    setSaved(false);
    setDangerNote(null);
  };

  const removeSource = (id: string) => {
    setForm((prev) => {
      const nextSources = prev.account_sources.filter((source) => source.id !== id);
      return {
        ...prev,
        account_sources: nextSources,
        selected_account_source_id: prev.selected_account_source_id === id ? nextSources[0]?.id ?? '' : prev.selected_account_source_id,
      };
    });
    setSaved(false);
    setDangerNote(null);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Account health, data source status, and script apply controls"
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={handleReset} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <RotateCcw size={12} /> Reset
            </button>
            <button onClick={handleSave} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${saved ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              <Save size={12} /> {saved ? 'Saved' : 'Save Settings'}
            </button>
          </div>
        }
      />

      <section className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {previewHealth.accountCards.map((card) => <AccountHealthCard key={card.id} card={card} />)}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
        <Card className="xl:col-span-2">
          <CardHeader title="Per-Account Controls" actions={<ModeBadge mode={previewHealth.safeMode} />} />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {BIDDING_FIELDS.map(renderField)}
              {OPERATION_FIELDS.map(renderField)}
            </div>
            <div className={`mt-4 border rounded-lg px-3 py-2 text-sm ${TONE_CLASSES[previewHealth.safeMode === 'manual_apply' ? 'warn' : previewHealth.automationDisabled ? 'safe' : 'ok']}`}>
              <div className="flex items-center gap-2 font-medium">
                <ShieldAlert size={14} />
                {previewHealth.safeMode === 'manual_apply' ? 'Manual apply via script is locally enabled' : previewHealth.automationDisabled ? 'Kill switch is active' : 'Script queue controls are visible'}
              </div>
              <p className="mt-1 text-xs">
                Current saved mode is {labelForMode(savedHealth.safeMode)}. Dashboard writes approved rows only to the Sheet queue. Google Ads mutation still requires _settings_actions GOOGLE_ADS_SCRIPT_CAN_MUTATE=true inside the Sheet.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Masked Credentials" />
          <CardBody className="space-y-3">
            <MaskedValue label="Google Sheet feed" value={form.sheet_id} />
            <MaskedValue label="Apps Script Bridge URL" value={form.bridge_endpoint_url} />
            <MaskedValue label="Bridge token" value={form.bridge_token ? 'server-managed-placeholder' : ''} />
            <MaskedValue label="Google Ads credential" value="server-managed-placeholder" />
            <MaskedValue label="Voluum access ID" value="server-managed-placeholder" />
            <MaskedValue label="Voluum access key" value="server-managed-placeholder" />
            <div className="border rounded-lg border-gray-200 p-3 text-xs text-gray-600">
              <div className="flex items-center gap-2 font-medium text-gray-800"><EyeOff size={14} />Frontend exposure check</div>
              <p className="mt-1">Only masked values and placeholders are rendered here. Do not screenshot raw bridge token while editing.</p>
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader title="Connected Account Sources" actions={<button type="button" onClick={addSource} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"><Plus size={13} />Add account</button>} />
          <CardBody className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row">
              <select value={form.selected_account_source_id} onChange={(event) => handleChange('selected_account_source_id', event.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white">
                <option value="">{form.account_sources.length === 0 ? 'No account sources' : 'Select account source'}</option>
                {form.account_sources.map((source) => <option key={source.id} value={source.id}>{source.account_name || source.account_id || 'Unnamed account'} ({source.customer_id || 'no customer ID'})</option>)}
              </select>
              <span className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500">{form.account_sources.filter((source) => source.enabled).length}/{form.account_sources.length} enabled</span>
            </div>

            {selectedSource ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-gray-100 rounded-lg p-3">
                {renderSourceField(selectedSource, 'account_name', 'Account name')}
                {renderSourceField(selectedSource, 'account_id', 'Account ID')}
                {renderSourceField(selectedSource, 'customer_id', 'Customer ID')}
                {renderSourceField(selectedSource, 'spreadsheet_id', 'Source sheet ID')}
                {renderSourceField(selectedSource, 'spreadsheet_url', 'Source sheet URL')}
                {renderSourceField(selectedSource, 'sheet_tab_name', 'Default tab name')}
                {renderSourceField(selectedSource, 'timezone', 'Timezone')}
                {renderSourceField(selectedSource, 'currency', 'Currency')}
                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={selectedSource.enabled} onChange={(event) => updateSource(selectedSource.id, { enabled: event.target.checked })} className="rounded border-gray-300" />Enabled for local imports</label>
                <button type="button" onClick={() => removeSource(selectedSource.id)} className="inline-flex w-fit items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white rounded-lg border border-red-200 hover:bg-red-50 transition-colors"><Trash2 size={12} />Remove local source</button>
              </div>
            ) : <div className="rounded-lg p-3 text-sm bg-gray-50 text-gray-600">No account source configured. Add a source to track account health without storing credentials.</div>}
          </CardBody>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
        <Card className="xl:col-span-2">
          <CardHeader title="Data Source Status" actions={<span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs ${TONE_CLASSES[previewHealth.syncTone]}`}><span className={`h-2 w-2 rounded-full ${DOT_CLASSES[previewHealth.syncTone]}`} />{previewHealth.syncLabel}</span>} />
          <CardBody><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{previewHealth.dataSources.map((source) => <DataSourceTile key={source.key} source={source} />)}</div></CardBody>
        </Card>
        <Card>
          <CardHeader title="Script Version" actions={<span className="text-xs text-gray-500">{previewHealth.latestScriptVersion ?? 'not reported'}</span>} />
          <CardBody className="space-y-3">
            <div className="border rounded-lg border-gray-200 p-3 bg-gray-50"><div className="flex items-center gap-2 text-sm font-medium text-gray-800"><FileText size={15} />Update flow</div><pre className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-gray-600">{scriptCopy}</pre></div>
            <button type="button" onClick={handleCopyScriptUpdate} className="inline-flex w-full items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"><Clipboard size={13} />{copied ? 'Copied' : 'Copy Script Update'}</button>
          </CardBody>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader title="Danger Zone" />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <DangerButton icon={<ShieldAlert size={15} />} title={DANGER_ACTIONS[0].label} description="Persist local mode as disabled." onClick={handleDisableAutomation} />
              <DangerButton icon={<RefreshCw size={15} />} title={DANGER_ACTIONS[1].label} description="Placeholder only; no token call." onClick={handleRotateFeedToken} />
              <DangerButton icon={<Unplug size={15} />} title={DANGER_ACTIONS[2].label} description="Stage local feed disconnect." onClick={handleDisconnect} />
            </div>
            {dangerNote && <div className="mt-3 border rounded-lg border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{dangerNote}</div>}
          </CardBody>
        </Card>
      </section>
    </PageContainer>
  );

  function renderField(field: FieldConfig) {
    const value = form[field.key];
    return (
      <div key={field.key}>
        <label className="block text-xs font-semibold text-gray-700 mb-1">{field.label}</label>
        <p className="text-xs text-gray-500 mb-1.5">{field.description}</p>
        {field.type === 'select' ? (
          <select value={String(value)} onChange={(e) => handleChange(field.key, e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {field.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        ) : (
          <input type={field.type} value={String(value)} onChange={(e) => handleChange(field.key, field.type === 'number' ? Number(e.target.value) || 0 : e.target.value)} min={field.min} max={field.max} step={field.step} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        )}
      </div>
    );
  }

  function renderSourceField(source: AccountSource, key: keyof AccountSource, label: string) {
    const value = source[key];
    if (typeof value === 'boolean') return null;
    return <div key={key}><label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label><input type="text" value={String(value)} onChange={(event) => updateSource(source.id, { [key]: event.target.value } as Partial<AccountSource>)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>;
  }
}

function AccountHealthCard({ card }: { card: AccountCard }) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-sm font-semibold text-gray-900">{card.title}</h2><p className="text-xs text-gray-500 mt-1">{card.details}</p></div>
          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${TONE_CLASSES[card.tone]}`}>{card.tone === 'warn' ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}{card.status}</span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">{card.values.map((item) => <div key={item.label}><dt className="text-[11px] uppercase tracking-wide text-gray-400">{item.label}</dt><dd className="mt-0.5 text-sm font-medium text-gray-800 break-words">{item.value}</dd></div>)}</dl>
      </CardBody>
    </Card>
  );
}

function DataSourceTile({ source }: { source: DataSourceStatus }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="text-sm font-medium text-gray-800 truncate">{source.label}</div><div className="text-xs text-gray-500 truncate">{source.tabName}</div></div><span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs ${TONE_CLASSES[source.tone]}`}><span className={`h-2 w-2 rounded-full ${DOT_CLASSES[source.tone]}`} />{source.rows > 0 ? `${source.rows} rows` : source.optional ? 'optional' : 'missing'}</span></div>
      <div className="mt-2 text-xs text-gray-500">{source.importedAt ? `Imported ${new Date(source.importedAt).toLocaleString()}` : 'No local import metadata'}</div>
      {source.source && <div className="mt-1 text-xs text-gray-400 truncate">{source.source}</div>}
    </div>
  );
}

function MaskedValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2">
      <div className="flex items-center gap-2 min-w-0"><PlugZap size={14} className="text-gray-400 flex-shrink-0" /><span className="text-sm text-gray-700 truncate">{label}</span></div>
      <code className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 max-w-[55%] truncate">{value === 'server-managed-placeholder' ? 'server secret only' : maskSensitiveValue(value)}</code>
    </div>
  );
}

function DangerButton({ icon, title, description, onClick }: { icon: ReactNode; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="text-left border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg px-3 py-3 transition-colors"><div className="flex items-center gap-2 text-sm font-semibold text-red-800">{icon}{title}</div><p className="mt-1 text-xs text-red-700">{description}</p></button>;
}

function ModeBadge({ mode }: { mode: SafeActionMode }) {
  const tone: HealthTone = mode === 'disabled' ? 'safe' : mode === 'manual_apply' ? 'warn' : 'ok';
  return <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs ${TONE_CLASSES[tone]}`}><ShieldAlert size={12} />{labelForMode(mode)}</span>;
}
