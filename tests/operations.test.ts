import test from 'node:test';
import assert from 'node:assert/strict';
import {
  maturity,
  preferenceInput,
} from '../src/mastra/company/operations-store';
import { defaultAgentModel } from '../src/mastra/company/model-policy';
test('maturity has no invented score, normalizes observed evidence and stays provisional', () => {
  assert.equal(maturity([], []).score, null);
  const result = maturity(
    [
      {
        status: 'completed',
        report: { review: { accepted: true, evidenceGaps: [] } },
      },
      {
        status: 'blocked',
        report: { review: { accepted: false, evidenceGaps: ['missing'] } },
      },
    ],
    [{ rating: 5 }],
  );
  assert.equal(result.score, 60);
  assert.equal(result.confidence, 'provisional');
  assert.equal(result.assessed, 2);
  assert.equal(result.feedbackCount, 1);
});
test('only bounded response preferences are accepted and complex work uses a different supported model', () => {
  assert.equal(
    preferenceInput.safeParse({ verbosity: 'concise' }).success,
    true,
  );
  assert.equal(
    preferenceInput.safeParse({ approval: 'bypass' }).success,
    false,
  );
  assert.notEqual(
    defaultAgentModel('knowledge-curator'),
    defaultAgentModel('engineering'),
  );
  assert.equal(defaultAgentModel('quality'), defaultAgentModel('engineering'));
});

test('blocker classification distinguishes missing evidence from an actual provider/access failure', async()=>{
  const {blockerDetails}=await import('../src/mastra/company/blockers');
  const base={id:'fixture',department:'product',status:'blocked'};
  assert.equal(blockerDetails({...base,report:{report:{blockers:['Retain interaction evidence; model/provider tests used doubles and do not prove a launch.']}}}).kind,'evidence');
  assert.equal(blockerDetails({...base,report:{report:{blockers:['Missing OAuth access credential']}}}).kind,'access');
  assert.equal(blockerDetails({...base,report:{error:'Assignment failed; inspect configuration or provider failure.'}}).kind,'provider');
  assert.equal(blockerDetails({...base,report:{report:{blockers:['Billing payment method declined']}}}).kind,'budget');
});
