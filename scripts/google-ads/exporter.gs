/*
 * CANONICAL Google Ads Script
 * scripts/google-ads/exporter.gs
 * Purpose: Ads -> Sheet read-only runtime extractor (no LeadCards calls).
 */

var SCRIPT_VERSION = 'p2c-exporter-1.3.0';
var DEFAULT_TIMEZONE = 'Asia/Bangkok';
var DEFAULT_LOOKBACK_DAYS = 30;
var DEFAULT_MAX_ROWS = 50000;
var DEFAULT_LIMIT = 10000;

var TABS = {
  config: {
    name: 'config',
    headers: ['key', 'value', 'description'],
  },
  sync_log: {
    name: 'sync_log',
    headers: [
      'timestamp',
      'status',
      'row_counts_by_tab_json',
      'script_version',
      'duration_ms',
      'error_message',
      'account_timezone',
      'freshness_minutes',
      'mode',
      'dry_run',
      'date_range_start',
      'date_range_end',
      'max_rows',
      'limit',
    ],
  },
  raw_campaign_daily: {
    name: 'raw_campaign_daily',
    headers: [
      'date', 'account_id', 'customer_id', 'source_sheet_id', 'campaign_id', 'campaign_name',
      'impressions', 'clicks', 'cost_micros', 'cost', 'conversions', 'conversion_value',
      'campaign_status', 'serving_status', 'channel', 'bidding_strategy_type', 'daily_budget',
    ],
  },
  raw_adgroup_daily: {
    name: 'raw_adgroup_daily',
    headers: [
      'date', 'account_id', 'customer_id', 'source_sheet_id', 'campaign_id', 'campaign_name',
      'impressions', 'clicks', 'cost_micros', 'cost', 'conversions', 'conversion_value',
      'ad_group_id', 'ad_group_name', 'ad_group_status', 'bidding_strategy_type', 'ad_group_cpc_bid',
    ],
  },
  raw_keyword_daily: {
    name: 'raw_keyword_daily',
    headers: [
      'date', 'account_id', 'customer_id', 'source_sheet_id', 'campaign_id', 'campaign_name',
      'impressions', 'clicks', 'cost_micros', 'cost', 'conversions', 'conversion_value',
      'ad_group_id', 'ad_group_name', 'criterion_id', 'keyword', 'match_type', 'keyword_status', 'device',
    ],
  },
  raw_search_term_daily: {
    name: 'raw_search_term_daily',
    headers: [
      'date', 'account_id', 'customer_id', 'source_sheet_id', 'campaign_id', 'campaign_name',
      'impressions', 'clicks', 'cost_micros', 'cost', 'conversions', 'conversion_value',
      'ad_group_id', 'ad_group_name', 'search_term', 'search_term_status',
    ],
  },
  raw_hour_device: {
    name: 'raw_hour_device',
    headers: [
      'date', 'account_id', 'customer_id', 'source_sheet_id', 'campaign_id', 'campaign_name',
      'impressions', 'clicks', 'cost_micros', 'cost', 'conversions', 'conversion_value',
      'hour', 'device',
    ],
  },
  raw_policy: {
    name: 'raw_policy',
    headers: [
      'account_id', 'customer_id', 'source_sheet_id', 'campaign_id', 'campaign_name',
      'ad_group_id', 'ad_group_name', 'ad_id', 'ad_status', 'approval_status', 'review_status', 'final_urls',
    ],
  },
  raw_pmax_channel_daily: {
    name: 'raw_pmax_channel_daily',
    headers: [
      'date', 'account_id', 'customer_id', 'source_sheet_id', 'campaign_id', 'campaign_name',
      'impressions', 'clicks', 'cost_micros', 'cost', 'conversions', 'conversion_value',
      'asset_group_id', 'asset_group_name', 'channel_name',
    ],
  },
  raw_pmax_terms_daily: {
    name: 'raw_pmax_terms_daily',
    headers: [
      'date', 'account_id', 'customer_id', 'source_sheet_id', 'campaign_id', 'campaign_name',
      'impressions', 'clicks', 'cost_micros', 'cost', 'conversions', 'conversion_value',
      'asset_group_id', 'asset_group_name', 'term_text', 'term_source',
    ],
  },
  raw_geo_daily: {
    name: 'raw_geo_daily',
    headers: [
      'date', 'account_id', 'customer_id', 'source_sheet_id', 'campaign_id', 'campaign_name',
      'impressions', 'clicks', 'cost_micros', 'cost', 'conversions', 'conversion_value',
      'country_criterion_id', 'country_code', 'region', 'city',
    ],
  },
  raw_placement_daily: {
    name: 'raw_placement_daily',
    headers: [
      'date', 'account_id', 'customer_id', 'source_sheet_id', 'campaign_id', 'campaign_name',
      'impressions', 'clicks', 'cost_micros', 'cost', 'conversions', 'conversion_value',
      'ad_group_id', 'ad_group_name', 'placement', 'placement_type',
    ],
  },
  raw_budget_daily: {
    name: 'raw_budget_daily',
    headers: [
      'date', 'account_id', 'customer_id', 'source_sheet_id', 'campaign_id', 'campaign_name',
      'daily_budget', 'cost', 'budget_lost_impression_share', 'budget_remaining', 'budget_utilization',
    ],
  },
  raw_conversion_action_daily: {
    name: 'raw_conversion_action_daily',
    headers: [
      'date', 'account_id', 'customer_id', 'source_sheet_id', 'campaign_id', 'campaign_name',
      'conversion_action_id', 'conversion_action_name', 'category', 'primary_for_goal',
      'include_in_conversions_metric', 'conversions', 'conversion_value', 'all_conversions',
    ],
  },
};

