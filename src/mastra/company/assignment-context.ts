/** Keep prior reports and unrelated milestones out of each repeated model request. */
export function compactReport(report: any) {
  if (!report) return null;
  return {deliverable:String(report.report?.deliverable ?? '').slice(0,3000),
    evidence:(report.report?.evidence??[]).slice(0,8),blockers:report.report?.blockers??[],
    nextAction:report.report?.nextAction,review:report.review?{accepted:report.review.accepted,evidenceGaps:report.review.evidenceGaps}:undefined,error:report.error,humanDecision:report.humanDecision?.slice(0,4000)};
}
export function compactTask(task:any) {return {...task,report:compactReport(task.report)};}
export function compactProject(project:any) {
  if (!project) return null;
  return {id:project.id,name:project.name,kind:project.kind,product:project.product,brief:project.brief,ready:project.ready,paused:project.paused,
    steps:project.steps?.map((s:any)=>({key:s.key,title:s.title,status:s.status,after:s.after}))};
}
export function compactPlan(plan:any) {
  if (!plan) return null;
  const p=plan.scope;
  return {key:plan.key,version:plan.version,status:plan.status,
    scope:{title:p.title,outcome:p.outcome,scope:p.scope,exclusions:p.exclusions,acceptance:p.acceptance,evidence:p.evidence,budget:p.budget},
    prerequisites:plan.prerequisites?.map((t:any)=>({id:t.id,title:t.title,status:t.status,report:compactReport(t.report)}))};
}
