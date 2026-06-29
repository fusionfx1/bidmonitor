import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  P2C_ADS_EXPORT_TABS,
  P2C_APPS_SCRIPT_ENDPOINTS,
  P2C_APPS_SCRIPT_TABS,
  P2C_SYNC_LOG_HEADERS,
} from '../p2cRuntimeContract';

const repoRoot = resolve(__dirname, '../../..');

describe('P2C runtime scripts contract', () => {
  it('declares stable sheet tabs and sync log headers', () => {
    expect(P2C_ADS_EXPORT_TABS.map((tab) => tab.name)).toEqual([
      'config',
      'sync_log',
      'raw_campaign_daily',
      'raw_adgroup_daily',
      'raw_keyword_daily',
      'raw_search_term_daily',
      'raw_hour_device',
      'raw_policy',
      'raw_pmax_channel_daily',
      'raw_pmax_terms_daily',
      'raw_geo_daily',
      'raw_placement_daily',
      'raw_budget_daily',
      'raw_conversion_action_daily',
    ]);
    expect(P2C_APPS_SCRIPT_TABS.map((tab) => tab.name)).toEqual([
      'config',
      'sync_log',
      'raw_campaign_daily',
      'raw_adgroup_daily',
      'raw_keyword_daily',
      'raw_search_term_daily',
      'raw_hour_device',
      'raw_policy',
      'raw_pmax_channel_daily',
      'raw_pmax_terms_daily',
      'raw_geo_daily',
      'raw_placement_daily',
      'raw_budget_daily',
      'raw_conversion_action_daily',
      'raw_leadingcards_cards',
      'raw_leadingcards_teams',
      'raw_leadingcards_transactions',
      'leadingcards_reconciliation',
    ]);
    expect(P2C_SYNC_LOG_HEADERS).toEqual(
      expect.arrayContaining([
        'timestamp',
        'status',
        'row_counts_by_tab_json',
        'script_version',
        'duration_ms',
        'error_message',
        'dry_run',
      ])
    );
  });

  it('uses exporter.gs as canonical Ads script and bridge.gs as canonical Apps Script', () => {
    const adsScriptPath = resolve(repoRoot, 'scripts/google-ads/exporter.gs');
    const bridgePath = resolve(repoRoot, 'scripts/apps-script/bridge.gs');
    const legacyAdsPath = resolve(repoRoot, 'scripts/google-ads/p2c-data-puller.gs.js');
    const legacyBridgePath = resolve(repoRoot, 'scripts/google-apps/p2c-sheet-bridge.gs.js');

    expect(existsSync(adsScriptPath)).toBe(true);
    expect(existsSync(bridgePath)).toBe(true);
    expect(existsSync(legacyAdsPath)).toBe(true);
    expect(existsSync(legacyBridgePath)).toBe(true);

    const adsScript = readFileSync(adsScriptPath, 'utf8');
    const bridgeScript = readFileSync(bridgePath, 'utf8');
    const legacyAdsScript = readFileSync(legacyAdsPath, 'utf8');
    const legacyBridgeScript = readFileSync(legacyBridgePath, 'utf8');

    for (const tab of P2C_ADS_EXPORT_TABS) {
      expect(adsScript).toContain(tab.name);
    }

    for (const tab of P2C_APPS_SCRIPT_TABS) {
      expect(bridgeScript).toContain(tab.name);
    }

    for (const endpoint of P2C_APPS_SCRIPT_ENDPOINTS) {
      expect(bridgeScript).toContain(endpoint);
    }

    expect(adsScript).toContain('MAX_ROWS');
    expect(adsScript).toContain('LOOKBACK_DAYS');
    expect(adsScript).toContain('ACCOUNT_TIMEZONE');
    expect(adsScript).toContain('DRY_RUN');
    expect(adsScript).toContain("String(config.DRY_RUN || 'true').toLowerCase() !== 'false'");
    expect(adsScript).toContain('PropertiesService');
    expect(adsScript).toContain('dry_run=true would write');
    expect(adsScript).toContain('appendSyncLog');
    expect(bridgeScript).toContain('BIDMONITOR_BRIDGE_TOKEN');
    expect(bridgeScript).toContain('generated_at');
    expect(bridgeScript).toContain('served_at');
    expect(bridgeScript).toContain('freshness');

    expect(adsScript).not.toMatch(/\b(setBudget|pause|enable|applyRecommendation|mutate|create|remove)\b/);
    expect(bridgeScript).not.toMatch(/\b(setBudget|pause|enable|applyRecommendation|mutate|create|remove)\b/);
    expect(adsScript).not.toMatch(/LEADINGCARDS_API_TOKEN/);
    expect(bridgeScript).not.toMatch(/Authorization/);
    expect(bridgeScript).not.toMatch(/Logger\.log\(.+token/i);
    expect(`${legacyAdsScript}\n${legacyBridgeScript}`).toContain('NON-CANONICAL');
  });

  it('documents dry-run behavior in Ads canonical script contract', () => {
    const adsScriptPath = resolve(repoRoot, 'scripts/google-ads/exporter.gs');
    const adsScript = readFileSync(adsScriptPath, 'utf8');

    expect(adsScript).toContain('dry_run=true would write');
    expect(adsScript).toContain('appendSyncLog');
    expect(adsScript).toContain('sync_log');
    expect(adsScript).toContain('status');
    expect(adsScript).toContain('timestamp');
  });
});
