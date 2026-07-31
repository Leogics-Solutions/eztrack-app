# Smartdok V1 Launch Scope

**Status:** Proposed launch scope  
**Product wedge:** Purchase Order → reviewed Delivery Order + Sales Invoice  
**Launch model:** Self-onboarding SaaS with human approval before finance documents are released  
**Primary repositories:** `eztrack-app` and `invoiceReaderBackend`

**Module 0 audit:** See [`MODULE_0_SECURITY_AUDIT.md`](./MODULE_0_SECURITY_AUDIT.md) for the preserved security findings and pre-launch remediation gates.

## 1. V1 product decision

Smartdok V1 should not launch as a generic “build any finance agent” platform.

It should launch with one repeatable transaction pack:

> A business receives a customer Purchase Order, Smartdok captures and understands it, reconstructs the required transaction, highlights missing or uncertain data, lets a human approve it, and produces a Delivery Order and Sales Invoice ready for delivery or accounting export.

This gives the product a clear promise, a measurable workflow, and a controlled path to broader finance automation later.

### Should we start with capture and input source channeling?

Yes. Capture is the correct first product module because every workflow depends on receiving reliable source evidence.

However, the first build should be the **canonical intake pipeline**, not many separate channels. Start with manual upload, prove the full workflow, then connect email and other channels to the same intake model.

The recommended sequence is:

1. Secure the current code and secrets.
2. Build one canonical intake pipeline.
3. Launch manual upload as the first channel.
4. Complete the PO-to-DO-and-Invoice workflow.
5. Add inbound email.
6. Add Drive and official WhatsApp only when pilot demand justifies them.

## 2. V1 end-to-end user journey

A successful self-onboarding customer must be able to complete this flow without help from the Smartdok team:

1. Sign up and verify their email.
2. Create a company workspace automatically.
3. Complete a short company, tax, currency, and document-numbering setup.
4. Upload a Purchase Order.
5. See the item immediately in a work queue.
6. Let Smartdok classify, extract, and normalize the document.
7. Match the customer, addresses, items, quantities, prices, tax, and currency.
8. See missing information, conflicts, and confidence warnings.
9. Correct data and approve the transaction.
10. Generate a Delivery Order and Sales Invoice.
11. Download or email the documents and export accounting-ready data.
12. See the full audit timeline and Smart Credits used.

## 3. Scope principles

- One transaction pack before many agent types.
- One canonical intake model before many input channels.
- One work queue for all sources.
- Deterministic financial validation; AI may interpret evidence but must not invent totals.
- Human approval before sending or posting finance documents.
- Every action must be organization-scoped, traceable, retryable, and idempotent.
- Cloud-first self-onboarding; customer-local integrations require a separate secure connector.

## 4. Module roadmap

| Order | Module | Priority | Launch requirement | Primary ownership |
|---|---|---:|---|---|
| 0 | Security containment and repository hygiene | Blocker | Required before builds or deployment | Both repos |
| 1 | Canonical capture and intake foundation | P0 | Required | Backend + frontend queue |
| 2 | Input source channels | P0/P1 | Manual upload required; email next | Both repos |
| 3 | Transaction case and workflow engine | P0 | Required | Backend + frontend |
| 4 | Document understanding and normalization | P0 | Required | Backend |
| 5 | Master-data matching and reconstruction | P0 | Required | Backend |
| 6 | Validation and exception engine | P0 | Required | Backend |
| 7 | Review and approval workspace | P0 | Required | Frontend + backend |
| 8 | Document generation and delivery | P0 | Required | Both repos |
| 9 | Self-onboarding and workspace administration | P0 | Required | Both repos |
| 10 | Smart Credits and billing | P1 | Required for public paid launch | Both repos |
| 11 | Production operations and launch controls | Blocker | Required | Both repos/infrastructure |

### Module 1/2 implementation checkpoint (29 July 2026)

The first Capture Hub vertical slice now exists across both repositories:

- A frontend Capture Hub with Smart Inbox, Channels, Rules & AI, and a dedicated Playground page.
- Organization-scoped capture configuration, deterministic pre-AI rules, and versioned processing instructions.
- Layered AI guidance now supports one Global instruction plus optional Upload, Gmail, Drive, inbound-email, WhatsApp, and Telegram instructions; the effective prompt remains bounded and retains the fixed platform safety/schema wrapper.
- The dedicated Playground evaluates the complete saved rule chain against sample message metadata and an optional attachment, previews the effective instruction layer, and can run a quota-charged extraction without creating an inbox item or invoice.
- Organization-scoped incoming event records with source context, attachments, decisions, failures, and linked processing jobs.
- Gmail and Google Drive connection, manual and scheduled sync, deduplication, filtering before download/OCR, and Smart Inbox visibility.
- Multiple Gmail and Drive accounts per user, with account-specific manual sync and configurable 5/15/30/60-minute auto-sync.
- Drive folder setup uses an ordered management modal; each named folder accepts a copied share link or raw ID and is assigned to a specific connected account.
- Auto-sync schedules are organization-scoped, survive restarts, expose next/last-run state, and use database leases to prevent duplicate runs across API workers.
- Dedicated email, official WhatsApp, and Telegram are presented as assisted integrations with an in-app notes form and organization-scoped request records.
- Processing instructions flow into the normal accepted-document extraction path with a fixed safety and schema wrapper.
- Existing web/mobile uploads appear in the Smart Inbox through the current batch-job API.

This is a functional foundation, not completion of Modules 1 and 2. The remaining launch-critical gaps are:

- Move manual upload onto the canonical capture-event contract instead of presenting it only as a legacy batch job.
- Replace the in-memory processing queue with a durable queue and add restart-safe retries/dead-letter handling.
- Add private evidence storage, malware scanning, content hashing, and complete idempotency across every source.
- Provision the dedicated inbound email adapter and provider webhook.
- Upgrade scheduled Gmail/Drive polling to provider push/change notifications when near-real-time volume requires it.
- Update persisted capture-event status from job lifecycle events rather than deriving status in the browser.
- Keep official WhatsApp Business and Telegram disabled until their verified webhook adapters are built.
- Complete Module 0 before running or deploying the frontend.

## 5. Module definitions

### Module 0 — Security containment and repository hygiene

**Goal:** Make the existing codebase safe to build, test, and deploy.

**Scope**

- Remove and investigate the obfuscated remote-code loader currently present in `eztrack-app/next.config.ts`.
- Rotate any credentials that may have been committed or exposed.
- Remove real customer documents, billing receipts, and secrets from tracked files.
- Replace live-looking values in example environment files with safe placeholders.
- Add secret scanning, dependency scanning, and protected CI checks.
- Review webhook authentication, upload safety, organization isolation, and log redaction.

**Acceptance criteria**

- A clean checkout can be installed, tested, and built without downloading or executing unknown code.
- No active secrets or customer documents are tracked in Git.
- Secret scanning and dependency checks run in CI.
- A documented incident review records what was exposed and which credentials were rotated.

This module blocks all other build and deployment activity.

### Module 1 — Canonical capture and intake foundation

**Goal:** Convert every future input source into the same secure, observable intake record.

**Core object: `CaptureEnvelope`**

Suggested minimum fields:

- `id`
- `organization_id`
- `source_type`
- `source_reference`
- `source_message_id`
- `original_filename`
- `mime_type`
- `file_size`
- `content_hash`
- `storage_key`
- `received_at`
- `idempotency_key`
- `status`
- `metadata`
- `created_by`

**Pipeline**

`RECEIVED → STORED → QUEUED → PROCESSING → NEEDS_REVIEW → READY → APPROVED → DELIVERING → COMPLETED`

Any stage may transition to `FAILED`, with a visible reason and a safe retry path.

**Scope**