function main() {
  var startedAt = new Date();
  var spreadsheet = SpreadsheetApp.openById(requiredProperty('P2C_SHEET_ID'));
  var config = readConfigSafe(spreadsheet);
  var limits = buildLimits(config);
  var context = buildContext(config, spreadsheet);
  var range = dateRange(config, limits.timezone);
  var dryRun = isDryRun(config);

  var counts = {};
  var errors = [];
  var status = 'success';

  if (!dryRun) ensureTabs(spreadsheet, limits);

  var jobs = buildExportJobs(context, range, limits);
  for (var i = 0; i < jobs.length; i++) {
    try {
      var rows = jobs[i].fetch();
      counts[jobs[i].tab.name] = rows.length;
      if (dryRun) {
        // dry_run=true would write rows, but canonical runtime scripts must not log export data.
      } else {
        writeRows(spreadsheet, jobs[i].tab, rows, limits.maxRows);
      }
    } catch (err) {
      counts[jobs[i].tab.name] = 0;
      errors.push(jobs[i].tab.name + ': ' + String(err && err.message ? err.message : err));
      status = status === 'failed' ? 'failed' : 'warning';
    }
  }

  if (!dryRun) {
    appendSyncLog(spreadsheet, {
      timestamp: new Date().toISOString(),
      status: status,
      row_counts_by_tab_json: JSON.stringify(counts),
      script_version: SCRIPT_VERSION,
      duration_ms: new Date().getTime() - startedAt.getTime(),
      error_message: errors.join(' | '),
      account_timezone: limits.timezone,
      freshness_minutes: limits.freshnessMinutes,
      mode: limits.mode,
      dry_run: 'false',
      date_range_start: range.start,
      date_range_end: range.end,
      max_rows: limits.maxRows,
      limit: limits.limit,
    });
  }
}

