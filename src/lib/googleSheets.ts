import type { DataTableKey } from '../types';
import {
  parseCampaigns, parseAdGroups, parseKeywords, parseSearchTerms,
  parseHourDevice, parsePolicy, parseAuctionCampaigns, parseAuctionKeywords,
  parseVoluum, parseSyncLog,
} from './csv/parser';

export interface SheetTab {
  tabName: string;
  key: DataTableKey;
  label: string;
  optional?: boolean;
}

export const SHEET_TABS: SheetTab[] = [
  { tabName: 'google_campaigns',               key: 'campaigns',        label: 'Campaigns' },
  { tabName: 'google_adgroups',                key: 'adGroups',         label: 'Ad Groups' },
  { tabName: 'google_keywords',                key: 'keywords',         label: 'Keywords' },
  { tabName: 'google_search_terms',            key: 'searchTerms',      label: 'Search Terms' },
  { tabName: 'google_hour_device',             key: 'hourDevice',       label: 'Hour / Device' },
  { tabName: 'google_ads_policy',              key: 'policy',           label: 'Policy Issues' },
  { tabName: 'google_auction_proxy_campaigns', key: 'auctionCampaigns', label: 'Auction Signals (Campaign)' },
  { tabName: 'google_auction_proxy_keywords',  key: 'auctionKeywords',  label: 'Auction Signals (Keywords)' },
  { tabName: 'voluum_performance',             key: 'voluum',           label: 'Voluum Performance', optional: true },
  { tabName: 'google_sync_log',                key: 'syncLog',          label: 'Script Run Log',     optional: true },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SHEET_PARSERS: Record<DataTableKey, (rows: any[]) => any[]> = {
  campaigns:        parseCampaigns,
  adGroups:         parseAdGroups,
  keywords:         parseKeywords,
  searchTerms:      parseSearchTerms,
  hourDevice:       parseHourDevice,
  policy:           parsePolicy,
  auctionCampaigns: parseAuctionCampaigns,
  auctionKeywords:  parseAuctionKeywords,
  voluum:           parseVoluum,
  syncLog:          parseSyncLog,
};

export function extractSheetId(input: string): string {
  const m = input.trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : input.trim();
}

export type FetchTabError = 'missing' | 'private' | 'network_error';

export interface FetchTabResult {
  csv: string | null;
  error: FetchTabError | null;
  /** Human-readable message for display */
  message: string | null;
}

/**
 * Fetches a single Google Sheet tab as CSV.
 * Uses credentials:'omit' so Google's own session cookies don't cause it to
 * redirect to a login page instead of returning the public sheet content.
 */
export async function fetchTabAsCSV(sheetId: string, tabName: string): Promise<FetchTabResult> {
  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}` +
    `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  try {
    // credentials:'omit' is critical — without it, if the user is signed into
    // Google, the browser sends their session cookie and Google returns an HTML
    // "sign in to access" redirect instead of the public CSV.
    const res = await fetch(url, { credentials: 'omit' });

    if (res.status === 401 || res.status === 403) {
      return { csv: null, error: 'private', message: 'Sheet is private. Share it as "Anyone with the link can view".' };
    }
    if (res.status === 404) {
      return { csv: null, error: 'missing', message: 'Sheet ID not found.' };
    }
    if (!res.ok) {
      return { csv: null, error: 'network_error', message: `HTTP ${res.status}` };
    }

    const text = await res.text();
    const t = text.trim();

    if (!t) {
      return { csv: null, error: 'private', message: 'Sheet returned empty response. Check sharing settings.' };
    }

    // HTML response means Google redirected to a login/error page
    if (t.startsWith('<')) {
      const isLoginPage = t.includes('accounts.google.com') || t.includes('ServiceLogin') || t.includes('Sign in');
      const msg = isLoginPage
        ? 'Sheet is private. Share it as "Anyone with the link can view".'
        : 'Unexpected response from Google. Verify the Sheet ID and sharing settings.';
      return { csv: null, error: 'private', message: msg };
    }

    // gviz JSONP/error response when tab is missing or query is invalid
    if (t.startsWith('google.visualization') || t.includes('Table has no columns') || t.includes('Invalid query')) {
      return { csv: null, error: 'missing', message: `Tab "${tabName}" was not found in the spreadsheet.` };
    }

    return { csv: text, error: null, message: null };
  } catch (e) {
    return { csv: null, error: 'network_error', message: String(e) };
  }
}
