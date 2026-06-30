import { DEFAULT_AUTO_BID_GUARDRAILS, DEFAULT_SETTINGS } from '../types';
import type { ActionMode, Settings, VoluumConversionMetric, VoluumMatchMode } from '../types';
import { normalizeAccountSources } from '../lib/accountSources';

const SETTINGS_KEY = 'gads_monitor_settings';
const ACTION_MODES = new Set<ActionMode>(['disabled', 'review_only', 'dry_run', 'manual_apply']);
const VOLUUM_CONVERSION_METRICS = new Set<VoluumConversionMetric>(['conversions', 'revenue_conversions']);
const VOLUUM_MATCH_MODES = new Set<VoluumMatchMode>(['auto', 'strict', 'all']);

function mergeSettings(stored: Partial<Settings>): Settings {
  const actionMode = ACTION_MODES.has(stored.action_mode as ActionMode)
    ? (stored.action_mode as ActionMode)
    : DEFAULT_SETTINGS.action_mode;
  const conversionMetric = VOLUUM_CONVERSION_METRICS.has(stored.voluum_conversion_metric as VoluumConversionMetric)
    ? (stored.voluum_conversion_metric as VoluumConversionMetric)
    : DEFAULT_SETTINGS.voluum_conversion_metric;
  const matchMode = VOLUUM_MATCH_MODES.has(stored.voluum_match_mode as VoluumMatchMode)
    ? (stored.voluum_match_mode as VoluumMatchMode)
    : DEFAULT_SETTINGS.voluum_match_mode;

  return normalizeAccountSources({
    ...DEFAULT_SETTINGS,
    ...stored,
    action_mode: actionMode,
    voluum_conversion_metric: conversionMetric,
    voluum_match_mode: matchMode,
    auto_bid_guardrails: {
      ...DEFAULT_AUTO_BID_GUARDRAILS,
      ...stored.auto_bid_guardrails,
      dryRun: true,
      applyEnabled: false,
    },
  });
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return mergeSettings({});
    return mergeSettings(JSON.parse(raw));
  } catch {
    return mergeSettings({});
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
