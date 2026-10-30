# AscendXI AI Co-Founder

A Mastra company operating system for AscendXI and its named portfolio: VocalXI, HelpXI and JewelXI. The existing `agent` identity, Postgres storage, Connect, Studio editor, workspace, schedules and digest are preserved.

The system runs **seven accountable owners**: Co-Founder, Product & Delivery, Engineering, Design, Growth & Customer, Quality & Security, and Operations Monitor. Seventeen specialist mandates are on-demand capability profiles. New products and clients reuse the shared team. Durable plans support founder-delegated automatic approval of internal work with `ASCENDXI_AUTONOMY=internal`; consequential external actions retain separate approval gates. Product facts, customers and metrics must come from verified records.

## Start locally

Requires Node **22.13+**, npm, Postgres **14+**, and a valid model credential for live generation.

```sh
npm ci
cp .env.example .env
# Set DATABASE_URL and MASTRA_GATEWAY_API_KEY in .env.
npm run dev
```

Open http://localhost:4111/company/dashboard for the visual company desk, or http://localhost:4111 for Mastra Studio. Choose **AscendXI AI Co-Founder** in Studio. Initial welcome uses no paid model call. Postgres is required at boot; missing model credentials only become relevant when generating or using model-powered search. The company desk and persisted records work without a model key.

Routine roles use `mastra/openai/gpt-6-luna`; the co-founder and complex technical/review capabilities use `mastra/openai/gpt-6-sol`. The per-agent inspector allows either verified profile on the next run. Both profiles passed bounded live tool-call probes through the installed Gateway transport. These are connectivity checks, not quality benchmarks. Worker assignments and direct chat share the configured job policy. The founder-selected local configuration uses zero for no hourly cap; an unset value defaults to four.

## Continuous local operation

The macOS installer runs a local server and one persistent worker at login, restarts crashes, and keeps real company data in local Postgres. The desk includes saved agent conversations, an event journal, dependency-gated projects, project source snapshots and an exact-content approval outbox. See [local installation, operation and limits](docs/local-service.md).

## Live operations and learning

The default desk streams agent state, visible output, notifications, task plans and approval changes without refreshing. Inspect cards for tools, model choice, pause controls, observed token counts and evidence-based provisional maturity. Connections view maps the registered ownership graph. No hidden reasoning is shown and idle health checks do not call a model.

Learning proposals retain their source. Knowledge approval creates a KB draft for separate fact review; typed response preferences can be applied once, or future operator formatting feedback can be enabled per agent and revoked. Generic access proposals require separate setup and verification; exact approved Discord identity/channel consent enables read-only agent discussions only. Discord mirrors actual work into three configured company channels and project threads, with persisted send receipts and incoming-message notices. See [live operations](docs/live-operations.md) for boundaries and recovery.

## Agents and ownership

| Agent ID | Responsibility |
| --- | --- |
| `operations-monitor` | Inspect persisted health, stalled work and approval needs; deterministic checks run independently of AI |
| `agent` | Founder interface, company priorities, durable commitments, approvals and final synthesis |
| `product` | Product strategy, service delivery, milestones, resources and handoffs |
| `engineering` | Full-stack, AI systems, infrastructure and technical evidence |
| `ui-designer` | UI/UX, research, accessibility and usability |
| `growth` | Marketing, sourced leads, client conversations and support drafts |
| `quality` | Independent quality, security, privacy and release review |

The five team agents have project-bound artifact and knowledge reads but no integration tools by default. An operator can grant **exact tool IDs per department** using `ASCENDXI_DEPARTMENT_TOOLS`; Design uses its exact `ui-designer` entry in `ASCENDXI_ROLE_TOOLS`; retired role grants are not inherited by consolidated owners. The co-founder discovers the project's integrations dynamically. All integration tools require approval unless an operator has explicitly classified an exact tool ID as a safe read; upstream approval restrictions are retained. See [integration configuration](docs/integrations.md).

## Company desk, knowledge and client operations

The responsive company desk shows actual persisted goals, work, organization, knowledge revisions, client stages, resource assumptions, estimates and read-only service checks. Its public shell contains no company data; remote company APIs require production authentication. Explicit local mode instead trusts the Mac user through guarded loopback-only desk routes; native Mastra APIs remain authenticated. Direct access uses the private operator key for that visit only, without browser storage or URL tokens. See [the visual guide](docs/company-desk.md).

Founder-supplied mission, portfolio names and goals are seeded once with provenance. Knowledge updates are sourced drafts; exact-revision publishing requires review. Published knowledge remains available to agents while a replacement is drafted. Every revision is retained, with a 30-day review reminder. The workflow includes verified knowledge and relevant client/estimate context in both specialist and independent quality review.

Client stages run from research → qualification → discovery → scope → estimate → proposal → won → delivery → quality → handoff → support. `client_stage_assignment` creates/reuses one current-stage specialist assignment linked to that client and the client-lifecycle goal. It does not advance stages or send messages. Approval-gated transitions retain evidence and reject stale changes. External work still uses approved Connect actions with provider receipts.

Resource estimates aggregate scoped effort by resource, calculate parallel capacity bottlenecks and cost ranges, and save immutable input snapshots. Unknown, proposed, stale or mixed-currency inputs block a result. No resource reservation, sales price, dependency-based schedule or delivery commitment is inferred.

