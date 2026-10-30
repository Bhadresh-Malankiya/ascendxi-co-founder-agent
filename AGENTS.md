# AGENTS.md

## CRITICAL: Load `mastra` skill first

Load the `mastra` skill BEFORE any Mastra work when installed. If unavailable, use the official Mastra documentation and the installed package types/source as the API source of truth, as authorized by the founder. Never rely on cached knowledge — APIs change between versions.

## Rules

- Register all agents, tools, workflows, and scorers in `src/mastra/index.ts`
- Use the `dev` and `build` scripts from `package.json` instead of running `mastra dev` / `mastra build` directly
- `DATABASE_URL` (Postgres) is required to boot; platform env (`MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_PROJECT_ID`) is optional and unlocks Connect tools and channels

## Resources

- [Mastra Documentation](https://mastra.ai/llms.txt)

## Company operating system

- Keep the existing `agent` ID stable; department definitions live in `src/mastra/company/catalog.ts`.
- All Connect tools must pass through `company/connections.ts` and `company/policy.ts`; unknown tools require approval.
- Never bypass approval through schedules, delegation, workspace commands or direct tool execution.
- The company-task workflow creates reviewed artifacts with external tools disabled; keep this boundary unless adding a separately verified execution/approval workflow.
- Run `npm run typecheck`, `npm test`, `npm run test:integration` with a dedicated TEST_DATABASE_URL, and `npm run build`. Stop dev before building: both use `.mastra/output`.

- Founder-authorized internal autonomy may automatically approve goal/internal-project artifact plans, with audited policy decisions. It never grants new access, buys services, approves client project scope or deploys. Zero hourly limit means continuous processing, not unlimited concurrent model jobs.
- Fixed public VocalXI GET probes in `company/public-readiness.ts` are a separate deterministic evidence stage. Do not mistake HTTP status/title observations for authenticated/browser/voice/payment acceptance.

- UI-configured MCP/Connect reads use `connector-store.ts`: encrypted configuration, explicit task/owner/tool/schema/argument grants and actual response receipts. Never expose arbitrary discovered tools to agents or use connection discovery as proof of task capability. Independent reviewers consume attached evidence; they do not inherit the producer's connection grant.
