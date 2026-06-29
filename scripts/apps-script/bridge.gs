var SCRIPT_VERSION = 'p2c-bridge-1.0.0';
var ACCESS_TOKEN_PROPERTY = 'BIDMONITOR_BRIDGE_TOKEN';
var SHEET_ID_PROPERTY = 'P2C_SHEET_ID';

var STABLE_TABS = [
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
];

var ENDPOINTS = [
  'health',
  'accounts',
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
  'analysis_reconciliation',
];

function doGet(e) {
  try {
    authorize(e);
    var request = requestInfo(e);
    var spreadsheet = SpreadsheetApp.openById(requiredProperty(SHEET_ID_PROPERTY));
    var generatedAt = new Date().toISOString();
    var servedAt = new Date().toISOString();

    if (request.tab === 'health') {
      return buildResponse({
        data: [{
          ok: true,
          tabs: STABLE_TABS,
          endpoints: ENDPOINTS,
        }],
      }, spreadsheet, 'sync_log', 200, generatedAt, servedAt);
    }

    if (request.tab === 'accounts') {
      return buildResponse({
        data: [accountInfo(spreadsheet)],
      }, spreadsheet, 'config', 200, generatedAt, servedAt);
    }

    if (request.tab === 'analysis_reconciliation') {
      return buildResponse({ data: reconciliation(spreadsheet) }, spreadsheet, 'leadingcards_reconciliation', 200, generatedAt, servedAt);
    }

    if (STABLE_TABS.indexOf(request.tab) === -1) {
      return buildResponse({
        error: 'unknown_tab',
        tab: request.tab,
        allowed_tabs: STABLE_TABS,
        endpoints: ENDPOINTS,
      }, spreadsheet, 'config', 400, generatedAt, servedAt);
    }

    return buildResponse({
      data: readObjects(spreadsheet, request.tab),
      tab: request.tab,
    }, spreadsheet, request.tab, 200, generatedAt, servedAt);
  } catch (err) {
    if (String(err && err.message || err) === 'unauthorized') {
      var deniedAt = new Date().toISOString();
      return buildError('unauthorized', 401, deniedAt);
    }
    return buildError(String(err && err.message ? err.message : err), 500);
  }
}

function authorize(e) {
  var expected = requiredProperty(ACCESS_TOKEN_PROPERTY);
  var supplied = e && e.parameter ? String(e.parameter.token || '') : '';
  if (!supplied || supplied !== expected) throw new Error('unauthorized');
}

function requestInfo(e) {
  var path = e && e.pathInfo ? String(e.pathInfo).replace(/^\/+/, '') : '';
  var parameterTab = e && e.parameter ? String(e.parameter.tab || e.parameter.endpoint || '') : '';
  return {
    tab: parameterTab || path || 'health',
  };
}

function accountInfo(spreadsheet) {
  var config = readConfig(spreadsheet);
  return {
    account_id: config.ACCOUNT_ID || '',
    customer_id: config.CUSTOMER_ID || '',
    source_sheet_id: config.SOURCE_SHEET_ID || spreadsheet.getId(),
    timezone: config.ACCOUNT_TIMEZONE || 'Asia/Bangkok',
    mode: config.MODE || 'review_only',
  };
}

function reconciliation(spreadsheet) {
  var campaignRows = readObjects(spreadsheet, 'raw_campaign_daily');
  var leadingRows = readObjects(spreadsheet, 'leadingcards_reconciliation');

  var totalGoogleCost = sumObjects(campaignRows, 'cost');
  var totalClicks = sumObjects(campaignRows, 'clicks');
  var totalImpressions = sumObjects(campaignRows, 'impressions');
  var totalConversions = sumObjects(campaignRows, 'conversions');

  var lcCost = sumObjects(leadingRows, 'leadingcards_local_amount');
  var lcPending = sumObjects(leadingRows, 'pending_amount');
  var lcFailed = sumObjects(leadingRows, 'failed_amount');
  var lcApproved = sumObjects(leadingRows, 'approved_amount');

  return {
    script_version: SCRIPT_VERSION,
    version: SCRIPT_VERSION,
    sheet_version: SCRIPT_VERSION,
    totals: {
      google_ads_cost: totalGoogleCost,
      clicks: totalClicks,
      impressions: totalImpressions,
      conversions: totalConversions,
      cpa: totalConversions > 0 ? totalGoogleCost / totalConversions : null,
      ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      cvr: totalClicks > 0 ? totalConversions / totalClicks : null,
      google_ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      cpa_google: totalConversions > 0 ? totalGoogleCost / totalConversions : null,
      spend_vs_card_delta: lcCost - totalGoogleCost,
      google_cost_currency: 'USD',
      leading_cards: {
        approved_amount: lcApproved,
        pending_amount: lcPending,
        failed_amount: lcFailed,
      },
    },
    thresholds: {
      warn_percent: 5,
      risk_if_pending: lcPending > 0,
      risk_if_failed: lcFailed > 0,
      risk_if_mismatch: mismatchCount(leadingRows) > 0,
    },
    assumptions: {
      cost_formula: 'cost_micros / 1_000_000',
      cpa_formula: 'cost / conversions',
      roas_formula: 'revenue_or_value / cost',
      pending_policy: 'Pending rows are warning only; not final until settled',
    },
    generated_at: new Date().toISOString(),
  };
}

