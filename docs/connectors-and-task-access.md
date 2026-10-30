# Add apps and MCP connections from the company desk

Open **Company → Connections & access → Add connection**. New configuration becomes available without restarting the service.

## HTTP MCP

Choose HTTP MCP server, enter a name and its actual MCP endpoint, and choose no credential, bearer token or API key header authentication. Use a least-privilege credential. Credentials are write-only in this UI and encrypted in Postgres using a machine-local AES-256-GCM key. The key lives in `~/Library/Application Support/AscendXI Company OS/private/connector-vault.key` (file 0600, directory 0700). Preserve that key with a protected database backup; it is not exported with source code. `ASCENDXI_PRIVATE_DIR` optionally changes the private storage directory.

Remote servers require HTTPS. Local HTTP requires explicit loopback consent; private LAN/metadata destinations and the company server itself are rejected. Transport DNS is validated and pinned, cross-origin requests and redirects are rejected, and response sizes/timeouts are bounded. This UI does not launch arbitrary commands: stdio servers must be run separately with an HTTP MCP endpoint.

Click **Discover tools**. Discovery does not execute a business tool and does not establish that the agent can read the resource its task needs.

## Mastra Connect

Choose Mastra Connect project, enter the project ID, the required provider IDs and an existing platform access token. Account authorization remains in the provider/Mastra sign-in page, available through the setup link. The SDK handles tools from already connected accounts. This does not create provider accounts, provision services or embed every provider's OAuth flow in this portal. Discovery uses the existing `connections.ts` SDK boundary; upstream tool restrictions remain enforced.

Official references: [MCPClient](https://mastra.ai/reference/tools/mcp-client), [Connect tools](https://mastra.ai/reference/connect/tools), [MCP authentication and authorization](https://mastra.ai/docs/guides/mcp-authentication-authorization). Implementation follows the installed `@mastra/mcp` 2.4.1 types and bundled documentation.

## A task needs access

Agents can return structured `connectionNeeds` or use `connection_request` within a server-bound assignment. Requests are saved against the actual task owner; an agent cannot request access for another owner's task. The portal shows a notification and a **Set up required connection** action. Existing blocked tasks also have **Connect app / MCP for this task** under blocker resolution.

Open the request, select a discovered connection/tool, review the JSON input schema, enter the exact resource/read inputs and confirm that the tool and inputs perform a read only. **Approve & test read** saves that precise grant and executes the read. Provider hints are not treated as independent proof of safety. Use trusted servers and read-only provider credentials; this interface does not approve writes or override an upstream approval restriction.

A successful actual response becomes dated, redacted task evidence. The responsible agent's blocked assignment is queued once when all of its currently requested connection capabilities have verified evidence and its approved scope, prerequisites and pause state allow. The worker resumes it using the new evidence; independent review still decides acceptance. Merely adding a credential, discovering tools or approving a read does not mark a blocker resolved. Reads that fail or change reopen the connection request and notify the founder. A successful retry clears its failed-read notice.

Grants fix the owner, task, connection version, tool schema and exact arguments. The model receives a grant ID, never credentials, and cannot alter the saved inputs. Reviewers can inspect attached evidence without inheriting the producer's remote access. Reconfiguration or disabling a connection revokes its grants. A changed tool schema fails closed. Completing a task retires its requests and grants. The portal and worker updates use the existing authenticated SSE stream.

These reads collect evidence for the existing internal artifact workflow. They do not add product-repository modification or deployment capabilities.

## Verification

Tests exercise the real Mastra MCP HTTP client against a controlled local protocol server, encrypted credential restart/decryption and permissions, origin/network restrictions, task ownership, exact schema/input grants, changed-schema rejection, revocation, paused-owner handoff, actual evidence persistence and one-time reassessment. Database tests run against `TEST_DATABASE_URL`, not the production company database. Browser verification uses a separately named local test database and a clearly labelled fixture, never a fabricated real-provider connection.
