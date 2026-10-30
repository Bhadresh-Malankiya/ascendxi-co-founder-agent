import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEstimate, type Resource } from '../src/mastra/company/client-store';
const resource = (key: string, hours: number, rate: number): Resource => ({
  key,
  name: key,
  capabilities: ['delivery'],
  availableHoursPerWeek: hours,
  ratePerHour: rate,
  currency: 'USD',
  source: 'Verified staffing record',
  expectedVersion: 1,
  version: 1,
  verified: true,
  updated_at: new Date().toISOString(),
});
test('estimates aggregate per resource, calculate bottlenecks and keep explicit assumptions', () => {
  const result = calculateEstimate(
    {
      opportunityKey: 'client-one',
      items: [
        { resourceKey: 'dev', scope: 'Build approved API', lowHours: 10, highHours: 20 },
        { resourceKey: 'dev', scope: 'Write service tests', lowHours: 5, highHours: 10 },
        { resourceKey: 'design', scope: 'Prepare visual system', lowHours: 10, highHours: 20 },
      ],
    },
    [resource('dev', 10, 50), resource('design', 20, 100)],
  );
  assert.equal(result.status, 'draft');
  assert.deepEqual(result.effortHours, { low: 25, high: 50 });
  assert.deepEqual(result.cost, { low: 1750, high: 3500, currency: 'USD' });
  assert.deepEqual(result.durationWeeks, { low: 1.5, high: 3 });
  assert.ok(result.assumptions.length);
});
test('missing, unverified, stale and mixed-currency resources block a delivery estimate', () => {
  const input = {
    opportunityKey: 'client-one',
    items: [{ resourceKey: 'dev', scope: 'Build approved API', lowHours: 10, highHours: 20 }],
  };
  assert.equal(calculateEstimate(input, []).cost, null);
  assert.equal(
    calculateEstimate(input, [{ ...resource('dev', 10, 50), verified: false }]).status,
    'blocked',
  );
  assert.equal(
    calculateEstimate(input, [{ ...resource('dev', 10, 50), updated_at: '2020-01-01T00:00:00Z' }])
      .durationWeeks,
    null,
  );
  assert.throws(() =>
    calculateEstimate({ ...input, items: [{ ...input.items[0]!, lowHours: 30 }] }, []),
  );
  const mixed = calculateEstimate(
    {
      ...input,
      items: [
        ...input.items,
        { resourceKey: 'design', scope: 'Design client workflow', lowHours: 1, highHours: 2 },
      ],
    },
    [resource('dev', 10, 50), { ...resource('design', 10, 50), currency: 'INR' }],
  );
  assert.equal(mixed.status, 'blocked');
  assert.equal(mixed.cost, null);
});