- Private object storage with organization-scoped access.
- MIME and extension validation, file-size limits, and malware scanning.
- File hashing, duplicate detection, and idempotent submission.
- Durable background job queue; production cannot rely on an in-memory job backend.
- Source trace from original evidence through every generated output.
- Retry, timeout, failure reason, and dead-letter handling.
- A unified intake/work-queue API.
- A frontend queue showing status, source, received time, owner, and required action.

**Acceptance criteria**

- A supported file appears in the queue immediately after submission.
- Refreshing or retrying does not create duplicate cases or charges.
- Processing survives an application restart.
- One organization can never access another organization’s evidence.
- Every output can be traced to its source file and processing run.

### Module 2 — Input source channels

**Goal:** Receive business documents from useful customer channels without duplicating processing logic.

Every adapter must create the same `CaptureEnvelope` and hand off to Module 1.

#### V1 channel order

| Channel | V1 status | Reason |
|---|---|---|
| Web manual upload | P0 — launch requirement | Fastest path to validate the complete product |
| Dedicated inbound email or Gmail OAuth | P1 — next after upload is stable | High-value source for real business documents |
| Google Drive watched folder | P2 — pilot-driven | Useful, but not needed to prove the core workflow |
| Official WhatsApp Business/Twilio | P2 — pilot-driven | Valuable only with official APIs and verified webhooks |
| QR-based or unofficial WhatsApp bridge | Out of V1 | Operational and security risk |
| Arbitrary MCP/source connectors | Out of V1 | Expands scope before the core pack is proven |

**Manual upload acceptance criteria**

- Accept PDF, PNG, and JPEG within configured limits.
- Support drag-and-drop and mobile upload.
- Show upload progress and a clear accepted/rejected result.
- Create exactly one intake record and one transaction case.
- Allow a failed item to be retried safely.

**Inbound email acceptance criteria**

- Accept attachments from a dedicated address or connected mailbox.
- Verify provider webhooks and deduplicate by provider message ID plus content hash.
- Preserve sender, recipients, subject, received time, body context, and attachments.
- Route unsupported or ambiguous messages to the review queue.

### Module 3 — Transaction case and workflow engine

**Goal:** Represent the complete business transaction, not just isolated document extraction.

**Suggested core objects**

- `TransactionCase`
- `EvidenceDocument`
- `ProcessingRun`
- `ExtractedField`
- `MatchCandidate`
- `ValidationIssue`
- `ApprovalDecision`
- `GeneratedArtifact`
- `DeliveryAttempt`
- `AuditEvent`

**Scope**

- Create one transaction case from each eligible intake item.
- Attach multiple source and supporting documents to the same case.
- Maintain explicit state transitions and ownership.
- Record model version, prompt/extractor version, confidence, and raw evidence location.
- Support assignment, comments, corrections, approval, rejection, retry, and cancellation.
- Replace frontend-only agent concepts with persisted backend APIs and state.

**Acceptance criteria**

- A user can open one case and see evidence, extracted data, issues, decisions, outputs, and history.
- State changes are validated server-side.
- Reprocessing creates a new run without destroying the original result.
- Every material action creates an immutable audit event.

### Module 4 — Document understanding and normalization

**Goal:** Reliably convert a Purchase Order into a fixed, versioned business schema.

**V1 Purchase Order schema**

- PO number and date
- Customer identity and registration/tax identifiers
- Billing and delivery addresses
- Contact details
- Currency and payment terms
- Line-item SKU/description
- Quantity and unit of measure
- Unit price, discount, and line amount
- Tax code/rate and tax amount
- Subtotal, tax total, rounding, and grand total
- Requested delivery date
- Notes and referenced attachments

**Scope**

- Reuse the current OCR and document-processing capabilities behind one adapter interface.
- Classify supported documents before extraction.
- Normalize dates, currency, quantities, units, identifiers, and numeric formats.
- Store field-level evidence and confidence, including page/region when available.
- Use a versioned schema and extraction contract.
- Mark absent or uncertain fields explicitly; never silently invent them.

