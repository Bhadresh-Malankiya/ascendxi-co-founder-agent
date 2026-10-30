import { ownerFor } from './team';

export function blockerDetails(t: any) {
  const causes = [...(t.report?.report?.blockers ?? []), ...(t.report?.review?.evidenceGaps ?? []), ...(t.report?.error ? [t.report.error] : []), ...(t.report?.recovery ? [t.report.recovery] : [])];
  const text = causes.join(' ').toLowerCase();
  const kind = /(?:missing|expired|denied|unavailable|needs?|requires?).{0,35}(?:credential|permission|oauth|access token)|(?:credential|oauth|access token).{0,25}(?:missing|expired|denied|invalid)/.test(text) ? 'access' : /(?:budget|billing|payment|credit).{0,25}(?:unapproved|exhausted|insufficient|overdue|declined)|(?:need|missing).{0,20}(?:budget approval|payment method)/.test(text) ? 'budget' : t.report?.error || /(?:provider|gateway|model|network|configuration).{0,30}(?:failed|unavailable|timeout|invalid)|(?:provider|configuration) failure/.test(text) ? 'provider' : 'evidence';
  return { taskId:t.id, owner:ownerFor(t.specialist || t.department), capability:t.specialist || t.department, status:t.status,
    kind, causes, nextAction:t.report?.report?.nextAction || (kind === 'evidence' ? 'Attach the missing source or test evidence, then request an independent reassessment.' : 'Inspect the failed run and request the exact configuration or permission needed.'),
    approvalRequired:kind === 'access' || kind === 'budget',
    controls:[{action:'inspect',label:'Inspect report & evidence'}, {action:'remediate',label:'Check new evidence & retry safely'}, {action:'proposal',label:kind === 'access' ? 'Request scoped access' : kind === 'budget' ? 'Propose budget' : 'Request founder decision'}] };
}
