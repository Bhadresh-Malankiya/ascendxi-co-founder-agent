# Integrations and configuration

`DATABASE_URL` is mandatory. Model generation needs the credential for `ASCENDXI_MODEL`; the default uses `MASTRA_GATEWAY_API_KEY`. These are separate from integration access.

For Mastra Connect, attach services in the platform project's **Connect** page, then configure `MASTRA_PROJECT_ID` and `MASTRA_PLATFORM_ACCESS_TOKEN` (or the starter-supported `MASTRA_PLATFORM_SECRET_KEY`). Do not commit credentials. Merely setting variables is not a connectivity test. Optional platform sandbox/filesystem variables retain their existing behavior.

## Least privilege

The co-founder resolves current integration tools. New or unknown tools always require approval. Department agents get only exact tool IDs granted by an operator:

```dotenv
# Illustrative only: replace with real IDs displayed in your running project's Tools panel.
ASCENDXI_DEPARTMENT_TOOLS={"operations":["linear_list_issues"],"customer":["gmail_list_messages"],"sales":[],"finance":[]}
# Only list independently reviewed safe reads. Leave empty until reviewed.
ASCENDXI_READ_TOOLS=linear_list_issues
```

Examples are not evidence that those IDs exist for your connection. Missing grants yield no tools. Unknown department names or invalid JSON fail startup instead of widening access. Existing upstream approval requirements are never removed, including on safe reads. Never allowlist generic HTTP/SQL/shell executors or ambiguous tools based on their names. Review schemas, side effects, credential scopes and data access first.

The digest independently restricts its active tools to reviewed reads and excludes mutation verbs. A new integration cannot silently become an autonomous digest action. If none qualify, the digest must say it could not gather activity instead of inventing it.

## Verify each service

1. Confirm the connection appears in the platform project and is authorized for the intended account.
2. Inspect tool IDs and schemas in Studio. Resolve any ambiguous account selection.
3. Make a low-impact authorized read and inspect its actual result. Do not send test messages, create calendar events or modify records just to prove connectivity.
4. Test a controlled write on a test resource with explicit approval and verify the returned identifier/readback before relying on that action.
5. Grant only the required department IDs. Record what was tested and when; authorization may expire.

Recommended capabilities to attach as company needs become concrete: code/issues, internal knowledge, support, calendar and company communication. Financial and production actions stay approval-gated. No provider account is provisioned by this repository.

## Current observation

On October 16, 2026 the existing `bhadresh/co-founder` Mastra project's Connect page listed Discord, Google Drive, Gmail and Google Calendar and showed **No requests yet**. This is a UI observation, not a successful service-call verification. No connection scopes, credentials or deployed code were modified during implementation.

Later on October 16, 2026, real read-only calls through the deployed tools succeeded for Calendar colors, Drive account metadata, Gmail labels and Discord guild listing. See [release verification](release-verification.md) for the current verified scope; local model access has since been verified.

## Single-responsibility role access

`ASCENDXI_ROLE_TOOLS` is a strict JSON object of role IDs to exact observed Connect tool IDs. Roles do not automatically inherit department access. Every role-resolved tool passes through the same approval guard. Example, after confirming these IDs exist in your project:

```dotenv
ASCENDXI_ROLE_TOOLS={"meeting-coordinator":["google_calendar_list_events","google_calendar_create_event"],"outreach-writer":["google_mail_create_draft"],"account-executive":["google_mail_get_thread","google_mail_send_message"]}
```

A reviewed `google_calendar_list_events` allowlist entry can permit autonomous reads; creating an event, saving a mailbox draft and sending a message remain approval-gated. Confirm that the originating account has the required provider scopes, inspect the exact action payload, and verify the resulting receipt. Tool discovery does not prove that a send or booking will succeed. No email or meeting is sent merely by creating a client-stage assignment.

The existing production project has explicit narrow grants for meeting coordination, outreach drafts, account-executive communication, delivery updates and knowledge source discovery. Sending and calendar creation have not been exercised against real recipients as part of setup.

The local extension uses the existing bridge for verified Discord logging and a bounded company Gmail header watch. Configure Discord IDs in `.env.example`, then verify and enable in Connections. See [live operations](live-operations.md) for channel receipts, project threads, message-content restrictions and the exact approval boundaries.
