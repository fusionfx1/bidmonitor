/*
 * CANONICAL Google Ads Script
 * scripts/google-ads/applier.gs
 * Purpose: Sheet-controlled Google Ads executor scaffold.
 *
 * Default state is disabled and dry-run. It is safe to install/schedule this
 * script while the automation_config tab remains in its default state.
 */

var APPLIER_SCRIPT_VERSION = 'p2c-applier-disabled-0.1.0';
var APPLIER_DEFAULT_SHEET_ID = '1E-JsqNy9mrgt-d4-O6ZkvFUpi6Ud6ugtljhRvD3hpK0';

var APPLIER_TAB_CONFIG = 'automation_config';
var APPLIER_TAB_QUEUE = 'proposal_queue';
var APPLIER_TAB_LOG = 'action_log';
var APPLIER_TAB_STATUS = 'automation_status';
var APPLIER_TAB_ALLOWLIST = 'campaign_allowlist';
var APPLIER_TAB_DENYLIST = 'campaign_denylist';

var APPLIER_ACTIONS = {
  SET_BUDGET: 'SET_BUDGET',
  PAUSE_CAMPAIGN: 'PAUSE_CAMPAIGN',
  ENABLE_CAMPAIGN: 'ENABLE_CAMPAIGN',
  SET_ADGROUP_CPC_BID: 'SET_ADGROUP_CPC_BID',
  SET_BID: 'SET_BID',
};

function runApplier() {
  var startedAt = new Date();
  var runId = p2cApplierRunId(startedAt);
  var spreadsheet = SpreadsheetApp.openById(p2cApplierSheetId());
  p2cApplierEnsureTabs(spreadsheet);

  var config = p2cApplierReadKeyValueSheet(spreadsheet, APPLIER_TAB_CONFIG);
  var account = AdsApp.currentAccount();
  var mode = p2cApplierLower(config.MODE || 'review_only');
  var enabled = p2cApplierBool(config.APPLIER_ENABLED);
  var liveMutationAllowed = p2cApplierBool(config.ALLOW_LIVE_MUTATION);
  var dryRun = p2cApplierShouldDryRun(config, mode, liveMutationAllowed);

  var summary = {
    seen: 0,
    applied: 0,
    skipped: 0,
    errors: 0,
    lastError: '',
  };

  try {
    if (!enabled) {
      p2cApplierAppendActionLog(spreadsheet, p2cApplierMakeLogRow(runId, config, account, {
        result: 'disabled',
        message: 'APPLIER_ENABLED is false. No proposal rows were processed.',
      }, dryRun));
      p2cApplierUpdateStatus(spreadsheet, runId, 'disabled', '', summary);
      return;
    }

    if (mode === 'disabled' || mode === 'review_only') {
      p2cApplierAppendActionLog(spreadsheet, p2cApplierMakeLogRow(runId, config, account, {
        result: 'review_only',
        message: 'MODE is ' + mode + '. No proposal rows were processed.',
      }, dryRun));
      p2cApplierUpdateStatus(spreadsheet, runId, 'review_only', '', summary);
      return;
    }

    var proposals = p2cApplierReadProposalRows(spreadsheet);
    var allowlist = p2cApplierReadCampaignRules(spreadsheet, APPLIER_TAB_ALLOWLIST);
    var denylist = p2cApplierReadCampaignRules(spreadsheet, APPLIER_TAB_DENYLIST);
    var maxChanges = p2cApplierNumber(config.MAX_CHANGES_PER_RUN, 0);

    for (var i = 0; i < proposals.length; i++) {
      var proposal = proposals[i];
      if (!p2cApplierIsProcessableProposal(proposal)) continue;

      summary.seen++;
      if (summary.applied >= maxChanges) {
        p2cApplierRecordResult(spreadsheet, proposal, runId, config, account, {
          result: 'skipped_max_changes',
          message: 'MAX_CHANGES_PER_RUN reached.',
        }, dryRun, summary);
        continue;
      }

      var result = p2cApplierProcessProposal(proposal, config, allowlist, denylist, dryRun);
      p2cApplierRecordResult(spreadsheet, proposal, runId, config, account, result, dryRun, summary);
    }

    p2cApplierUpdateStatus(spreadsheet, runId, 'success', '', summary);
  } catch (err) {
    summary.errors++;
    summary.lastError = String(err && err.message ? err.message : err);
    p2cApplierAppendActionLog(spreadsheet, p2cApplierMakeLogRow(runId, config, account, {
      result: 'error',
      message: summary.lastError,
    }, dryRun));
    p2cApplierUpdateStatus(spreadsheet, runId, 'error', summary.lastError, summary);
    throw err;
  }
}