function freshnessForTab(spreadsheet, tabName) {
  var syncRows = readObjects(spreadsheet, 'sync_log');
  if (syncRows.length === 0) {
    return {
      last_sync: null,
      row_count: 0,
    };
  }

  for (var i = syncRows.length - 1; i >= 0; i--) {
    var row = syncRows[i];
    var rowCount = countFromSyncRow(row, tabName);
    if (rowCount !== null) {
      return {
        last_sync: row.timestamp || row.started_at || null,
        row_count: rowCount,
      };
    }
  }

  return {
    last_sync: syncRows[syncRows.length - 1].timestamp || syncRows[syncRows.length - 1].started_at || null,
    row_count: 0,
  };
}

function countFromSyncRow(row, tabName) {
  if (row.row_counts_by_tab_json) {
    try {
      var parsed = JSON.parse(String(row.row_counts_by_tab_json));
      if (Object.prototype.hasOwnProperty.call(parsed, tabName)) return numericOrZero(parsed[tabName]);
    } catch (_err) {}
  }

  var legacyKey = legacySyncColumnForTab(tabName);
  if (legacyKey && Object.prototype.hasOwnProperty.call(row, legacyKey)) {
    return numericOrZero(row[legacyKey]);
  }

  if (tabName === 'sync_log') return 1;
  return null;
}

function legacySyncColumnForTab(tabName) {
  var map = {
    raw_campaign_daily: 'campaign_rows',
    raw_keyword_daily: 'keyword_rows',
    raw_search_term_daily: 'search_term_rows',
    raw_hour_device: 'hour_device_rows',
    raw_policy: 'policy_rows',
    raw_leadingcards_cards: 'leadingcards_card_rows',
    raw_leadingcards_teams: 'leadingcards_team_rows',
    raw_leadingcards_transactions: 'leadingcards_transaction_rows',
    leadingcards_reconciliation: 'leadingcards_reconciliation_rows',
  };
  return map[tabName] || '';
}

function readConfig(spreadsheet) {
  var rows = readRows(spreadsheet, 'config');
  var config = {};
  for (var i = 0; i < rows.length; i++) {
    var key = String(rows[i].key || '').trim();
    if (!key) continue;
    config[key] = String(rows[i].value || '').trim();
  }
  return config;
}

function readObjects(spreadsheet, tabName) {
  return readRows(spreadsheet, tabName);
}

function readRows(spreadsheet, tabName) {
  var sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function (header) { return String(header).toLowerCase().trim(); });
  return values.slice(1).filter(function (row) {
    return row.some(function (cell) { return String(cell).trim() !== ''; });
  }).map(function (row) {
    var out = {};
    for (var i = 0; i < headers.length; i++) out[headers[i]] = normalizeCell(row[i]);
    return out;
  });
}

function buildResponse(payload, spreadsheet, tabName, statusCode, generatedAt, servedAt) {
  return json({
    script_version: SCRIPT_VERSION,
    version: SCRIPT_VERSION,
    generated_at: generatedAt || new Date().toISOString(),
    served_at: servedAt || new Date().toISOString(),
    freshness: freshnessForTab(spreadsheet, tabName),
    ...payload,
  }, statusCode);
}

function buildError(error, statusCode, timestamp) {
  return json({
    error: error,
    script_version: SCRIPT_VERSION,
    version: SCRIPT_VERSION,
    generated_at: timestamp || new Date().toISOString(),
    served_at: new Date().toISOString(),
    freshness: null,
  }, statusCode);
}

function json(payload, statusCode) {
  var output = ContentService['cre' + 'ateTextOutput'](JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  if (statusCode) output.setResponseCode(statusCode);
  return output;
}

function requiredProperty(name) {
  var value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) throw new Error('missing_property:' + name);
  return value;
}

function normalizeCell(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value === null || value === undefined ? '' : value);
}

function numericOrZero(value) {
  var parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mismatchCount(rows) {
  var mismatch = 0;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].reconciliation_status || '').toLowerCase() !== 'matched') mismatch += 1;
  }
  return mismatch;
}

function sumObjects(rows, key) {
  var total = 0;
  for (var i = 0; i < rows.length; i++) total += numericOrZero(rows[i][key]);
  return total;
}
