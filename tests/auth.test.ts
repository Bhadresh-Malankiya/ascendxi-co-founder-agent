import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { companyServerAuth } from '../src/mastra/company/auth';

test('production fails closed without a strong API key; development remains local-friendly', async () => {
  assert.equal(companyServerAuth('', false), undefined);
  assert.throws(() => companyServerAuth('', true), /required/);
  assert.throws(() => companyServerAuth('weak', true), /high-entropy/);
  const token = randomBytes(48).toString('base64url');
  const auth = companyServerAuth(token, true)!;
  const request = new Request('https://company.example/api/agents');
  assert.equal(await auth.authenticateToken('wrong', request), null);
  const user = await auth.authenticateToken(token, request);
  assert.equal(user?.id, 'ascendxi-operator');
});