function p2cApplierProcessProposal(proposal, config, allowlist, denylist, dryRun) {
  var action = String(proposal.action || '').trim().toUpperCase();
  if (!action) return { result: 'skipped_missing_action', message: 'Missing action.' };

  var guard = p2cApplierGuardProposal(proposal, action, config, allowlist, denylist);
  if (guard) return guard;

  if (action === APPLIER_ACTIONS.SET_BUDGET) return p2cApplierApplyBudget(proposal, config, dryRun);
  if (action === APPLIER_ACTIONS.PAUSE_CAMPAIGN) return p2cApplierApplyStatus(proposal, 'pause', dryRun);
  if (action === APPLIER_ACTIONS.ENABLE_CAMPAIGN) return p2cApplierApplyStatus(proposal, 'enable', dryRun);
  if (action === APPLIER_ACTIONS.SET_ADGROUP_CPC_BID || action === APPLIER_ACTIONS.SET_BID) {
    return p2cApplierApplyBid(proposal, config, dryRun);
  }

  return { result: 'skipped_out_of_scope', message: 'Unsupported action: ' + action };
}

function p2cApplierGuardProposal(proposal, action, config, allowlist, denylist) {
  var campaignId = String(proposal.campaign_id || '').trim();
  if (!campaignId) return { result: 'skipped_missing_campaign_id', message: 'Missing campaign_id.' };

  if (p2cApplierIsCampaignDenied(denylist, campaignId, action)) {
    return { result: 'skipped_denylist', message: 'Campaign is blocked in campaign_denylist.' };
  }

  if (p2cApplierBool(config.REQUIRE_ALLOWLIST) &&
      !p2cApplierIsCampaignAllowed(allowlist, campaignId, action)) {
    return { result: 'skipped_not_allowlisted', message: 'Campaign is not enabled in campaign_allowlist.' };
  }

  if (action === APPLIER_ACTIONS.SET_BUDGET && !p2cApplierBool(config.ENABLE_BUDGET_ACTIONS)) {
    return { result: 'skipped_budget_actions_disabled', message: 'ENABLE_BUDGET_ACTIONS is false.' };
  }

  if ((action === APPLIER_ACTIONS.PAUSE_CAMPAIGN || action === APPLIER_ACTIONS.ENABLE_CAMPAIGN) &&
      !p2cApplierBool(config.ENABLE_STATUS_ACTIONS)) {
    return { result: 'skipped_status_actions_disabled', message: 'ENABLE_STATUS_ACTIONS is false.' };
  }

  if ((action === APPLIER_ACTIONS.SET_ADGROUP_CPC_BID || action === APPLIER_ACTIONS.SET_BID) &&
      !p2cApplierBool(config.ENABLE_BID_ACTIONS)) {
    return { result: 'skipped_bid_actions_disabled', message: 'ENABLE_BID_ACTIONS is false.' };
  }

  if (p2cApplierBool(config.APPROVAL_REQUIRED) && !p2cApplierIsApproved(proposal)) {
    return { result: 'skipped_not_approved', message: 'Proposal is not approved.' };
  }

  return null;
}

