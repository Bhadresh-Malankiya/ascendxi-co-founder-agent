/** Founder-controlled runtime policy. Zero disables throttling; it never widens tool access. */
export function hourlyJobLimit(value = process.env.ASCENDXI_MAX_RUNS_PER_HOUR): number | null {
  if (value === undefined || value.trim() === '') return 4;
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 0) throw Error('ASCENDXI_MAX_RUNS_PER_HOUR must be a nonnegative integer; 0 means continuous');
  return limit === 0 ? null : limit;
}
export function internalAutonomyEnabled() {
  return process.env.ASCENDXI_AUTONOMY === 'internal';
}
export function currentOperatingPolicy() {
  return {
    hourlyJobLimit: hourlyJobLimit(),
    routineInternalApprovals: internalAutonomyEnabled(),
    concurrentAssignments: 1,
    executionMode: 'internal-artifacts-and-independent-review',
    connectorReads: 'Only current portal-approved exact reads for the bound task and its owner may execute. Tool discovery alone grants no access. Read receipts never imply task acceptance or product deployment.',
    authority: 'Current server policy supersedes historical plan/report throughput notes. A null hourlyJobLimit means no hourly job cap. It does not authorize purchases, new access or product deployment.',
  };
}
export function routinePlanEligible(plan: {kind:string;toolIds:string[];budget:{monthlyCap:number|null}}) {
  return internalAutonomyEnabled() && ['goal','project'].includes(plan.kind) && plan.toolIds.length === 0 && (plan.budget.monthlyCap === null || plan.budget.monthlyCap === 0);
}