function buildExportJobs(context, range, limits) {
  return [
    { tab: TABS.raw_campaign_daily, fetch: function () { return campaignRows(context, range, limits); } },
    { tab: TABS.raw_adgroup_daily, fetch: function () { return adgroupRows(context, range, limits); } },
    { tab: TABS.raw_keyword_daily, fetch: function () { return keywordRows(context, range, limits); } },
    { tab: TABS.raw_search_term_daily, fetch: function () { return searchTermRows(context, range, limits); } },
    { tab: TABS.raw_hour_device, fetch: function () { return hourDeviceRows(context, range, limits); } },
    { tab: TABS.raw_policy, fetch: function () { return policyRows(context, limits); } },
    { tab: TABS.raw_pmax_channel_daily, fetch: function () { return pmaxChannelRows(context, range, limits); } },
    { tab: TABS.raw_pmax_terms_daily, fetch: function () { return pmaxTermRows(context, range, limits); } },
    { tab: TABS.raw_geo_daily, fetch: function () { return geoRows(context, range, limits); } },
    { tab: TABS.raw_placement_daily, fetch: function () { return placementRows(context, range, limits); } },
    { tab: TABS.raw_budget_daily, fetch: function () { return budgetRows(context, range, limits); } },
    { tab: TABS.raw_conversion_action_daily, fetch: function () { return conversionActionRows(context, range, limits); } },
  ];
}

function ensureTabs(spreadsheet, limits) {
  Object.keys(TABS).forEach(function (key) {
    var tab = TABS[key];
    var sheet = spreadsheet.getSheetByName(tab.name) || spreadsheet.insertSheet(tab.name);
    var expected = tab.headers.join('|');
    var current = sheet.getRange(1, 1, 1, tab.headers.length).getValues()[0].join('|');
    if (current !== expected) {
      sheet.clear();
      sheet.getRange(1, 1, 1, tab.headers.length).setValues([tab.headers]);
      sheet.setFrozenRows(1);
    }
  });
  seedConfig(spreadsheet, limits);
}

function seedConfig(spreadsheet, limits) {
  var sheet = spreadsheet.getSheetByName(TABS.config.name);
  if (sheet.getLastRow() > 1) return;
  sheet.getRange(2, 1, 12, 3).setValues([
    ['ACCOUNT_TIMEZONE', limits.timezone, 'Reporting timezone, default Asia/Bangkok.'],
    ['LOOKBACK_DAYS', String(limits.lookbackDays), 'Used when START_DATE and END_DATE are blank.'],
    ['START_DATE', '', 'Optional yyyy-MM-dd inclusive start date.'],
    ['END_DATE', '', 'Optional yyyy-MM-dd inclusive end date.'],
    ['MAX_ROWS', String(limits.maxRows), 'Hard row cap per tab.'],
    ['LIMIT', String(limits.limit), 'GAQL LIMIT per query.'],
    ['FRESHNESS_MINUTES', String(limits.freshnessMinutes), 'Expected freshness threshold in minutes.'],
    ['MODE', limits.mode, 'Expected action mode.'],
    ['DRY_RUN', 'true', 'When true, no sheet writes occur.'],
    ['SOURCE_SHEET_ID', spreadsheet.getId(), 'Stable source_sheet_id emitted in all rows.'],
    ['ACCOUNT_ID', '', 'Optional explicit account_id override.'],
    ['CUSTOMER_ID', '', 'Optional explicit customer_id override.'],
  ]);
}

function readConfigSafe(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(TABS.config.name);
  if (!sheet) return {};
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return {};
  var config = {};
  for (var i = 1; i < values.length; i++) {
    var key = String(values[i][0] || '').trim();
    if (!key) continue;
    config[key] = String(values[i][1] || '').trim();
  }
  return config;
}

function buildLimits(config) {
  return {
    timezone: config.ACCOUNT_TIMEZONE || DEFAULT_TIMEZONE,
    lookbackDays: numberConfig(config.LOOKBACK_DAYS, DEFAULT_LOOKBACK_DAYS),
    maxRows: numberConfig(config.MAX_ROWS, DEFAULT_MAX_ROWS),
    limit: numberConfig(config.LIMIT, DEFAULT_LIMIT),
    freshnessMinutes: numberConfig(config.FRESHNESS_MINUTES, 90),
    mode: config.MODE || 'review_only',
  };
}

