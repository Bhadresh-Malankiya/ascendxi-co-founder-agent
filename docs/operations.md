# Development, deployment and operations

## Development and deployment

Use `npm run dev` / `npm run build` as required by AGENTS.md. Stop the development server before building; both use `.mastra/output`. The lockfile records the verified dependency resolution; install with `npm ci`. Node 22.13+ and Postgres 14+ are required. Production also requires ASCENDXI_API_TOKEN to protect the direct server API. Production needs network access to Postgres, the model service and configured integration services.

The existing Mastra Platform project is linked to this repository. The implementation has been deployed directly through the CLI to the existing production project; GitHub has not been pushed. See the release verification record for the final deployed checks. After reviewing and explicitly authorizing a push, use the project's normal deployment flow. Alternatively, build with `npm run build` and deploy `.mastra/output` using the supported Mastra host flow. The built entry point is `node .mastra/output/index.mjs`; the source project's `npm start` remains available. Configure secrets through the host secret manager. Set `MASTRA_SERVER_URL` to the public HTTPS origin for channel callbacks on non-platform hosting.

Keep Studio and direct APIs behind authentication. Use a separate least-privileged runtime and database per environment. Back up Postgres before upgrades. Workspace/editor files need persistent storage or versioning; source-mode editor changes are files under `./mastra/editor`. Do not let an ephemeral container be their only copy.

Task tables are initialized lazily on first use (the `ascendxi_tasks`, knowledge/revision/goal, opportunity/resource/estimate and service-check tables in the database user's search path); the runtime needs CREATE TABLE privileges on that schema on first boot. Provision the schema in a controlled first deployment and restrict DB privileges thereafter. The Mastra PostgresStore separately manages its framework storage. Do not delete existing Mastra tables when installing the company task module. First-time schema setup is serialized across replicas with a Postgres transaction advisory lock.

## Operating cycle

From a persistent Studio thread, ask the co-founder to inspect company status, find high-impact work, create scoped tasks, run queued artifact assignments, inspect quality findings and surface only meaningful decisions. Complete tasks only after checking acceptance evidence. New external actions are performed through interactive approved tools, and their observed results should be included in the task evidence.

To automate this cadence, approve a schedule with the existing start_schedule tool. For example: hourly during business hours, inspect company status, run at most one queued assignment, report only material changes/blockers, and do not bypass approvals. Inspect the proposed cron and scope before approving. No platform schedule is installed automatically. The optional local LaunchAgent instead installs an always-running worker; see [local service](local-service.md). An idle/on-demand deployment is not a promise of continuous execution: verify scheduler wakeup behavior on your hosting plan before relying on it; otherwise run an authenticated external scheduler/always-on worker. Set provider budgets and rate limits separately—maxSteps is not a financial cap.

## Failure and recovery

- `queued`: ready for exactly one atomic claim.
- `running`: a worker owns the current attempt. Duplicate claims fail. Each model call in the assignment workflow has a 120-second timeout and bounded steps.
- `review`: specialist and quality reports are saved; founder acceptance remains required.
- `blocked`: quality rejected/missing evidence, inputs unavailable, or a provider call failed. Review the report and protected traces, fix the cause, then approve retry.
- `completed`: accepted review. Cannot be reclaimed or silently reopened.

Durable snapshots and reports persist in Postgres, but an in-flight model call is not guaranteed to resume after process termination. If a task is stranded running, first confirm its worker has stopped; approve recover_company_task with a reason to move it to blocked, then approve retry after review. Attempt fencing prevents stale completion from overwriting a newer attempt. Replay of a task already in review/blocked returns its state without another model call. Completed tasks reject rerun.

The advisory workflow performs no external side effects; for future execution workflows, inspect provider state and idempotency records before retrying. Never assume exactly-once external delivery from workflow storage alone.

## Monitoring

The existing Pino logger and Mastra traces/storage exporter remain. Platform export activates only when Connect environment is configured. Service name is `ascendxi-company-os`; task logs use `company.task.started`, `.finished` and `.failed` with task ID and state. Inspect traces for model usage, latency and errors. Restrict access and retention; traces can include company data. Startup welcome is deterministic and does not make a hidden model call.

Check database availability, task backlog, age of running tasks, blocked count, provider failures, usage/spend and actual schedule executions. No external alerting service or billing cap is automatically provisioned. Add alerts through your host once thresholds and recipients are approved.

## Dependency review

The first resolved starter dependency tree reported 23 npm audit findings (17 moderate, 6 high) on October 16, 2026. The root advisories were `braces <=3.0.3` (stack exhaustion) and `sprintf-js <=1.1.3` (unbounded precision denial of service), propagated through Mastra dependencies. The latest registry versions checked were still 3.0.3 and 1.1.3; npm's proposed major downgrades are not a safe compatible fix. No forced downgrade was applied. Recheck `npm audit` before production deployment and track upstream fixes; do not describe the dependency tree as vulnerability-free.

## Knowledge and client records

Back up all `ascendxi_*` tables together with Mastra storage. Knowledge revisions and estimate snapshots are immutable records; the Events view reads an append-only company event journal with earlier-event pagination. This records company operations and visible outputs, not every internal model thought or upstream provider event. Task reports preserve the latest attempt; use protected workflow traces for prior runs.

Founder intent and four company goals seed on first company/knowledge access. Existing revisions are never overwritten. Source discovery can be recorded as knowledge drafts; repository documentation is evidence of documented behavior, not a live production verification. Do not copy credentials or private customer data into source archives.

The client workflow assigns one owner for each current stage. Creating a handoff is idempotent and does not change the pipeline. Before outreach, establish the approved customer profile, actual offer, sender, contact evidence and permitted channel. Before estimating, record current resource capacity and cost evidence. Before scheduling, check actual availability and timezones. Confirm provider receipts after sending or booking.
