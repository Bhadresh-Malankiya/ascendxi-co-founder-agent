# Use the visual company desk

Open `/company/dashboard` on the running Mastra server. Local development: http://localhost:4111/company/dashboard. Production: https://co-founder.server.mastra.cloud/company/dashboard. The page requires a private operator key for protected company records unless the host forwards its signed-in Studio session. Keys stay in page memory and disappear on reload; never include them in a URL.

1. **Company desk:** inspect the company goals, organization, operating loop and last verified service checks. Click a department to see its specialist roles and responsibilities. Provider credential configuration is shown separately from actual successful generation.
2. **Goals:** inspect outcomes and acceptance criteria. Progress is computed from all persisted tasks linked to that goal, not a generated percentage.
3. **Workboard:** create a scoped assignment with product, department, optional specialist, goal and acceptance criteria. Run it only when model access is configured. Inspect the saved specialist deliverable and independent quality review. Accept only with evidence, or request another attempt with a reason.
4. **Knowledge:** search current records, open sources/history and propose updates. Review and publish the exact draft revision separately. Agents continue to use the previous published version while a new draft is reviewed. A review-due label means the evidence needs refreshing.
5. **Clients:** add a source-backed opportunity, create its current-stage assignment, and record reviewed progress. Stage records do not send messages or book meetings. The co-founder uses the approved integration actions for those external steps.
6. **Resources:** enter measured capacity and rates with provenance, review the exact resource revision, then create an estimate from an opportunity. Missing or stale evidence becomes a blocker. Saved estimates retain their original resource snapshot.
7. **Activity:** see recent record updates. Use Studio traces for tool/model execution diagnostics and framework run history.

## End-to-end supervised example

Start with a real business lead and source. Create its research-stage assignment. Run it, inspect quality findings and approve acceptance only when fit is supported. Record qualification with evidence. The next stage assignment is owned by the Outreach Writer and prepares a truthful first-contact draft; sending still requires approval of the actual recipient/content through the connected provider.

Continue through discovery, scope and estimation with verified inputs. After an actual client decision, the Project Manager prepares delivery work for design, AI and engineering. Delivery Manager coordinates status and QA handoffs; QA independently checks acceptance; delivery and knowledge roles prepare handoff and ongoing support. Missing inputs or unavailable tools remain visible blockers rather than invented execution results.

The implementation currently generates and reviews internal artifacts in its durable task workflow. Interactive approved tools perform external actions. An unattended external execution engine, comprehensive action ledger, spend reservations and verified always-on hosting are separate activation work; do not infer them from the pipeline UI.

## Continuous local desk additions

See [local service](local-service.md) for the guarded loopback access model. Projects supports client awards and founder-approved internal charters, 11 durable handoffs, pause/resume and hashed text evidence. Conversations supports direct chat with all seven current owners, saved project rooms and earlier message pagination. Events shows actual persisted operations, including tool activity and evidence reads. Outbox shows exact email/calendar drafts, hash-bound approval, receipts, cancellation and uncertainty reconciliation. Its controls never imply that an unverified service is connected.

The default company desk now uses the live operations views described in [live operations](live-operations.md). Company records preserves the earlier overview.

New goal/project proposals now require exact-revision founder approval through Plans/Decisions. See [central scope and blockers](plans-and-blockers.md).