function buildContext(config, spreadsheet) {
  var account = AdsApp.currentAccount();
  return {
    accountId: config.ACCOUNT_ID || account.getCustomerId(),
    customerId: config.CUSTOMER_ID || account.getCustomerId(),
    sourceSheetId: config.SOURCE_SHEET_ID || spreadsheet.getId(),
  };
}

function isDryRun(config) {
  return String(config.DRY_RUN || 'true').toLowerCase() !== 'false';
}

function dateRange(config, timezone) {
  if (config.START_DATE && config.END_DATE) return { start: config.START_DATE, end: config.END_DATE };
  var lookback = numberConfig(config.LOOKBACK_DAYS, DEFAULT_LOOKBACK_DAYS);
  var end = new Date();
  var start = new Date(end.getTime() - (lookback - 1) * 24 * 60 * 60 * 1000);
  return {
    start: Utilities.formatDate(start, timezone, 'yyyy-MM-dd'),
    end: Utilities.formatDate(end, timezone, 'yyyy-MM-dd'),
  };
}

function campaignRows(context, range, limits) {
  return queryRows([
    "SELECT segments.date, campaign.id, campaign.name, campaign.status, campaign.serving_status,",
    "campaign.advertising_channel_type, campaign.bidding_strategy_type, campaign_budget.amount_micros,",
    "metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value",
    "FROM campaign",
    whereDateRange(range),
    'ORDER BY segments.date DESC',
    'LIMIT ' + limits.limit,
  ].join(' '), limits, function (row) {
    var costMicros = numberValue(row.metrics.costMicros);
    return [
      row.segments.date, context.accountId, context.customerId, context.sourceSheetId,
      stringValue(row.campaign.id), stringValue(row.campaign.name),
      numberValue(row.metrics.impressions), numberValue(row.metrics.clicks), costMicros, microsToCurrency(costMicros),
      numberValue(row.metrics.conversions), numberValue(row.metrics.conversionsValue),
      stringValue(row.campaign.status), stringValue(row.campaign.servingStatus),
      stringValue(row.campaign.advertisingChannelType), stringValue(row.campaign.biddingStrategyType),
      microsToCurrency(numberValue(row.campaignBudget.amountMicros)),
    ];
  });
}

function adgroupRows(context, range, limits) {
  return queryRows([
    "SELECT segments.date, campaign.id, campaign.name, campaign.bidding_strategy_type, ad_group.id, ad_group.name,",
    "ad_group.status, ad_group.cpc_bid_micros, metrics.impressions, metrics.clicks, metrics.cost_micros,",
    "metrics.conversions, metrics.conversions_value",
    "FROM ad_group",
    whereDateRange(range),
    'ORDER BY segments.date DESC',
    'LIMIT ' + limits.limit,
  ].join(' '), limits, function (row) {
    var costMicros = numberValue(row.metrics.costMicros);
    return [
      row.segments.date, context.accountId, context.customerId, context.sourceSheetId,
      stringValue(row.campaign.id), stringValue(row.campaign.name),
      numberValue(row.metrics.impressions), numberValue(row.metrics.clicks), costMicros, microsToCurrency(costMicros),
      numberValue(row.metrics.conversions), numberValue(row.metrics.conversionsValue),
      stringValue(row.adGroup.id), stringValue(row.adGroup.name), stringValue(row.adGroup.status),
      stringValue(row.campaign.biddingStrategyType), microsToCurrency(numberValue(row.adGroup.cpcBidMicros)),
    ];
  });
}

