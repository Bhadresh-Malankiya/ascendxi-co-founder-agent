import test from 'node:test';
import assert from 'node:assert/strict';
import {hourlyJobLimit,routinePlanEligible,currentOperatingPolicy} from '../src/mastra/company/autonomy';
import {compactPlan,compactProject,compactTask} from '../src/mastra/company/assignment-context';
import {publicReadiness} from '../src/mastra/company/public-readiness';

test('continuous policy removes hourly throttling without accepting malformed limits',()=>{
  assert.equal(hourlyJobLimit('0'),null);assert.equal(hourlyJobLimit('4'),4);assert.equal(hourlyJobLimit('100'),100);
  for(const value of ['-1','NaN','1.5','infinity'])assert.throws(()=>hourlyJobLimit(value));
});
test('model context receives the current operating policy rather than stale four-job assumptions',()=>{
  const prior=process.env.ASCENDXI_MAX_RUNS_PER_HOUR;
  try{process.env.ASCENDXI_MAX_RUNS_PER_HOUR='0';const policy=currentOperatingPolicy();
    assert.equal(policy.hourlyJobLimit,null);assert.equal(policy.concurrentAssignments,1);
    assert.match(policy.authority,/supersedes historical/);assert.match(policy.authority,/does not authorize/);
  }finally{if(prior===undefined)delete process.env.ASCENDXI_MAX_RUNS_PER_HOUR;else process.env.ASCENDXI_MAX_RUNS_PER_HOUR=prior;}
});
test('routine autonomy never approves new access, services, billing or deployment',()=>{
  const prior=process.env.ASCENDXI_AUTONOMY;
  try{process.env.ASCENDXI_AUTONOMY='manual';assert.equal(routinePlanEligible({kind:'goal',toolIds:[],budget:{monthlyCap:null}}),false);
    process.env.ASCENDXI_AUTONOMY='internal';
    for(const kind of ['goal','project'])assert.equal(routinePlanEligible({kind,toolIds:[],budget:{monthlyCap:null}}),true);
    for(const kind of ['access','service','budget','deployment'])assert.equal(routinePlanEligible({kind,toolIds:[],budget:{monthlyCap:null}}),false);
    assert.equal(routinePlanEligible({kind:'goal',toolIds:['external.read'],budget:{monthlyCap:null}}),false);
    assert.equal(routinePlanEligible({kind:'goal',toolIds:[],budget:{monthlyCap:1}}),false);
  }finally{if(prior===undefined)delete process.env.ASCENDXI_AUTONOMY;else process.env.ASCENDXI_AUTONOMY=prior;}
});
test('assignment context removes recursive historical reports while retaining review evidence',()=>{
  const report={report:{deliverable:'x'.repeat(50000),evidence:['proof'],blockers:[],nextAction:'review'},review:{accepted:true,evidenceGaps:[],findings:['x'.repeat(50000)]}};
  const task=compactTask({title:'current',report});assert.ok(JSON.stringify(task).length<4000);assert.equal(task.report.review.accepted,true);
  const project=compactProject({id:'p',steps:[{key:'a',status:'completed',report}]});assert.ok(JSON.stringify(project).length<300);
  const plan=compactPlan({key:'g',scope:{title:'goal',acceptance:['check']},prerequisites:[{id:'t',status:'completed',report}]});assert.equal(plan!.prerequisites[0].report.evidence[0],'proof');
});
test('public readiness executes only fixed approved-goal GET probes and qualifies results',async()=>{
  const calls:string[]=[];const request=(async(input:any,options:any)=>{calls.push(String(input));assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,undefined);return new Response('<title>Controlled fixture</title>');})as typeof fetch;
  assert.equal(await publicReadiness({product:'VocalXI',key:'arbitrary'},request),null);assert.equal(calls.length,0);
  const result=await publicReadiness({product:'VocalXI',key:'plan:vocalxi-bounded-pilot-readiness:2:current-evidence'},request);
  assert.equal(calls.length,3);assert.ok(calls.every(url=>new URL(url).hostname==='vocalxi.com'));assert.equal(result!.checks[0].status,200);assert.match(result!.limitations[0],/not tested/);
});