function p2cApplierApplyBudget(proposal, config, dryRun) {
  var campaign = p2cApplierFindCampaignById(proposal.campaign_id);
  if (!campaign) return { result: 'not_found', message: 'Campaign not found.' };

  var budget = campaign.getBudget();
  if (budget.isExplicitlyShared && budget.isExplicitlyShared() && !p2cApplierBool(config.ALLOW_SHARED_BUDGET)) {
    return { result: 'skipped_shared_budget', message: 'Shared budget is not allowed.' };
  }

  var current = budget.getAmount();
  var expected = p2cApplierNumberOrNull(proposal.expected_current_budget);
  if (expected !== null && Math.abs(current - expected) > 0.01) {
    return {
      result: 'skipped_budget_changed',
      oldValue: current,
      message: 'Live budget changed from expected value.',
    };
  }

  var target = p2cApplierClampBudget(p2cApplierNumber(proposal.target_budget, current), current, config);
  if (dryRun) {
    return {
      result: 'dry_run_budget',
      oldValue: current,
      newValue: target,
      message: 'Would set campaign daily budget.',
    };
  }

  budget.setAmount(target);
  return {
    result: 'applied_budget',
    oldValue: current,
    newValue: target,
    message: 'Campaign daily budget updated.',
  };
}

function p2cApplierApplyStatus(proposal, statusAction, dryRun) {
  var campaign = p2cApplierFindCampaignById(proposal.campaign_id);
  if (!campaign) return { result: 'not_found', message: 'Campaign not found.' };

  if (dryRun) {
    return {
      result: 'dry_run_status',
      oldValue: '',
      newValue: statusAction,
      message: 'Would ' + statusAction + ' campaign.',
    };
  }

  if (statusAction === 'pause') campaign.pause();
  if (statusAction === 'enable') campaign.enable();

  return {
    result: 'applied_status',
    oldValue: '',
    newValue: statusAction,
    message: 'Campaign status changed.',
  };
}

function p2cApplierApplyBid(proposal, config, dryRun) {
  var adGroupId = String(proposal.ad_group_id || '').trim();
  if (!adGroupId) return { result: 'skipped_missing_ad_group_id', message: 'Bid action requires ad_group_id.' };

  var adGroup = p2cApplierFindAdGroupById(adGroupId);
  if (!adGroup) return { result: 'not_found', message: 'Ad group not found.' };

  var bidding = adGroup.bidding();
  if (!bidding || !bidding.getCpc || !bidding.setCpc) {
    return {
      result: 'skipped_bid_method_unavailable',
      message: 'This campaign/ad group does not expose manual CPC bid methods.',
    };
  }

  var current = bidding.getCpc();
  var expected = p2cApplierNumberOrNull(proposal.expected_current_bid);
  if (expected !== null && Math.abs(current - expected) > 0.01) {
    return {
      result: 'skipped_bid_changed',
      oldValue: current,
      message: 'Live bid changed from expected value.',
    };
  }

  var target = p2cApplierClampBid(p2cApplierNumber(proposal.target_bid, current), current, config);
  if (dryRun) {
    return {
      result: 'dry_run_bid',
      oldValue: current,
      newValue: target,
      message: 'Would set ad group CPC bid.',
    };
  }

  bidding.setCpc(target);
  return {
    result: 'applied_bid',
    oldValue: current,
    newValue: target,
    message: 'Ad group CPC bid updated.',
  };
}

function p2cApplierShouldDryRun(config, mode, liveMutationAllowed) {
  if (p2cApplierBool(config.DRY_RUN)) return true;
  if (mode !== 'manual_apply') return true;
  if (!liveMutationAllowed) return true;
  return false;
}

function p2cApplierIsProcessableProposal(row) {
  var status = p2cApplierLower(row.status || '');
  if (status === 'disabled_sample') return false;
  return status === '' || status === 'ready' || status === 'approved';
}

function p2cApplierIsApproved(row) {
  if (p2cApplierUpper(row.approved || '') !== 'YES') return false;
  if (!String(row.approved_by || '').trim()) return false;
  var expires = String(row.approval_expires_at || '').trim();
  if (!expires) return false;
  var expiryDate = new Date(expires);
  if (isNaN(expiryDate.getTime())) return false;
  return expiryDate.getTime() > new Date().getTime();
}

function p2cApplierFindCampaignById(campaignId) {
  var id = Number(campaignId);
  if (!isFinite(id)) return null;
  var iterator = AdsApp.campaigns().withIds([id]).get();
  return iterator.hasNext() ? iterator.next() : null;
}