function keywordRows(context, range, limits) {
  return queryRows([
    "SELECT segments.date, segments.device, campaign.id, campaign.name, ad_group.id, ad_group.name,",
    "ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,",
    "ad_group_criterion.status, metrics.impressions, metrics.clicks, metrics.cost_micros,",
    "metrics.conversions, metrics.conversions_value",
    "FROM keyword_view",
    whereDateRange(range),
    'ORDER BY segments.date DESC',
    'LIMIT ' + limits.limit,
  ].join(' '), limits, function (row) {
    var costMicros = numberValue(row.metrics.costMicros);
    return [
      row.segments.date, context.accountId, context.customerId, context.sourceSheetId,
      stringValue(row.campaign.id), stringValue(row.campaign.name),
      numberValue(row.metrics.impressions), numberValue(row.metrics.clicks), costMicros, microsToCurrency(costMicros),
      numberValue(row.metrics.conversions), numberValue(row.metrics.conversionsValue),
      stringValue(row.adGroup.id), stringValue(row.adGroup.name), stringValue(row.adGroupCriterion.criterionId),
      stringValue(row.adGroupCriterion.keyword.text), stringValue(row.adGroupCriterion.keyword.matchType),
      stringValue(row.adGroupCriterion.status), stringValue(row.segments.device),
    ];
  });
}

function searchTermRows(context, range, limits) {
  return queryRows([
    "SELECT segments.date, search_term_view.search_term, search_term_view.status, campaign.id, campaign.name,",
    "ad_group.id, ad_group.name, metrics.impressions, metrics.clicks, metrics.cost_micros,",
    "metrics.conversions, metrics.conversions_value",
    "FROM search_term_view",
    whereDateRange(range),
    'ORDER BY segments.date DESC',
    'LIMIT ' + limits.limit,
  ].join(' '), limits, function (row) {
    var costMicros = numberValue(row.metrics.costMicros);
    return [
      row.segments.date, context.accountId, context.customerId, context.sourceSheetId,
      stringValue(row.campaign.id), stringValue(row.campaign.name),
      numberValue(row.metrics.impressions), numberValue(row.metrics.clicks), costMicros, microsToCurrency(costMicros),
      numberValue(row.metrics.conversions), numberValue(row.metrics.conversionsValue),
      stringValue(row.adGroup.id), stringValue(row.adGroup.name), stringValue(row.searchTermView.searchTerm),
      stringValue(row.searchTermView.status),
    ];
  });
}

function hourDeviceRows(context, range, limits) {
  return queryRows([
    "SELECT segments.date, segments.hour, segments.device, campaign.id, campaign.name,",
    "metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value",
    "FROM campaign",
    whereDateRange(range),
    'ORDER BY segments.date DESC',
    'LIMIT ' + limits.limit,
  ].join(' '), limits, function (row) {
    var costMicros = numberValue(row.metrics.costMicros);
    return [
      row.segments.date, context.accountId, context.customerId, context.sourceSheetId,
      stringValue(row.campaign.id), stringValue(row.campaign.name),
      numberValue(row.metrics.impressions), numberValue(row.metrics.clicks), costMicros, microsToCurrency(costMicros),
      numberValue(row.metrics.conversions), numberValue(row.metrics.conversionsValue),
      numberValue(row.segments.hour), stringValue(row.segments.device),
    ];
  });
}

function policyRows(context, limits) {
  return queryRows([
    'SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group_ad.ad.id,',
    'ad_group_ad.status, ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.review_status,',
    'ad_group_ad.ad.final_urls',
    'FROM ad_group_ad',
    'LIMIT ' + limits.limit,
  ].join(' '), limits, function (row) {
    return [
      context.accountId, context.customerId, context.sourceSheetId,
      stringValue(row.campaign.id), stringValue(row.campaign.name),
      stringValue(row.adGroup.id), stringValue(row.adGroup.name), stringValue(row.adGroupAd.ad.id),
      stringValue(row.adGroupAd.status), stringValue(row.adGroupAd.policySummary.approvalStatus),
      stringValue(row.adGroupAd.policySummary.reviewStatus), (row.adGroupAd.ad.finalUrls || []).join(' '),
    ];
  });
}