**Acceptance criteria**

- Golden test documents produce schema-valid output.
- Every extracted field has a value, source, and confidence or an explicit missing state.
- Low-confidence and conflicting fields become review issues.
- Extractor/model upgrades can be measured against the same golden dataset.

### Module 5 — Master-data matching and transaction reconstruction

**Goal:** Turn extracted text into the customer’s actual commercial transaction.

**Scope**

- Customer matching by registration number, tax ID, name, email, phone, and address.
- Product/SKU matching by exact code, aliases, customer-specific codes, and description.
- Unit-of-measure mapping.
- Currency and exchange-rate handling.
- Customer-specific price, tax, payment-term, and delivery-rule lookup.
- Ranked match candidates with reasons and confidence.
- Simple master-data import from CSV/XLSX.
- A controlled path to create or update missing customer/item records.

**Acceptance criteria**

- Exact matches resolve automatically.
- Ambiguous matches require human selection.
- The system explains why a candidate was selected.
- Corrections can be saved as organization-specific mappings for future transactions.
- No master-data record is created silently.

### Module 6 — Validation and exception engine

**Goal:** Prove the transaction is internally consistent before approval.

**V1 deterministic checks**

- Required fields are present.
- Quantities and unit prices are valid numbers.
- Line amount equals quantity × price minus discount.
- Subtotal equals the sum of lines.
- Tax is calculated according to the selected tax rule.
- Grand total equals subtotal plus tax and rounding.
- Currency and exchange-rate requirements are satisfied.
- Customer, item, address, and tax mappings are resolved.
- Duplicate PO and duplicate output checks pass.
- Document numbering is available and unique.

**Scope**

- Severity levels: `BLOCKER`, `WARNING`, and `INFO`.
- Clear issue code, explanation, affected field, and resolution action.
- Revalidation whenever relevant data changes.
- Configurable organization rules without arbitrary code execution.

**Acceptance criteria**

- Blockers prevent approval and delivery.
- Financial calculations are deterministic and independently testable.
- A user can move from each issue directly to the affected field.
- An approved case has no unresolved blockers.

### Module 7 — Review and approval workspace

**Goal:** Give finance and operations users one place to resolve exceptions confidently.

**Scope**

- Work queue with filters for status, source, owner, age, customer, and severity.
- Split view of original evidence and normalized transaction data.
- Highlight low-confidence fields and validation issues.
- Candidate selection for customer and item matches.
- Inline correction with immediate revalidation.
- Assign, comment, approve, reject, and send back for correction.
- Role-based approval permissions.
- Preview of Delivery Order and Sales Invoice before release.

**Acceptance criteria**

- A trained user can review a normal PO without leaving the case page.
- Editing totals or commercial fields triggers deterministic recalculation.
- The approver identity, decision, timestamp, and data version are recorded.
- The UI never shows a case as complete before backend completion is confirmed.

### Module 8 — Document generation, delivery, and accounting output

**Goal:** Produce useful business outputs after approval.

**V1 outputs**

- Delivery Order PDF
- Sales Invoice PDF
- Structured JSON representation
- CSV/XLSX accounting-ready export
- Download link and email delivery

**Scope**

- Company branding, addresses, tax details, currency, and numbering templates.
- Immutable output version linked to the approved transaction snapshot.
- Preview before release.
- Delivery status, retry, bounce/failure visibility, and duplicate-send protection.
- Export mapping suitable for founder-assisted customer accounting setup.

**Integration boundary**

Direct SQL Account integration should not block the self-onboarding V1 launch. A cloud service cannot safely call software running on a customer’s local machine without an installed connector or reachable integration service. V1 should provide a documented export; a signed local connector can be a separate pilot scope.

**Acceptance criteria**

- Generated documents reconcile exactly with approved data.
- Repeated delivery requests do not send duplicates.
- Every generated version and delivery attempt is auditable.
- Users can download a structured export without Smartdok support.

