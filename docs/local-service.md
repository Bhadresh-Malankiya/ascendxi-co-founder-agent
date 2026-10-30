# Continuous local company service

The founder's installed instance runs at http://127.0.0.1:4111/company/dashboard with the server, Postgres records and one worker on this Mac. Online model requests use the approved Mastra Gateway credential. Existing connected services are reached through the authenticated cloud integration bridge. A local installation does not copy or inherit browser sessions or connector credentials.

## Install / update

1. Use Node 22.13+ and a running local Postgres 14+ database. Create a dedicated company database; never use the test database for real operations.
2. Copy the relevant settings from `.env.example` into a private `.env.company-local`. Set `NODE_ENV=production`, local mode and worker to true, a strong operator token, local database URL, model/Gateway credential and port. Keep the file mode 600 and out of Git.
3. Stop development before building. Run `npm ci`, `npm run typecheck`, `npm test`, the integration suite against a separate database, then `npm run build`.
4. Run `npm run local:install` on macOS. The installer stages the built runtime in Application Support, preserves the database, installs the user LaunchAgent and starts it. Re-run after source/build updates. Finish or recover any in-flight work before updating.
5. Open the desk and check the fresh worker heartbeat. A credential-configured indicator alone does not verify a successful model call.

The installer uses `~/Library/Application Support/AscendXI Company OS/` for `runtime/`, private `service.env`, logs and workspace. It uses `~/Library/LaunchAgents/com.ascendxi.company-os.plist` for startup. Runtime staging avoids macOS Documents access restrictions for login services. Logs and configuration are private to the OS account. `runtime.previous` preserves the previous bundle for recovery; database backups remain necessary.

`npm run local:status` reports service state. `npm run local:stop` unloads it. Reinstall to start it again. Outside macOS, run the production bundle under your own process supervisor with the same environment; the included installer is intentionally macOS-specific.

## Worker behavior

One Postgres session lock owns the worker. It selects bounded assignments promptly when continuous mode has a backlog, otherwise every 15 seconds, keeps a heartbeat during work and terminates on lease loss so the supervisor can restart it. The worker processes approved communications and tracked replies before selecting one eligible assignment. Project prerequisites and pause state gate task selection. Missing credentials block model work while keeping the desk and communication checks available.

The shared default limit is **four AI jobs per hour**, enforced atomically across worker assignments and direct chat. One assignment may include several tool calls and a specialist plus quality model call. This is a job rate limit, not a monetary budget. Provider budgets/credits remain separate. No automatic credit top-up is configured by this project.

A project charter may authorize automatic acceptance of independently reviewed internal artifacts with no blockers or evidence gaps. This advances the next dependency. It never approves sending, spending, signing, deploying or accepting client contracts. Other artifacts wait for the operator. Blocked tasks wait for an explicit reviewed retry; the worker does not invent evidence to keep moving.

A crash preserves task reports, messages, events, artifact revisions and the action ledger. It does not resume a half-completed model call. Inspect and recover a stranded running task before retrying. A communication left `sending` after a crash requires reconciliation after five minutes; it is never automatically resent.

## What “continuous” means on a Mac

The user service starts at login and restarts after a process crash. `caffeinate -is` prevents idle system sleep on AC power and battery while the service runs. Work still stops when the machine shuts down, the user logs out, the lid/manual sleep suspends it, required online services are unavailable, or credits run out. This is not an independent always-on cloud worker. Keep the Mac powered, signed in and online for unattended operation.

## Local access boundary

Local mode binds the server to `127.0.0.1`. Company desk routes accept only loopback Host and exact local browser origins, reject cross-site API requests, and require a custom header on mutations. The trusted local OS user can operate those routes without typing the private API token. Native Mastra APIs still require the operator bearer token in production. This is a single-operator installation, not protection from malicious processes running as the same Mac user. Never reverse-proxy local mode onto a public/LAN address. Use production authentication with local mode off for remote hosting.

## Visible work and supported execution

- Conversations saves actual agent responses, assignments, reviews, operator notes and tracked emails. Direct chat can use bounded internal company tools. Tool call names/results-recorded indicators and artifact reads appear in Events; hidden model reasoning is not collected.
- Projects has 11 dependency-gated SRP handoffs and source/evidence snapshots with hashes and provenance. Client projects require a real won opportunity; internal company projects require founder authorization.
- Outbox stores validated email/calendar payloads. Approval binds the exact hash and expires after 24 hours. Calendar creation checks availability first. Provider IDs are retained; uncertainty is held for reconciliation. An event receipt does not prove invitation delivery or client acceptance.
- Replies to sent, tracked email threads create deduplicated project-linked response assignments. The optional company header watch separately checks up to ten matching unread messages a minute, baselines existing mail, and creates notices for new headers without sending or marking mail read.
- The durable assignment workflow prepares and reviews artifacts using project-bound read tools. It cannot autonomously edit the repository, deploy, make sales commitments or send messages. Workspace execution remains separately approval-gated in native agent sessions. Full delivery needs actual implementation, tests and provider receipts, not just model text.
- Source discoveries enter the KB as drafts. Existing company applications and documents are not automatically synchronized. Review a source before publishing it as authoritative.

Independent 15-second timers inspect health and service communications even during a model call. Discord/email inbound reads run at most once a minute. The dashboard uses an authenticated server event stream with 1.5-second snapshot checks and reconnection; it does not reload the page. See [live operations](live-operations.md).

The founder may delegate routine internal plan approval with `ASCENDXI_AUTONOMY=internal`. Use `ASCENDXI_MAX_RUNS_PER_HOUR=0` for continuous processing, or a positive integer to reinstate throttling. Routine acceptance never converts failed evidence into a pass and never approves purchases, new access, client scope or deployment. Existing model credits are consumed by actual work.

Task-bound evidence can be attached at `/company/tasks/:id/evidence`. The operator endpoint retains source and SHA-256; the model receives only its server-bound assignment read tool. Fresh evidence can automatically requeue an active internal-goal evidence failure once per revision, at most twice/day. Missing access, provider failures and uncertain external writes never use this path.
