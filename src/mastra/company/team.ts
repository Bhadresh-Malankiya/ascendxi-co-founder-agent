import { roleCatalog } from './catalog';

/** Stable runtime owners. Specialist roles are task capabilities, not extra employees. */
export const team = {
  agent: { name: 'Co-Founder', department: 'executive', scope: 'Company strategy, budgets, priorities and founder decisions.' },
  product: { name: 'Product & Delivery', department: 'product', scope: 'Product discovery, service delivery, scope, estimates, milestones, dependencies and handoffs.' },
  engineering: { name: 'Engineering', department: 'engineering', scope: 'Full-stack implementation, AI systems, infrastructure and technical evidence within approved scope.' },
  'ui-designer': { name: 'Design', department: 'product', scope: 'User research, journeys, accessible UI/UX, design specifications and usability checks.' },
  growth: { name: 'Growth & Customer', department: 'growth', scope: 'Sourced lead research, positioning, outreach drafts, client conversations, onboarding and support. No engineering access.' },
  quality: { name: 'Quality & Security', department: 'quality', scope: 'Independent acceptance review, regression evidence, access, privacy, reliability and release risks.' },
  'operations-monitor': { name: 'Operations Monitor', department: 'operations', scope: 'Deterministic health checks, bounded recovery and actionable escalations; no idle model loop.' },
} as const;
export type TeamId = keyof typeof team;
const owners: Record<string, TeamId> = {
  delivery: 'product', commercial: 'growth', operations: 'product', sales: 'growth', customer: 'growth', finance: 'agent', security: 'quality',
  'product-manager': 'product', 'project-manager': 'product', estimator: 'product', 'resource-planner': 'product', 'delivery-manager': 'product',
  'ai-agent-specialist': 'engineering', 'backend-developer': 'engineering', 'frontend-developer': 'engineering', 'devops-engineer': 'engineering',
  'ux-researcher': 'ui-designer', 'lead-researcher': 'growth', 'outreach-writer': 'growth', 'account-executive': 'growth', 'meeting-coordinator': 'growth', 'knowledge-curator': 'growth', 'qa-engineer': 'quality',
};
export function ownerFor(id: string): TeamId {
  if (id in team) return id as TeamId;
  const owner = owners[id];
  if (!owner) throw Error('No approved team owner for capability: ' + id);
  return owner;
}
export function capabilityFor(id: string) {
  return roleCatalog[id as keyof typeof roleCatalog]?.mandate ?? team[ownerFor(id)].scope;
}
export function pausedCapabilities(ids: string[]) {
  return [...new Set([...ids, ...Object.keys(owners).filter(id => ids.includes(ownerFor(id)))])];
}