### Module 9 — Self-onboarding and workspace administration

**Goal:** Let a new company reach its first successful transaction without manual provisioning.

**Scope**

- Sign-up, email verification, login, refresh, logout, forgot password, and reset password.
- Automatic company/workspace creation.
- Guided setup for company identity, tax, currency, timezone, numbering, branding, and email.
- Invite teammates and manage roles.
- Correct server-side organization-admin authorization.
- Starter import for customers, products, and tax mappings.
- Sample PO or guided first-run checklist.
- Terms, privacy notice, data-retention choice, and account deletion request.

**Acceptance criteria**

- A new user can create and configure a workspace without database or support intervention.
- Invitations and role changes work and are organization-scoped.
- Password recovery and session refresh work end to end.
- A user can reach the upload screen through a clear onboarding checklist.

### Module 10 — Smart Credits and billing

**Goal:** Meter product value predictably and support a paid self-service launch.

**Scope**

- Define one billable unit in business terms, not raw pages or model tokens.
- Recommended V1 rule: charge for a completed processing run, with a documented allowance for pages and attachments.
- Trial credits for new workspaces.
- Balance, usage ledger, low-balance warning, and transaction-level cost visibility.
- Checkout, subscription or credit purchase, invoice/receipt, webhook verification, and failed-payment handling.
- Idempotent charging and automatic refund/reversal for platform failures.
- Admin controls for support adjustments with an audit trail.

**Acceptance criteria**

- The same case/run cannot be charged twice.
- Customers can see what consumed credits and why.
- Billing webhooks are verified and replay-safe.
- A failed internal job does not permanently consume paid value.

### Module 11 — Production operations and launch controls

**Goal:** Operate the product reliably once customers depend on it.

**Scope**

- CI for frontend and backend linting, type checks, tests, builds, migrations, and security scans.
- Durable queues and workers with retries and dead-letter visibility.
- Structured logs, metrics, traces, and correlation IDs from intake to delivery.
- Error monitoring and alerts for queue backlog, failure rate, webhook failure, and delivery failure.
- Database backups and tested restoration.
- Storage retention and deletion controls.
- Feature flags and a safe rollback procedure.
- Support/admin view for cases without exposing data across organizations.
- Runbooks for stuck jobs, duplicate submissions, billing disputes, and data requests.

**Acceptance criteria**

- A fresh checkout passes CI.
- Existing backend test failures and missing fixtures are resolved.
- A deployment can be rolled back safely.
- Backup restoration has been tested.
- Operations can locate a failed transaction using its case or correlation ID.

## 6. What can be reused, what must be built, and what must be repaired

### Reuse and consolidate

- Existing document upload and private storage capabilities.
- Existing OCR/model-provider integrations.
- Existing AP/AR document models where they fit the canonical evidence model.
- Existing organization scoping and authentication foundations.
- Existing reconciliation, COA, document-generation, and export logic where relevant.
- Existing Gmail/Drive and accounting integration work as later adapters.

### Build for V1

- Canonical `CaptureEnvelope`.
- Durable intake orchestration.
- Transaction case and processing-run state model.
- Fixed PO normalization schema.
- Customer/SKU matching and mapping memory.
- Deterministic validation issue engine.
- Unified review and approval workspace.
- Backend APIs for the current Agent Studio concepts.
- Self-onboarding flow.
- Smart Credits ledger and self-service billing.

### Repair before launch

- Malicious or untrusted build-time code.
- Secret and customer-data repository hygiene.
- In-memory production jobs.
- Missing refresh/reset/verification flows.
- Broken organization role mutation paths.
- Frontend/backend contract gaps for `/agents` and `/sql-account`.
- Backend test collection configuration, missing fixtures, and current regressions.
- Lack of CI and production observability.

## 7. Explicitly out of V1

