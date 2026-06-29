import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { P2C_APPS_SCRIPT_ENDPOINTS, P2C_APPS_SCRIPT_TABS } from '../p2cRuntimeContract';

const repoRoot = resolve(__dirname, '../../..');

describe('P2C Apps Script bridge', () => {
  it('uses scripts/apps-script/bridge.gs as the canonical bridge with token gate', () => {
    const bridgePath = resolve(repoRoot, 'scripts/apps-script/bridge.gs');
    expect(existsSync(bridgePath)).toBe(true);

    const bridgeScript = readFileSync(bridgePath, 'utf8');

    for (const tab of P2C_APPS_SCRIPT_TABS) {
      expect(bridgeScript).toContain(tab.name);
    }

    for (const endpoint of P2C_APPS_SCRIPT_ENDPOINTS) {
      expect(bridgeScript).toContain(endpoint);
    }

    expect(bridgeScript).toContain('BIDMONITOR_BRIDGE_TOKEN');
    expect(bridgeScript).toContain('row_counts_by_tab_json');
    expect(bridgeScript).toContain('freshnessForTab');
    expect(bridgeScript).toContain('generated_at');
    expect(bridgeScript).toContain('served_at');
    expect(bridgeScript).toContain('version');
    expect(bridgeScript).toContain('script_version');
    expect(bridgeScript).toContain('analysis_reconciliation');
    expect(bridgeScript).toContain("return buildError('unauthorized', 401, deniedAt)");
    expect(bridgeScript).toContain("return buildResponse({");
    expect(bridgeScript).toContain(', 400,');
    expect(bridgeScript).toContain('return buildError(String(err && err.message ? err.message : err), 500);');
  });

  it('is read-only and does not log secrets', () => {
    const bridgePath = resolve(repoRoot, 'scripts/apps-script/bridge.gs');
    const bridgeScript = readFileSync(bridgePath, 'utf8');

    expect(bridgeScript).not.toMatch(/\bsetValue\s*\(/);
    expect(bridgeScript).not.toMatch(/\bsetValues\s*\(/);
    expect(bridgeScript).not.toMatch(/\bappendRow\s*\(/);
    expect(bridgeScript).not.toMatch(/\binsertSheet\s*\(/);
    expect(bridgeScript).not.toMatch(/Logger\.log\(.+token/i);
    expect(bridgeScript).not.toMatch(/\b(setBudget|pause|enable|applyRecommendation|mutate|create|remove)\b/);
    expect(bridgeScript).not.toMatch(/LEADINGCARDS_API_TOKEN/);
    expect(bridgeScript).not.toMatch(/Authorization/);
  });

  it('keeps bridge and legacy path explicit and non-canonical', () => {
    const legacyBridgePath = resolve(repoRoot, 'scripts/google-apps/p2c-sheet-bridge.gs.js');
    const legacyBridgeScript = readFileSync(legacyBridgePath, 'utf8');
    expect(legacyBridgeScript).toContain('NON-CANONICAL');
    expect(legacyBridgeScript).toContain('scripts/apps-script/bridge.gs');
  });

  it('aligns app endpoints with contract', () => {
    expect(P2C_APPS_SCRIPT_ENDPOINTS).toContain('health');
    expect(P2C_APPS_SCRIPT_ENDPOINTS).toContain('accounts');
    expect(P2C_APPS_SCRIPT_ENDPOINTS).toContain('sync_log');
    expect(P2C_APPS_SCRIPT_ENDPOINTS).toContain('analysis_reconciliation');
    expect(P2C_APPS_SCRIPT_ENDPOINTS).toEqual(expect.arrayContaining(P2C_APPS_SCRIPT_TABS.map((tab) => tab.name)));
  });
});