function pmaxChannelRows(context, range, limits) {
  return queryRows([
    "SELECT segments.date, campaign.id, campaign.name, asset_group.id, asset_group.name,",
    "segments.asset_interaction_target.asset, metrics.impressions, metrics.clicks, metrics.cost_micros,",
    "metrics.conversions, metrics.conversions_value",
    "FROM asset_group",
    "WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX' AND " + whereDateRangeForString(range),
    'ORDER BY segments.date DESC',
    'LIMIT ' + limits.limit,
  ].join(' '), limits, function (row) {
    var costMicros = numberValue(row.metrics.costMicros);
    return [
      row.segments.date, context.accountId, context.customerId, context.sourceSheetId,
      stringValue(row.campaign.id), stringValue(row.campaign.name),
      numberValue(row.metrics.impressions), numberValue(row.metrics.clicks), costMicros, microsToCurrency(costMicros),
      numberValue(row.metrics.conversions), numberValue(row.metrics.conversionsValue),
      stringValue(row.assetGroup.id), stringValue(row.assetGroup.name),
      stringValue(row.segments.assetInteractionTarget && row.segments.assetInteractionTarget.asset || 'unknown'),
    ];
  });
}

function pmaxTermRows(context, range, limits) {
  return queryRows([
    "SELECT segments.date, campaign.id, campaign.name, asset_group.id, asset_group.name,",
    "campaign_search_term_view.search_term, campaign_search_term_view.status, metrics.impressions, metrics.clicks,",
    "metrics.cost_micros, metrics.conversions, metrics.conversions_value",
    "FROM campaign_search_term_view",
    "WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX' AND " + whereDateRangeForString(range),
    'ORDER BY segments.date DESC',
    'LIMIT ' + limits.limit,
  ].join(' '), limits, function (row) {
    var costMicros = numberValue(row.metrics.costMicros);
    return [
      row.segments.date, context.accountId, context.customerId, context.sourceSheetId,
      stringValue(row.campaign.id), stringValue(row.campaign.name),
      numberValue(row.metrics.impressions), numberValue(row.metrics.clicks), costMicros, microsToCurrency(costMicros),
      numberValue(row.metrics.conversions), numberValue(row.metrics.conversionsValue),
      stringValue(row.assetGroup && row.assetGroup.id || ''), stringValue(row.assetGroup && row.assetGroup.name || ''),
      stringValue(row.campaignSearchTermView.searchTerm), stringValue(row.campaignSearchTermView.status),
    ];
  });
}

function geoRows(context, range, limits) {
  return queryRows([
    "SELECT segments.date, campaign.id, campaign.name, geographic_view.country_criterion_id,",
    "geographic_view.location_type, segments.geo_target_country, segments.geo_target_region, segments.geo_target_city,",
    "metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value",
    "FROM geographic_view",
    whereDateRange(range),
    'ORDER BY segments.date DESC',
    'LIMIT ' + limits.limit,
  ].join(' '), limits, function (row) {
    var costMicros = numberValue(row.metrics.costMicros);
    return [
      row.segments.date, context.accountId, context.customerId, context.sourceSheetId,
      stringValue(row.campaign.id), stringValue(row.campaign.name),
      numberValue(row.metrics.impressions), numberValue(row.metrics.clicks), costMicros, microsToCurrency(costMicros),
      numberValue(row.metrics.conversions), numberValue(row.metrics.conversionsValue),
      stringValue(row.geographicView.countryCriterionId), stringValue(row.segments.geoTargetCountry),
      stringValue(row.segments.geoTargetRegion), stringValue(row.segments.geoTargetCity),
    ];
  });
}

function placementRows(context, range, limits) {
  return queryRows([
    "SELECT segments.date, campaign.id, campaign.name, ad_group.id, ad_group.name, group_placement_view.target_url,",
    "group_placement_view.placement_type, metrics.impressions, metrics.clicks, metrics.cost_micros,",
    "metrics.conversions, metrics.conversions_value",
    "FROM group_placement_view",
    whereDateRange(range),
    'ORDER BY segments.date DESC',
    'LIMIT ' + limits.limit,
  ].join(' '), limits, function (row) {
    var costMicros = numberValue(row.metrics.costMicros);
    return [
      row.segments.date, context.accountId, context.customerId, context.sourceSheetId,
      stringValue(row.campaign.id), stringValue(row.campaign.name),
      numberValue(row.metrics.impressions), numberValue(row.metrics.clicks), costMicros, microsToCurrency(costMicros),
      numberValue(row.metrics.conversions), numberValue(row.metrics.conversionsValue),
      stringValue(row.adGroup.id), stringValue(row.adGroup.name),
      stringValue(row.groupPlacementView.targetUrl), stringValue(row.groupPlacementView.placementType),
    ];
  });
}

