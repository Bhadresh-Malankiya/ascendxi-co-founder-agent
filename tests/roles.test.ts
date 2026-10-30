import test from 'node:test';
import assert from 'node:assert/strict';
import {roleCatalog} from '../src/mastra/company/catalog';
import {team,ownerFor,capabilityFor,pausedCapabilities} from '../src/mastra/company/team';
test('specialist capabilities have one lean owner; pausing an owner also pauses retired routing IDs',()=>{
  assert.equal(Object.keys(team).length,7);
  for(const id of Object.keys(roleCatalog)){assert.ok(team[ownerFor(id)]);assert.ok(capabilityFor(id).length>10);}
  assert.equal(ownerFor('backend-developer'),'engineering');
  assert.equal(ownerFor('knowledge-curator'),'growth');
  assert.equal(ownerFor('security'),'quality');
  assert.ok(pausedCapabilities(['engineering']).includes('ai-agent-specialist'));
  assert.ok(!pausedCapabilities(['growth']).includes('backend-developer'));
  assert.throws(()=>ownerFor('unapproved-agent'));
});