- Generic natural-language agent builder.
- Multiple transaction-pack families at launch.
- Fully autonomous approval, sending, or ledger posting.
- Unofficial WhatsApp QR/session bridge.
- Direct connection to every desktop accounting product.
- Arbitrary customer-written code or rules.
- Multi-country compliance coverage beyond the selected launch market.
- Complex enterprise SSO, SCIM, and custom approval chains.
- Marketplace or public agent templates.
- Mobile-native applications.

These can remain visible as roadmap items, but should not consume the core launch team before the first transaction pack is reliable.

## 8. Recommended execution sequence

### Phase 0 — Make the foundation safe

- Complete Module 0.
- Restore clean, repeatable frontend and backend test/build commands.
- Freeze new channel and generic-agent work until this is complete.

### Phase 1 — Prove intake

- Build `CaptureEnvelope`, storage, deduplication, durable jobs, and the work queue.
- Deliver manual upload end to end.
- Establish status, error, retry, and audit conventions used by all later modules.

### Phase 2 — Understand one PO

- Add the versioned Purchase Order schema.
- Adapt current OCR/extraction into the new processing-run contract.
- Create a golden dataset and field-level evaluation.

### Phase 3 — Reconstruct and validate

- Add customer/SKU mapping, normalization, and deterministic financial checks.
- Implement exception codes and resolution actions.

### Phase 4 — Review and produce outputs

- Complete the review workspace.
- Generate and preview Delivery Order and Sales Invoice.
- Add download, email delivery, and accounting export.

### Phase 5 — Make it self-service

- Complete signup, verification, workspace setup, team roles, master-data import, credits, and billing.
- Add inbound email using the same intake pipeline.

### Phase 6 — Pilot and launch

- Run controlled pilots.
- Fix reliability and usability issues from real transactions.
- Complete operational, privacy, support, and recovery launch gates.

## 9. Launch acceptance gates

Smartdok V1 is ready for self-onboarding only when all of the following are true:

- Security containment and credential rotation are complete.
- A fresh checkout passes frontend and backend CI.
- Manual upload completes the full PO → DO + Invoice journey.
- Jobs survive restarts and support retry without duplicate cases, outputs, emails, or charges.
- Organization isolation has automated tests.
- Deterministic totals match approved source data.
- No output is delivered while blockers remain.
- A complete audit timeline exists from intake through delivery.
- New users can sign up, recover access, configure a workspace, invite a teammate, and complete their first case.
- Billing is idempotent and usage is understandable.
- Backups, restoration, monitoring, alerts, support runbooks, retention, and deletion are operational.
- A golden document set meets agreed extraction and matching targets.
- At least 20–30 representative end-to-end transactions have been completed successfully.
- At least 3–5 pilot companies have completed transactions with minimal founder intervention.

## 10. V1 success metrics

Track these from the first pilot:

- Time from upload to review-ready.
- Percentage of cases processed without extraction retry.
- Field accuracy on the golden dataset.
- Customer and SKU auto-match rate.
- Percentage of cases with no manual correction.
- Median human review time.
- Percentage of cases completed without support.
- Duplicate-case, duplicate-output, and duplicate-charge rate.
- Delivery success rate.
- First-value time from signup to first approved transaction.
- Cost per successfully completed transaction pack.

Targets should be fixed after the golden dataset and first pilot baseline are available.

## 11. First team backlog

The first implementation backlog should focus only on:

1. Remove the unsafe frontend loader and rotate exposed credentials.
2. Define the `CaptureEnvelope`, transaction-case, processing-run, and audit-event contracts.
3. Replace production in-memory processing with a durable queue.
4. Implement secure manual upload with hashing and idempotency.
5. Build the unified work queue.
6. Define the versioned Purchase Order schema and golden test dataset.
7. Connect the current extraction pipeline to the new intake/run model.
8. Implement customer/SKU matching and deterministic validation.
9. Build the review-and-approve case page.
10. Generate Delivery Order and Sales Invoice from the approved snapshot.

Do not begin additional source channels until items 1–5 are stable, and do not begin generic agent creation until the complete V1 transaction pack has passed pilot launch gates.
