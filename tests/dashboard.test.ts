import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardHtml } from '../src/mastra/company/dashboard';
test('dashboard scripts compile and credentials are never stored persistently', () => {
  const script = dashboardHtml.match(
    /<script nonce="__NONCE__">([\s\S]*?)<\/script>/,
  )?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Function(script));
  assert.doesNotMatch(script, /localStorage|sessionStorage|auth_header/);
  assert.match(dashboardHtml, /Knowledge/);
  assert.match(script, /event: snapshot/);
  assert.doesNotMatch(script, /8000/);
  assert.match(dashboardHtml, /id="live"/);
  assert.match(dashboardHtml, /id="chatLive"/);
  for (const id of ['operationHero', 'operationFlow', 'operationHeadline', 'recentDeliverables', 'activeWorkRuns', 'budgetSummary', 'liveMetrics']) {
    assert.equal(dashboardHtml.split('id="'+id+'"').length - 1, 1, id+' must have one live target');
  }
});
