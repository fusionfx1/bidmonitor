import { useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { PageContainer, PageHeader, Card, CardHeader, CardBody } from '../components/Layout';
import { useApp } from '../context/AppContext';
import { DEFAULT_SETTINGS } from '../types';
import type { Settings, ActionMode } from '../types';

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

const FIELDS: FieldConfig[] = [
  { key: 'payout', label: 'Payout (per conversion)', description: 'Expected revenue per conversion in your currency.', type: 'number', min: 0, step: 1 },
  { key: 'target_cpa', label: 'Target CPA', description: 'Maximum acceptable cost per conversion.', type: 'number', min: 0, step: 1 },
  { key: 'min_clicks', label: 'Min Clicks to Decide', description: 'Minimum clicks before making a bid decision.', type: 'number', min: 1, step: 1 },
  { key: 'min_cost_to_decide', label: 'Min Cost to Decide', description: 'Minimum spend before making a bid decision.', type: 'number', min: 0, step: 1 },
  { key: 'min_bid', label: 'Min Bid', description: 'Floor bid — recommended bids will not go below this.', type: 'number', min: 0.01, step: 0.01 },
  { key: 'max_bid', label: 'Max Bid', description: 'Ceiling bid — recommended bids will not exceed this.', type: 'number', min: 0.01, step: 0.01 },
  { key: 'bid_increase_percent', label: 'Bid Increase %', description: 'Percentage to increase bid when increasing.', type: 'number', min: 1, max: 100, step: 1 },
  { key: 'bid_decrease_percent', label: 'Bid Decrease %', description: 'Percentage to decrease bid when reducing.', type: 'number', min: 1, max: 100, step: 1 },
  { key: 'conversion_delay_hours', label: 'Conversion Delay (hours)', description: 'Expected delay between click and conversion reporting.', type: 'number', min: 0, step: 1 },
  { key: 'max_daily_loss', label: 'Max Daily Loss', description: 'Threshold for daily loss alerts (in your selected currency).', type: 'number', min: 0, step: 10 },
  { key: 'currency', label: 'Currency', description: 'Currency used for all monetary values in the dashboard.', type: 'select',
    options: [
      { value: 'THB', label: 'THB — Thai Baht (฿)' },
      { value: 'USD', label: 'USD — US Dollar ($)' },
      { value: 'EUR', label: 'EUR — Euro (€)' },
      { value: 'GBP', label: 'GBP — British Pound (£)' },
      { value: 'SGD', label: 'SGD — Singapore Dollar (S$)' },
    ],
  },
  {
    key: 'action_mode', label: 'Action Mode', description: 'Controls how the bid decision engine operates.', type: 'select',
    options: [
      { value: 'review_only',    label: 'Review Only — Generate recommendations, no automation' },
      { value: 'semi_auto_ready', label: 'Semi-Auto Ready — Approved decisions could be exported' },
      { value: 'disabled',       label: 'Disabled — No recommendations generated' },
    ],
  },
];

export function SettingsPage() {
  const { settings, updateSettings } = useApp();
  const [form, setForm] = useState<Settings>({ ...settings });
  const [saved, setSaved] = useState(false);

  const handleChange = (key: keyof Settings, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    updateSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setForm({ ...DEFAULT_SETTINGS });
    setSaved(false);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Configure thresholds and parameters for bid decision engine"
        actions={
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <RotateCcw size={12} />
              Reset Defaults
            </button>
            <button
              onClick={handleSave}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                saved ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Save size={12} />
              {saved ? 'Saved!' : 'Save Settings'}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Bidding Parameters" />
          <CardBody className="space-y-4">
            {FIELDS.filter((f) => ['payout', 'target_cpa', 'min_clicks', 'min_cost_to_decide', 'min_bid', 'max_bid', 'bid_increase_percent', 'bid_decrease_percent'].includes(f.key)).map(renderField)}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Operational Settings" />
          <CardBody className="space-y-4">
            {FIELDS.filter((f) => ['conversion_delay_hours', 'max_daily_loss', 'currency', 'action_mode'].includes(f.key)).map(renderField)}

            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className={`rounded-lg p-3 text-sm ${
                form.action_mode === 'disabled'      ? 'bg-gray-50 text-gray-600'
                : form.action_mode === 'semi_auto_ready' ? 'bg-blue-50 text-blue-800'
                : 'bg-emerald-50 text-emerald-800'
              }`}>
                {form.action_mode === 'review_only'     && 'Review Only: Bid decisions are generated as read-only recommendations.'}
                {form.action_mode === 'semi_auto_ready' && 'Semi-Auto Ready: Approved decisions can be exported as CSV for batch upload.'}
                {form.action_mode === 'disabled'        && 'Disabled: No bid recommendations are generated.'}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Compliance note:</strong> This dashboard is read-only. No settings here will change bids, budgets, or keywords in Google Ads. All decisions are recommendations only.
      </div>
    </PageContainer>
  );

  function renderField(field: FieldConfig) {
    const value = form[field.key];
    return (
      <div key={field.key}>
        <label className="block text-xs font-semibold text-gray-700 mb-1">{field.label}</label>
        <p className="text-xs text-gray-500 mb-1.5">{field.description}</p>
        {field.type === 'select' ? (
          <select
            value={String(value)}
            onChange={(e) => handleChange(field.key, e.target.value as ActionMode)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <input
            type={field.type}
            value={String(value)}
            onChange={(e) => handleChange(
              field.key,
              field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
            )}
            min={field.min}
            max={field.max}
            step={field.step}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
      </div>
    );
  }
}