function budgetRows(context, range, limits) {
  return queryRows([
    "SELECT segments.date, campaign.id, campaign.name, campaign_budget.amount_micros, metrics.cost_micros,",
    "metrics.search_budget_lost_impression_share",
    "FROM campaign",
    whereDateRange(range),
    'ORDER BY segments.date DESC',
    'LIMIT ' + limits.limit,
  ].join(' '), limits, function (row) {
    var budget = microsToCurrency(numberValue(row.campaignBudget.amountMicros));
    var cost = microsToCurrency(numberValue(row.metrics.costMicros));
    return [
      row.segments.date, context.accountId, context.customerId, context.sourceSheetId,
      stringValue(row.campaign.id), stringValue(row.campaign.name),
      budget, cost, numberValue(row.metrics.searchBudgetLostImpressionShare),
      Math.max(0, budget - cost), budget > 0 ? cost / budget : 0,
    ];
  });
}

function conversionActionRows(context, range, limits) {
  return queryRows([
    "SELECT segments.date, campaign.id, campaign.name, conversion_action.id, conversion_action.name,",
    "conversion_action.category, conversion_action.primary_for_goal, conversion_action.include_in_conversions_metric,",
    "metrics.conversions, metrics.conversions_value, metrics.all_conversions",
    "FROM conversion_action",
    whereDateRange(range),
    'ORDER BY segments.date DESC',
    'LIMIT ' + limits.limit,
  ].join(' '), limits, function (row) {
    return [
      row.segments.date, context.accountId, context.customerId, context.sourceSheetId,
      stringValue(row.campaign && row.campaign.id || ''), stringValue(row.campaign && row.campaign.name || ''),
      stringValue(row.conversionAction.id), stringValue(row.conversionAction.name),
      stringValue(row.conversionAction.category), booleanValue(row.conversionAction.primaryForGoal),
      booleanValue(row.conversionAction.includeInConversionsMetric),
      numberValue(row.metrics.conversions), numberValue(row.metrics.conversionsValue), numberValue(row.metrics.allConversions),
    ];
  });
}

function queryRows(query, limits, mapper) {
  var iterator = AdsApp.search(query);
  var rows = [];
  while (iterator.hasNext() && rows.length < limits.maxRows) rows.push(mapper(iterator.next()));
  return rows;
}

function writeRows(spreadsheet, tab, rows, maxRows) {
  var sheet = spreadsheet.getSheetByName(tab.name);
  sheet.getRange(2, 1, Math.max(1, sheet.getMaxRows() - 1), tab.headers.length).clearContent();
  if (rows.length > 0) {
    var trimmed = rows.slice(0, maxRows);
    sheet.getRange(2, 1, trimmed.length, tab.headers.length).setValues(trimmed);
  }
}

function appendSyncLog(spreadsheet, payload) {
  var sheet = spreadsheet.getSheetByName(TABS.sync_log.name);
  sheet.appendRow(TABS.sync_log.headers.map(function (header) { return payload[header] || ''; }));
}

function whereDateRange(range) {
  return "WHERE segments.date BETWEEN '" + range.start + "' AND '" + range.end + "'";
}

function whereDateRangeForString(range) {
  return "segments.date BETWEEN '" + range.start + "' AND '" + range.end + "'";
}

function microsToCurrency(value) {
  return value / 1000000;
}

function requiredProperty(name) {
  var value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) throw new Error('missing_property:' + name);
  return value;
}

function numberConfig(value, fallback) {
  var parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function numberValue(value) {
  var parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value) {
  return value === null || value === undefined ? '' : String(value);
}

function booleanValue(value) {
  return value === true || String(value).toLowerCase() === 'true';
}