function p2cApplierFindAdGroupById(adGroupId) {
  var id = Number(adGroupId);
  if (!isFinite(id)) return null;
  var iterator = AdsApp.adGroups().withIds([id]).get();
  return iterator.hasNext() ? iterator.next() : null;
}

function p2cApplierClampBudget(target, current, config) {
  var minBudget = p2cApplierNumber(config.MIN_BUDGET, 1);
  var maxBudget = p2cApplierNumber(config.MAX_BUDGET, 200);
  var maxPercent = p2cApplierNumber(config.MAX_BUDGET_CHANGE_PERCENT, 20);
  var low = current * (1 - maxPercent / 100);
  var high = current * (1 + maxPercent / 100);
  return p2cApplierRoundMoney(Math.max(minBudget, Math.min(maxBudget, Math.min(high, Math.max(low, target)))));
}

function p2cApplierClampBid(target, current, config) {
  var minBid = p2cApplierNumber(config.MIN_BID, 0.05);
  var maxBid = p2cApplierNumber(config.MAX_BID, 10);
  var maxPercent = p2cApplierNumber(config.MAX_BID_CHANGE_PERCENT, 15);
  var low = current * (1 - maxPercent / 100);
  var high = current * (1 + maxPercent / 100);
  return p2cApplierRoundMoney(Math.max(minBid, Math.min(maxBid, Math.min(high, Math.max(low, target)))));
}

function p2cApplierReadProposalRows(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(APPLIER_TAB_QUEUE);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var headers = p2cApplierNormalizeHeaders(values[0]);
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) row[headers[j]] = values[i][j];
    row.__rowNumber = i + 1;
    rows.push(row);
  }
  return rows;
}

function p2cApplierReadCampaignRules(spreadsheet, tabName) {
  var sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet || sheet.getLastRow() < 2) return {};
  var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var headers = p2cApplierNormalizeHeaders(values[0]);
  var rules = {};
  for (var i = 1; i < values.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) row[headers[j]] = values[i][j];
    var id = String(row.campaign_id || '').trim();
    if (id) rules[id] = row;
  }
  return rules;
}

function p2cApplierIsCampaignAllowed(allowlist, campaignId, action) {
  var row = allowlist[String(campaignId)];
  if (!row || !p2cApplierBool(row.enabled)) return false;
  if (action === APPLIER_ACTIONS.SET_BUDGET) return p2cApplierBool(row.allow_budget);
  if (action === APPLIER_ACTIONS.PAUSE_CAMPAIGN || action === APPLIER_ACTIONS.ENABLE_CAMPAIGN) {
    return p2cApplierBool(row.allow_status);
  }
  if (action === APPLIER_ACTIONS.SET_ADGROUP_CPC_BID || action === APPLIER_ACTIONS.SET_BID) {
    return p2cApplierBool(row.allow_bid);
  }
  return false;
}

function p2cApplierIsCampaignDenied(denylist, campaignId, action) {
  var row = denylist[String(campaignId)];
  if (!row) return false;
  if (action === APPLIER_ACTIONS.SET_BUDGET) return p2cApplierBool(row.deny_budget);
  if (action === APPLIER_ACTIONS.PAUSE_CAMPAIGN || action === APPLIER_ACTIONS.ENABLE_CAMPAIGN) {
    return p2cApplierBool(row.deny_status);
  }
  if (action === APPLIER_ACTIONS.SET_ADGROUP_CPC_BID || action === APPLIER_ACTIONS.SET_BID) {
    return p2cApplierBool(row.deny_bid);
  }
  return false;
}

function p2cApplierRecordResult(spreadsheet, proposal, runId, config, account, result, dryRun, summary) {
  if (String(result.result || '').indexOf('applied_') === 0) summary.applied++;
  else if (String(result.result || '').indexOf('error') >= 0) summary.errors++;
  else summary.skipped++;

  p2cApplierAppendActionLog(spreadsheet, p2cApplierMakeLogRow(runId, config, account, result, dryRun, proposal));
  p2cApplierUpdateProposalResult(spreadsheet, proposal, runId, result);
}

