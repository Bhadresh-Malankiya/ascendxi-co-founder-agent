import { knowledgeStore } from './knowledge-store';
import { taskStore } from './task-store';
const founderSource = [
  {
    kind: 'founder' as const,
    reference: 'Founder requests in this company setup chat, October 16, 2026',
  },
];
const seeds = [
  {
    slug: 'client-lifecycle-mandate',
    title: 'Client acquisition and delivery mandate',
    product: 'AscendXI' as const,
    content:
      'The founder requested an end-to-end company process covering evidence-backed lead research, truthful outreach, client conversations, meeting coordination, scope overviews, resource-based estimates, proposals, delivery, updates and support. Single-responsibility roles include product managers, project/delivery managers, developers, AI agent specialists and UI/UX designers. No customer profile, target market, approved offer, rates, staffing capacity or client delivery targets have yet been established.',
  },
  {
    slug: 'company-mission',
    title: 'AscendXI mission and founder mandate',
    product: 'AscendXI' as const,
    content:
      'The founder is building AscendXI as a company focused on AI agents. The operating system should coordinate multiple departments, preserve durable work and keep the founder informed with evidence. Routine authorized work should continue while the founder is absent. This describes founder intent; it is not evidence of revenue, customers, legal status or continuous uptime.',
  },
  {
    slug: 'portfolio-scope',
    title: 'Portfolio names and knowledge gaps',
    product: 'AscendXI' as const,
    content:
      'The founder named AscendXI, VocalXI, HelpXI and JewelXI as the company portfolio. Product features, positioning, maturity, pricing, customers and financial metrics must be verified from authoritative records. Until those records are added, product-specific claims remain unknown. Names alone do not establish capabilities.',
  },
  {
    slug: 'operating-goals',
    title: 'Company operating goals',
    product: 'AscendXI' as const,
    content:
      'Founder goals: build an extensible company of AI agents; coordinate departments through orchestrators; retain task ownership and progress across restarts; maintain an updated knowledge base with sources; show work visually; verify functionality end to end. More specific business targets, budgets, deadlines and growth metrics have not been supplied.',
  },
];
let seeded: Promise<void> | undefined;
export function ensureCompanyRecords() {
  return (seeded ??= seed().catch((error) => {
    seeded = undefined;
    throw error;
  }));
}
async function seed() {
  const knowledge = knowledgeStore();
  // Serialize each document with optimistic versions; never overwrite a founder's later edit.
  for (const record of seeds) {
    try {
      await knowledge.get(record.slug);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'Knowledge record not found') throw error;
      try {
        await knowledge.put({ ...record, sources: founderSource, expectedVersion: 0 }, 'verified');
      } catch (conflict) {
        if (!(conflict instanceof Error) || !conflict.message.includes('version conflict'))
          throw conflict;
      }
    }
  }
  const goals = [
    {
      key: 'client-lifecycle',
      title: 'Coordinate the full client lifecycle',
      outcome:
        'Move sourced opportunities through qualification, discovery, scope, resource-based estimates, proposals, delivery, QA, handoff and support with explicit evidence and ownership.',
      department: 'sales',
      acceptance: [
        'Every lead cites a real business source',
        'External communications and meetings use verified provider results',
        'Estimates depend on sourced capacity and rates',
        'Deliverables pass independent quality review',
      ],
    },
    {
      key: 'agent-led-company',
      title: 'Build the agent-led company',
      outcome:
        'Coordinate departments through a co-founder and orchestrators with durable task ownership and verified handoffs.',
      department: 'operations',
      acceptance: [
        'All required departments are registered',
        'Tasks retain owner and review status',
        'Consequential actions require approval',
      ],
    },
    {
      key: 'accurate-company-knowledge',
      title: 'Maintain a trustworthy company knowledge base',
      outcome:
        'Keep company and portfolio knowledge searchable, sourced, versioned and visibly marked for review.',
      department: 'product',
      acceptance: [
        'Company records cite sources',
        'Drafts are distinct from verified knowledge',
        'Revision history and review dates are visible',
      ],
    },
    {
      key: 'visible-reliable-operations',
      title: 'Make operations visible and reliable',
      outcome:
        'Provide a live visual workboard, goal links, permission boundaries and recovery evidence.',
      department: 'engineering',
      acceptance: [
        'The dashboard reflects persisted records',
        'Goal progress uses actual linked tasks',
        'Tests and deployment checks are reported honestly',
      ],
    },
  ];
  for (const goal of goals) await knowledge.createGoal({ ...goal, product: 'AscendXI' }, true);
  // Tasks describe work still needed; none are auto-marked complete from a generated report.
  await taskStore().create({
    key: 'company-kb-source-discovery-v1',
    title: 'Identify authoritative product knowledge sources',
    objective:
      'Identify existing authoritative records for VocalXI, HelpXI and JewelXI, record source references and mark missing product details as unknown. Prepare a reviewable source inventory; do not invent features or metrics.',
    product: 'AscendXI',
    department: 'product',
    goal_key: 'accurate-company-knowledge',
    specialist: 'product-manager',
    acceptance: [
      'List each named product',
      'Separate verified source references from missing evidence',
      'Recommend a concrete next step for each knowledge gap',
    ],
  });
}
