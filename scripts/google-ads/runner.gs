/*
 * CANONICAL Google Ads Script dispatcher
 * scripts/google-ads/runner.gs
 * Purpose: one scheduled entry point for the P2C exporter and disabled applier.
 */

var P2C_RUNTIME_DEFAULT_WORKFLOW = 'exporter';

function main() {
  runP2CDispatcher();
}

function runP2CDispatcher() {
  var workflow = p2cRuntimeWorkflow();

  if (workflow === 'exporter') {
    runExporter();
    return;
  }

  if (workflow === 'applier') {
    runApplier();
    return;
  }

  if (workflow === 'exporter_then_applier' || workflow === 'all') {
    runExporter();
    runApplier();
    return;
  }

  throw new Error('unsupported_p2c_runtime_workflow:' + workflow);
}

function p2cRuntimeWorkflow() {
  var value = PropertiesService.getScriptProperties().getProperty('P2C_RUNTIME_WORKFLOW');
  return String(value || P2C_RUNTIME_DEFAULT_WORKFLOW).trim().toLowerCase();
}