Capability profiles preserve Product Manager, Project Manager, AI Agent Specialist, Backend/Frontend Developer, UX Researcher, UI Designer, QA, DevOps, Lead Researcher, Outreach Writer, Account Executive, Meeting Coordinator, Delivery Manager, Estimator, Resource Planner and Knowledge Curator. The workflow routes each to one existing owner. Engineering/design workspace writes remain approval-gated; customer support receives no engineering workspace or Git grants.

## Plans, blockers and decisions

Plans centralizes versioned scope, product, priority, acceptance, sources, milestones, dates, dependencies and budget assumptions. Discuss a proposal with the co-founder, revise it and approve its exact revision. New goals stay proposed; new project assignments stay ineligible until this approval. Changed scopes pause new work pending reapproval. Approval only starts internal artifact work; it cannot authorize spending, access, client communications or deployment. Quality never reviews its own output.

Blocker inspectors expose cause, owner, next action, evidence attachment, bounded safe reassessment and typed access/budget/service requests. The monitor can retry an evidence-only artifact after new proof, at most twice/day per task. It never retries uncertain external writes. See [plans, approvals, lean ownership and Discord discussions](docs/plans-and-blockers.md).

## Assignment lifecycle

1. Review `company_plans` and obtain founder approval for new scope first. Ask the co-founder to inspect `company_status` and create a task under an active approved goal with a stable idempotency key, portfolio product, department, objective and acceptance criteria.
2. `run_company_task` starts the registered `companyTaskWorkflow`. Its atomic Postgres claim prevents two workers from owning the same queued task.
3. The assigned owner prepares an artifact; `quality` independently checks it. Quality-owned work is reviewed by the co-founder. **External tools are disabled in this artifact workflow**, even if a department has interactive integration grants.
4. The report and review persist as `review` or `blocked`. A failed provider call becomes a blocker rather than a successful result.
5. `decide_company_task` requires human approval to complete a reviewed task or retry a blocked/review task. A project charter can separately authorize automatic acceptance of quality-passed internal artifacts with no blockers or evidence gaps. A task report does not prove that a deployment, payment or communication happened.

Interactive conversations with the co-founder or a department can execute their available tools after the required action approval. Native authenticated conversations are one execution path for approved tools; the local outbox is the typed, durable path for approved email/calendar writes. Direct desk chat uses internal tools only; the assignment workflow generates and reviews deliverables. Inspect tool results before accepting the task. There are no fake connectors, automatic payments or claimed autonomous deployments.

Example Studio request:

> Create an AscendXI engineering assignment with key `ascendxi-onboarding-spec-v1`: prepare an agent onboarding specification. Acceptance: include required integrations, permission boundaries, failure recovery and test criteria. Run it and show the quality review. Do not mark it complete yet.

## Verification

```sh
npm run typecheck
npm test
# Use a dedicated disposable database; integration tests create tables and sample task records.
TEST_DATABASE_URL=postgres://localhost:5432/ascendxi_test npm run test:integration
npm run build
```

The Postgres integration suite exercises immutable knowledge revisions, client handoffs, stage/resource version checks, estimate snapshots, approval-aware service monitoring, atomic claims, idempotency conflicts, stale-worker fencing, restart persistence, recovery, actual Mastra workflow routing, accepted/rejected reviews, replay behavior and provider failure handling, 11-step project dependency routing, internal charters, artifact revisions, atomic shared AI limits, exact-content communication approval, duplicate-send prevention and reply capture. Workflow tests use deterministic model doubles and do not contact live model or integration services. Without `TEST_DATABASE_URL` integration tests explicitly skip.

See [production verification](docs/release-verification.md), [operations and deployment](docs/operations.md), [permissions](docs/permissions.md), and [extension guide](docs/extending.md).

## Continuous internal autonomy

The founder-selected local configuration uses `ASCENDXI_AUTONOMY=internal` and `ASCENDXI_MAX_RUNS_PER_HOUR=0`. Zero removes the hourly job cap; positive values retain optional throttling. One durable worker processes real eligible work promptly and polls without model calls when idle. This uses existing model credits and does not authorize purchases or new services.

Routine goal plans and internal-project plans without requested tools or a positive monetary cap are approved by a recorded `founder-autonomy-policy` decision. Independent review and dependency gates remain required. Access/service/budget/deployment plans and client project scope retain exact founder decisions. Existing denied/revoked plans are never autoapproved. Set autonomy back to `manual` and a positive hourly limit to revoke this operating policy.

The VocalXI current-evidence/pilot-check milestones additionally execute fixed public GET probes for the homepage, pricing and login. Results retain time, HTTP status and content hash; they do not establish authenticated API/database, browser JavaScript, voice, email or payment correctness. Other assignment work remains reviewed artifact preparation. No repository implementation or deployment is implied.

The installer uses `caffeinate -is` to prevent idle system sleep while running, including on battery. Display sleep is allowed. Manual/lid sleep, shutdown, logout, offline services and exhausted credits can still stop work.

Add connections from **Company → Connections & access → Add connection**. [Connector setup and task handoff](docs/connectors-and-task-access.md) covers HTTP MCP, Mastra Connect, encrypted credentials, task-scoped reads and automatic reassessment.
