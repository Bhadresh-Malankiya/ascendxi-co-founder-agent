# Permission boundaries

This is a **single-company, trusted-operator** system. It does not implement public signup, tenant isolation or a separate identity service. Production requires a strong ASCENDXI_API_TOKEN and protects direct API routes using Mastra SimpleAuth. The platform keeps its independent organization login for Studio. Local development can omit the API key; production fails closed if it is absent. Anyone who controls its server, database, environment, editor or direct tool APIs is trusted; a model-level approval flag does not secure an exposed HTTP endpoint.

| Capability | Default boundary |
| --- | --- |
| Prepare internal reports and task assignments | Autonomous, bounded by model steps and timeouts |
| Discover Connect tools | Availability only; not proof of service access |
| External tool call | Requires approval; exact operator-reviewed reads may be exempt |
| Department access | No external tools until exact operator grants |
| Assignment workflow | No external tools, even if an interactive specialist has grants |
| New goal/project/scope | Exact-revision founder approval before execution |
| Accept internal work | Human approval, or clean independent review under an exact founder-approved artifact plan |
| Retry / recover | Human decision, or bounded new-evidence artifact-only recovery |
| Workspace writes, edits, AST edits, mkdir, deletion | Approval required |
| Shell execution / process termination | Approval required |
| Start or stop recurring schedules | Approval required |
| Contracts, money, access changes, public content, deployments | Approve the specific tool action and arguments |

`autoResumeSuspendedTools` is disabled. Do not enable it to avoid unattended approval. Approval is not a credential, audit signature or blanket authority. Native Mastra approval flow must display the actual action arguments. Direct programmatic calls to a tool's execute function bypass the agent's approval machinery and must remain server-internal.

Retrieved content is untrusted. System instructions explicitly reject policy changes embedded in tools, pages and messages. Prompt rules reduce risk but are not a security sandbox. LocalSandbox runs commands on its host: approval is the control, not OS isolation. Use the platform sandbox or a separate least-privileged container in production; do not mount unrelated files or pass privileged secrets to the workspace.

Task reports and evidence may contain company data. Restrict database and trace access, use TLS and backups, set retention, and review sensitive-data filtering. The standard trace filter is retained, but cannot guarantee removal of all secrets or personal data in free text. Custom task logs contain IDs/state/department rather than full prompts or provider errors. Failed assignments persist a sanitized error; protected traces are for authorized diagnosis.

Studio editing is retained for compatibility. Treat changing instructions, workflows, grants or approval flags as a privileged configuration change with code review. Do not give untrusted users editor access. Schedules run with their agent's tool grants and do not bypass approval. If an integration channel cannot handle an approval request, use the authenticated Studio session rather than bypassing the gate.

## Operator API key

Generate at least 32 random bytes (the implementation requires 40+ characters) and store ASCENDXI_API_TOKEN in the production secret configuration. Use Authorization: Bearer <key> for direct API clients. Treat this key as full trusted-operator access, rotate it through environment configuration, and never place it in browser URLs or model context. SimpleAuth keys do not expire automatically. Platform Studio login is separate and remains enabled.

## Company desk decisions

`/company/dashboard` serves a static public shell. `/company/state` and all record routes require Mastra authentication in production. Mutations also require the custom dashboard header and reject foreign browser origins; configure exact `ASCENDXI_UI_ORIGINS` for trusted Studio proxies. API responses are not cached. All dynamic record content renders as text under a nonce-based Content Security Policy.

The authenticated operator's explicit publish, accept, stage-change and resource-review buttons record human decisions directly. Model-facing equivalents remain approval-gated tools. This is one trusted operator role, not multi-user separation of duties. Do not give an agent the operator key or direct mutation endpoint credentials.

Knowledge proposals and resource assumptions do not self-verify. Client estimates do not reserve resources. The service monitor runs only four fixed harmless checks, skips any tool still requiring approval, and stores generic status and time rather than provider account payloads. A previous successful check is historical evidence, not continuous availability.

## Explicit local mode and project charters

The installed single-user Mac service uses loopback-only company routes with Host/Origin/cross-site guards; see [the local access boundary](local-service.md). Native APIs retain production authentication. Local mode is unsuitable for a public proxy or an untrusted shared OS account. Direct desk chat has an internal-tool allowlist and no external write/delegation tools. Only separately approved typed outbox payloads reach email/calendar writes. A project charter may accept quality-passed internal artifacts automatically; it never grants external action authority. Gateway credentials and bridge operator tokens stay in private server configuration and are never added to prompts or dashboard state.

## Versioned plans and Discord access

Plan revisions, approval/revocation and dependency gates are enforced by the stores and workflow, not just the browser. Generic access consent does not provision credentials or widen Connect permissions. The sole dynamic discussion grant is an exact founder-approved Discord identity/channel pair; it permits read-only advisory output into that room only. Model-facing tools cannot approve plans. See [the complete boundary](plans-and-blockers.md).
