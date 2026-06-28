import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../types';
import { loadSettings } from '../settingsStore';

const settingsKey = 'gads_monitor_settings';

function installLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  });
}

describe('settings defaults', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it('defaults to review-only with fail-closed auto-bid guardrails', () => {
    expect(DEFAULT_SETTINGS.action_mode).toBe('review_only');
    expect(DEFAULT_SETTINGS).not.toHaveProperty('auto_apply');

    expect(DEFAULT_SETTINGS.auto_bid_guardrails).toMatchObject({
      minBid: 0.01,
      maxBid: 2,
      maxChangePercent: 25,
      minBudget: 1,
      maxBudget: 200,
      maxBudgetChangePercent: 30,
      allowSharedBudget: false,
      maxChangesPerRun: 50,
      dryRun: true,
      applyEnabled: false,
    });
  });

  it('merges missing nested guardrails into stored legacy settings', () => {
    localStorage.setItem(settingsKey, JSON.stringify({
      action_mode: 'review_only',
      auto_bid_guardrails: {
        maxBid: 1.5,
      },
    }));

    expect(loadSettings().auto_bid_guardrails).toMatchObject({
      minBid: 0.01,
      maxBid: 1.5,
      maxChangePercent: 25,
      minBudget: 1,
      maxBudget: 200,
      maxBudgetChangePercent: 30,
      allowSharedBudget: false,
      maxChangesPerRun: 50,
      dryRun: true,
      applyEnabled: false,
    });
  });

  it('falls back to review-only when stored action mode is not a v1 mode', () => {
    localStorage.setItem(settingsKey, JSON.stringify({
      action_mode: 'semi_auto_ready',
    }));

    expect(loadSettings().action_mode).toBe('review_only');
  });
});
