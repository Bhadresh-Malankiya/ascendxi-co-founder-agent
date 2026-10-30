# Live company operations

The seven registered owners share a persistent company ledger. A single operations monitor uses recorded evidence; adding a new project does not create more agent identities. The dashboard uses AscendXI's restrained monochrome treatment, with color reserved for status. Cards expose working, waiting, idle, blocked, paused and stalled states. The connections graph reflects the lean team ownership graph, not invented conversations.

## Streaming and inspection

`GET /company/live` is a guarded server-sent event stream. The server checks for changes every 1.5 seconds, sends changed snapshots and keeps the connection alive. The browser sends authentication in headers, stores no bearer token, and reconnects after interruption. It updates cards, task queue, notices and suggestions without page reload. Opening an agent shows its visible output, model, tools, task ownership and evidence. Direct Conversations displays visible text chunks during generation. Tool events record tool names and run identifiers; hidden reasoning and credentials are not collected.

Task plans store priority, estimated minutes, optional due date and next step. Missing estimates remain unknown. Waiting tasks identify prerequisites; dependencies and pause controls still gate selection. Pausing an agent affects new work, not an already-running request.

Saved-record invalidations remain pending while a dialog is open or a message is being drafted. Closing the dialog or receiving the next snapshot after the draft clears applies the update without a page reload. Busy/failed fetches and changes arriving during an in-flight fetch remain pending. A proposed preservation budget attached to a completed prerequisite remains reachable from the dependent task's live blocker; access requests never transfer through that relationship.

## Monitoring and evidence

Independent 15-second checks inspect persisted blockers, review needs, failed/latest or long-running calls, missing worker heartbeat and uncertain communication outcomes. The inspection tool returns bounded task IDs, reasons, worker status and notices. Task reports separate unmet scoped criteria from out-of-scope future limitations; limitations never authorize a launch. Duplicate notices are suppressed and resolved conditions retire their notices. Health checking uses no paid model call. The Operations Monitor agent can separately explain the recorded state on request.

Maturity combines accepted/assessed tasks (50%), quality passes/reviews (30%) and normalized operator ratings (20%). Missing components are omitted with weights normalized. No data means no score. Scores are provisional until ten assessed tasks and three ratings, and use the latest bounded evidence window disclosed by the API. A failed provider or missing evidence is never counted as a completed task. Token figures are actual reported usage, not a currency bill.

## Self-improvement

Task results, blockers and operator feedback can propose sourced lessons. Pending suggestions never change facts, instructions or access. Applying a knowledge suggestion creates a KB draft; the normal exact-revision source review must still publish it. Applying memory accepts only typed verbosity/format preferences. The operator may enable future structured formatting feedback for that agent only, and revoke it from the agent inspector. Free-form lessons and agent-written proposals never gain authority through that switch. Access requests require separate tool configuration and verification; approving a lesson cannot create credentials or remove approval requirements.

## Discord

Set the four Discord ID settings in `.env.example`, install/restart, then enable company logging in Connections. Activation verifies that all three channels exist in the configured guild. One existing bot labels actual agent starts, finishes, elapsed time, deliverables and reviews. It does not impersonate separate human/agent accounts or generate conversation for appearances. The existing bot's thread rights support project rooms under the operations channel; no broader permission is needed.

Each outbound item is persisted before sending and atomically claimed. A verified provider message ID is retained. Unknown outcomes become uncertain and are never automatically resent. Project creation also records uncertainty before external writes. Configured channels and project threads are polled for new non-bot messages. The installed bot lacks broad message-content access: mention `@Co-Founder` to deliver readable text within its existing scope. Blank provider bodies create an access notice; no message understanding is claimed. Broader message-content permission needs separate review. Readable messages these appear in the portal as evidence and notices. They are untrusted requests, not action approval. With the existing bot user ID configured, addressed `status`, `health` and `approvals` commands return actual worker/task counts and blockers without model calls. Other addressed discussions are queued only after exact identity/channel founder consent; see [discussion access and plan approvals](plans-and-blockers.md). They have no external execution tools and cannot approve actions. Replies use the same durable, deduplicated delivery ledger. Approvals still occur in the portal against exact data. The local portal link works on this Mac only.

## Email

Connections exposes an optional bounded Gmail header watcher. Default scope is unread mail to the public company address within one day. The first successful check baselines existing results. Later unseen message headers create notices. Up to ten results are checked once a minute, so this is a bounded watch, not guaranteed full-mailbox synchronization. It never marks read, sends, or claims to have understood a message body. Existing sent-thread reply handling is separate. Sending email and creating meetings remain exact-content approval actions with receipts.

## Models, costs and recovery

Routine/coordinator roles use GPT-6 Luna; co-founder, technical and critical-review roles use GPT-6 Sol. Both were verified with actual tool-call probes through the installed Mastra Gateway adapter. The adapter currently uses OpenRouter Chat Completions; the newer GPT-6.1 Sol requires Responses for tools, so it is not offered in this verified profile list. Reasoning effort is disabled for this transport's tool compatibility. Provider support can change; repeat bounded probes before adding a profile. Do not treat connectivity probes as evaluation of all agent quality.

An unset hourly job limit defaults to four; the founder-selected local configuration uses zero for continuous work with no hourly cap. One assignment can contain several calls; this cap is not a monetary budget. Deterministic health, stream checks and formatting approvals cost no model tokens. No automatic credit purchase is enabled. Startup fences orphan run records and preserves task recovery controls. A stopped model request is not resumable generation. Discord uncertainty and email/calendar uncertainty require inspection before retry, preserving duplicate prevention.

The compact desk uses six primary sections; secondary tabs contain related work and company views. Plans, learning suggestions and outbound approvals are discoverable from Decisions. Blocked assignments expose a Resolve control. Read-only operational charts use actual recorded run history; product analytics remain unconnected until independently verified.