function p2cApplierMakeLogRow(runId, config, account, result, dryRun, proposal) {
  proposal = proposal || {};
  return [
    runId,
    new Date().toISOString(),
    APPLIER_SCRIPT_VERSION,
    config.MODE || 'review_only',
    String(dryRun),
    String(p2cApplierBool(config.APPLIER_ENABLED)),
    proposal.action_id || '',
    proposal.entity_level || '',
    proposal.action || '',
    proposal.campaign_id || '',
    proposal.ad_group_id || '',
    proposal.criterion_id || '',
    result.oldValue != null ? result.oldValue : '',
    result.newValue != null ? result.newValue : '',
    result.result || '',
    result.message || '',
    account.getTimeZone(),
    account.getCustomerId(),
  ];
}

function p2cApplierAppendActionLog(spreadsheet, row) {
  var sheet = spreadsheet.getSheetByName(APPLIER_TAB_LOG);
  sheet.appendRow(row);
}

function p2cApplierUpdateProposalResult(spreadsheet, proposal, runId, result) {
  var sheet = spreadsheet.getSheetByName(APPLIER_TAB_QUEUE);
  var headers = p2cApplierNormalizeHeaders(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  p2cApplierSetCellByHeader(sheet, proposal.__rowNumber, headers, 'last_result', result.result + ': ' + (result.message || ''));
  p2cApplierSetCellByHeader(sheet, proposal.__rowNumber, headers, 'last_run_id', runId);
  if (String(result.result || '').indexOf('applied_') === 0) {
    p2cApplierSetCellByHeader(sheet, proposal.__rowNumber, headers, 'applied_at', new Date().toISOString());
    p2cApplierSetCellByHeader(sheet, proposal.__rowNumber, headers, 'status', 'applied');
  }
}

function p2cApplierUpdateStatus(spreadsheet, runId, result, errorMessage, summary) {
  var updates = {
    last_run_at: new Date().toISOString(),
    last_run_id: runId,
    last_result: result,
    last_error: errorMessage || '',
    actions_seen_last_run: String(summary.seen || 0),
    actions_applied_last_run: String(summary.applied || 0),
    install_state: result === 'disabled' ? 'disabled_ready' : 'executor_checked',
  };
  var sheet = spreadsheet.getSheetByName(APPLIER_TAB_STATUS);
  var values = sheet.getDataRange().getValues();
  var rowByKey = {};
  for (var i = 1; i < values.length; i++) rowByKey[String(values[i][0] || '').trim()] = i + 1;
  Object.keys(updates).forEach(function (key) {
    if (rowByKey[key]) sheet.getRange(rowByKey[key], 2).setValue(updates[key]);
    else sheet.appendRow([key, updates[key], '']);
  });
}

function p2cApplierSetCellByHeader(sheet, rowNumber, headers, key, value) {
  var idx = headers.indexOf(key);
  if (idx >= 0) sheet.getRange(rowNumber, idx + 1).setValue(value);
}

function p2cApplierEnsureTabs(spreadsheet) {
  p2cApplierEnsureTab(spreadsheet, APPLIER_TAB_CONFIG, ['key', 'value', 'description']);
  p2cApplierEnsureTab(spreadsheet, APPLIER_TAB_QUEUE, [
    'action_id', 'created_at', 'account_id', 'customer_id', 'entity_level', 'action',
    'campaign_id', 'campaign_name', 'ad_group_id', 'ad_group_name', 'criterion_id',
    'keyword', 'expected_current_bid', 'target_bid', 'expected_current_budget',
    'target_budget', 'approved', 'approved_by', 'approval_expires_at', 'status',
    'reason', 'last_result', 'last_run_id', 'applied_at',
  ]);
  p2cApplierEnsureTab(spreadsheet, APPLIER_TAB_LOG, [
    'run_id', 'timestamp', 'script_version', 'mode', 'dry_run', 'applier_enabled',
    'action_id', 'entity_level', 'action', 'campaign_id', 'ad_group_id', 'criterion_id',
    'old_value', 'new_value', 'result', 'message', 'account_timezone', 'customer_id',
  ]);
  p2cApplierEnsureTab(spreadsheet, APPLIER_TAB_STATUS, ['key', 'value', 'description']);
  p2cApplierEnsureTab(spreadsheet, APPLIER_TAB_ALLOWLIST, [
    'campaign_id', 'campaign_name', 'enabled', 'allow_budget', 'allow_status',
    'allow_bid', 'max_budget_override', 'notes',
  ]);
  p2cApplierEnsureTab(spreadsheet, APPLIER_TAB_DENYLIST, [
    'campaign_id', 'campaign_name', 'deny_budget', 'deny_status', 'deny_bid', 'notes',
  ]);
  p2cApplierSeedConfig(spreadsheet);
}

function p2cApplierEnsureTab(spreadsheet, name, headers) {
  var sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  var current = sheet.getRange(1, 1, 1, headers.length).getValues()[0].join('|');
  var expected = headers.join('|');
  if (current !== expected) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function p2cApplierSeedConfig(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(APPLIER_TAB_CONFIG);
  var defaults = [
    ['APPLIER_ENABLED', 'false', 'Owner must set true before any proposal processing.'],
    ['MODE', 'review_only', 'Owner-controlled mode. manual_apply is required for live mutation.'],
    ['DRY_RUN', 'true', 'When true, all actions are simulated.'],
    ['ALLOW_LIVE_MUTATION', 'false', 'Owner must set true before live mutation can occur.'],
    ['MAX_CHANGES_PER_RUN', '0', 'Owner-controlled run cap.'],
    ['ENABLE_BUDGET_ACTIONS', 'false', 'Owner-controlled budget action gate.'],
    ['ENABLE_BID_ACTIONS', 'false', 'Owner-controlled bid action gate.'],
    ['ENABLE_STATUS_ACTIONS', 'false', 'Owner-controlled pause/enable gate.'],
    ['APPROVAL_REQUIRED', 'true', 'Require approval metadata before proposal execution.'],
    ['REQUIRE_ALLOWLIST', 'true', 'Require campaign_allowlist before proposal execution.'],
  ];
  if (sheet.getLastRow() < 2) {
    sheet.getRange(2, 1, defaults.length, 3).setValues(defaults);
    return;
  }

  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  var present = {};
  for (var i = 0; i < values.length; i++) present[String(values[i][0] || '').trim()] = true;
  defaults.forEach(function (row) {
    if (!present[row[0]]) sheet.appendRow(row);
  });
}

function p2cApplierReadKeyValueSheet(spreadsheet, tabName) {
  var sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet || sheet.getLastRow() < 2) return {};
  var values = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues();
  var result = {};
  for (var i = 1; i < values.length; i++) {
    var key = String(values[i][0] || '').trim();
    if (key) result[key] = values[i][1];
  }
  return result;
}

function p2cApplierSheetId() {
  var fromProperties = PropertiesService.getScriptProperties().getProperty('P2C_SHEET_ID');
  return fromProperties || APPLIER_DEFAULT_SHEET_ID;
}

function p2cApplierRunId(date) {
  return APPLIER_SCRIPT_VERSION + '-' + Utilities.formatDate(date, 'Etc/UTC', 'yyyyMMdd-HHmmss');
}

function p2cApplierNormalizeHeaders(headers) {
  return headers.map(function (header) {
    return String(header || '').trim().toLowerCase();
  });
}

function p2cApplierBool(value) {
  var text = p2cApplierUpper(value);
  return text === 'TRUE' || text === 'YES' || text === '1' || text === 'ON';
}

function p2cApplierNumber(value, fallback) {
  var n = Number(value);
  return isFinite(n) ? n : fallback;
}

function p2cApplierNumberOrNull(value) {
  if (value === '' || value == null) return null;
  var n = Number(value);
  return isFinite(n) ? n : null;
}

function p2cApplierRoundMoney(value) {
  return Math.round(value * 100) / 100;
}

function p2cApplierLower(value) {
  return String(value || '').trim().toLowerCase();
}

function p2cApplierUpper(value) {
  return String(value || '').trim().toUpperCase();
}
