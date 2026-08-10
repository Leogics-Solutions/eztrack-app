# Maincell on Smartdok Stage V1 — Delivery Plan

**Target:** production-ready Maincell pilot by **Sunday, 9 August 2026**  
**Plan created:** Wednesday, 5 August 2026  
**Frontend base:** `eztrack-app/stagev1`  
**Backend base:** `invoiceReaderBackend/stagev1`  
**PoC references:** frontend `maincelll`, backend `maincell`  
**Contract source:** [Signed Maincell SOW](https://drive.google.com/file/d/1-WLai_RDBfpcDO4UY5MJdNTYLkv8nHj_/view)

## 1. Outcome

Use the Maincell project as the first real production implementation of the Stage V1 product model:

1. Work arrives in **Inbox** through a controlled upload/request interface.
2. An active **Automation** determines how it is read, checked and routed.
3. Maincell reference data comes from **Knowledge Base** and live SQL Accounting lookups.
4. Uncertain mappings, exceptions and financial actions appear in **Review**.
5. An authorized user confirms the result before any accounting write.
6. Generated documents, payment allocations and external references remain in **Records** with an audit trail.

The Sunday release is successful only when a user can complete the two Maincell workflows end to end:

- Maincell PO to accounting documents.
- Maincell payment slip to confirmed invoice knockoff.

This release is a focused Maincell implementation on the reusable Stage V1 architecture. It is not the deadline for a completely generic no-code workflow builder.

## 2. Scope decisions for the Sunday deadline

### P0 — must work before deployment

- Controlled web/mobile file upload.
- Organization-scoped Maincell configuration and data.
- Maincell PO automation configured through the Stage V1 Automation surface.
- Excel, PDF and image PO extraction.
- Multi-PO Excel splitting where supported by the PoC parser.
- Chinese-to-English line-description translation.
- Item/SKU matching against Maincell reference data.
- Human review for new, ambiguous or low-confidence mappings.
- Reuse of reviewer-approved item aliases.
- Entity selection/routing with a safe manual fallback.
- Required-field, duplicate, total and mapping checks.
- Human approval before accounting actions.
- Required accounting documents created through the SQL Accounting connector.
- Payment slip extraction and matching against open invoices.
- Partial, combined, duplicate, unmatched and ambiguous payment handling.
- Human confirmation before SQL Accounting payment knockoff.
- Inbox-to-run-to-review-to-output audit trail.
- Background execution for OCR, AI, document generation and external calls.
- Retry-safe/idempotent SQL Accounting actions.
- Deployment health checks, logs, backup and rollback procedure.
- Removal and rotation of committed WhatsApp session credentials.

### P1 — include only when P0 is stable

- Gmail and Google Drive as additional controlled sources.
- Automatic entity selection when confidence is high.
- Customer and stock-item creation proposals through SQL Accounting.
- Automated result notification to the originating supported channel.
- Richer dashboard metrics.

### Explicitly not blocking Sunday

- Always-on WhatsApp or WeChat group monitoring.
- The unofficial Baileys WhatsApp bridge.
- A fully generic drag-and-drop workflow/agent builder.
- Semantic RAG across every uploaded file type.
- Historical master-data cleansing or migration beyond the agreed Maincell seed data.
- Additional workflows, entities or document types not agreed for Maincell UAT.
- Cosmetic redesigns unrelated to completion, safety or usability of the two workflows.

## 3. Decisions required immediately

These decisions are critical path and must be resolved no later than **Thursday, 6 August at 12:00 PM MYT**.

| Decision or dependency | Required answer | Default/safe fallback |
|---|---|---|
| Accounting output | Does Maincell require SO, DO, sales invoice, or a specific combination? | Preserve the PoC's DO + sales invoice behavior, but do not claim SO delivery until confirmed and tested. |
| Maincell legal entities | Final entity list and SQL company/database mapping | Require the reviewer to select the entity; never guess for a financial write. |
| SQL Accounting access | Version, Windows host, test company/database, SDK access and credentials | Stage the approved payload and mark external posting unavailable; this is not full contractual completion. |
| SQL permitted actions | Lookups, customer/item creation, SO/DO/invoice creation and payment knockoff | Allow lookups only until each write action is explicitly authorized. |
| Numbering | SQL-generated numbers or Smartdok-provided series | Prefer SQL-generated authoritative numbers where supported. |
| Mapping approver | Named person/role that confirms new translations and SKU aliases | Organization administrators only. |
| Payment rules | Amount/date tolerances, partial payments, bank charges, combined payments | Exact currency and amount; all exceptions require Finance review. |
| UAT pack | Representative PO, mixed document, Chinese item, new item, duplicate and payment samples | Existing PoC samples may support development but cannot replace Maincell acceptance samples. |
| Hosting | Production URL, database, S3, worker, secrets and connector networking | Do not deploy financial writes until the production secret and network path are verified. |

If SQL test access is not available by the decision gate, escalate immediately. A UI that says “connected” while only staging payloads is not an acceptable substitute for the signed SQL integration deliverable.

## 4. User journeys to deliver

### 4.1 PO to accounting documents

1. User selects **Add documents** or opens the Maincell request interface.
2. User selects/confirms the Maincell entity and uploads the PO/document set.
3. Inbox creates one immutable capture record and queues background processing.
4. The automation router selects the active Maincell PO automation using organization, source and document type.
5. The executor extracts the PO header and every order line.
6. Chinese descriptions are translated while retaining the original source text.
7. Each line is matched against the entity's approved item/SKU mappings.
8. Smartdok checks required data, duplicates, mapping confidence, currency calculation and totals.
9. If anything is uncertain, a Review task explains exactly what needs a decision.
10. The reviewer corrects the data and approves any new mappings.
11. Approved aliases are saved for reuse within the correct organization/entity.
12. Smartdok prepares the configured accounting documents.
13. The reviewer performs the final accounting approval.
14. The SQL connector creates the authorized documents once, returning authoritative external IDs/numbers.
15. Records stores the source, extracted/corrected data, generated files, approvals, events and SQL references.

### 4.2 Payment slip to invoice knockoff

1. User uploads a bank/payment slip and confirms the Maincell entity.
2. Smartdok extracts payer, amount, currency, date, bank reference and notes.
3. The SQL connector retrieves open invoices for the entity/customer.
4. The matcher proposes one-to-one, one-to-many, many-to-one or partial allocations.
5. Duplicate, over-allocation, currency, tolerance and already-paid checks run.
6. Ambiguous or incomplete matches appear in Review.
7. Finance adjusts the allocations if required and confirms the action.
8. The connector performs the SQL Accounting knockoff once.
9. Records stores allocations, reviewer, timestamps and returned SQL references.

## 5. Target architecture

```text
Upload / supported controlled channel
                 |
                 v
        CaptureEvent in Inbox
                 |
                 v
     Automation router + version snapshot
                 |
                 v
   Background AutomationRun executor
        |                    |
        v                    v
Knowledge datasets      SQL read adapter
        |                    |
        +--------+-----------+
                 v
       Checks + confidence gates
                 |
          pass   |   exception
           +-----+------+
           |            |
           v            v
     Ready approval   Review task
           +------------+
                 |
                 v
       Authorized output action
                 |
                 v
    SQL write/knockoff + documents
                 |
                 v
          Records + audit events
```

### Architectural rules

- Capture filtering decides **accept or ignore**. It does not execute workflows.
- Automation routing decides which active workflow owns an accepted item.
- Every run stores an immutable snapshot of the automation version used.
- Knowledge Base supplies reference data; it does not contain hidden workflow logic.
- AI may propose extraction, translation and matches. Deterministic code performs totals, allocation limits and idempotency checks.
- No accounting write occurs without the configured human approval.
- Every external write uses an idempotency/request key and stores the returned external reference.
- Failed external actions remain retryable without regenerating document numbers or duplicating accounting records.

## 6. Branch and integration strategy

### Required branches

Create delivery branches from Stage V1:

- Frontend: `maincell-stagev1` from `stagev1`
- Backend: `maincell-stagev1` from `stagev1`

### Do not merge the old Maincell branches wholesale

The old branches contain conflicting migration history and overlapping Agent/Automation models. The backend PoC also contains committed WhatsApp linked-device credentials.

Use a selective port:

#### Port from backend `maincell`

- Maincell Excel and multi-PO parsers.
- AI spreadsheet/text extraction helpers.
- Forex parsing and deterministic calculations.
- Translation helper.
- Product matching and alias-learning logic.
- Automation run/event state machine concepts.
- Document-numbering safeguards.
- DO/invoice data and PDF generation.
- SQL master-data resolution and approved output client logic.
- Relevant tests and representative sanitized fixtures.

#### Adapt instead of copying

- Map the PoC `Agent` concept onto the Stage V1 `Automation` model.
- Use a single SQLAlchemy model definition per table.
- Add new forward-only migrations on top of the Stage V1 migration head.
- Run PoC processing through the existing background queue instead of synchronous API requests.
- Surface PoC run review inside Stage V1 Review instead of restoring the old Agents navigation.
- Bind item mappings to Knowledge Base datasets and entity scope.
- Generalize user-facing output wording to “accounting or ERP,” while the Maincell instance uses the SQL Accounting adapter.

#### Do not port

- `whatsapp-bridge/sessions/**`.
- The unofficial WhatsApp group listener as a production dependency.
- Old duplicate navigation or separate Agent-builder pages.
- Demo-only staging responses that appear as successful production writes.

## 7. Backend implementation plan

### 7.1 Unify the Automation domain

- Keep the Stage V1 `Automation`, `AutomationChannel` and `AutomationOutput` API contract.
- Restore/implement `AutomationRun` and `AutomationRunEvent` models using the existing Stage V1 tables.
- Add run fields for:
  - automation version snapshot;
  - capture event/source reference;
  - entity ID;
  - extracted and corrected data;
  - validation results;
  - approval state and actors;
  - generated document references;
  - external action references;
  - idempotency key;
  - retry count and last error.
- Use an explicit state machine:

```text
RECEIVED -> QUEUED -> PROCESSING -> NEEDS_REVIEW -> READY_FOR_APPROVAL
         -> APPROVED -> OUTPUT_PROCESSING -> COMPLETED

Any processing state -> FAILED_RETRYABLE or FAILED_FINAL
Review/approval state -> REJECTED
```

**Acceptance:** creating an active automation is no longer configuration-only; an accepted capture item can create a versioned run and reach a terminal or review state.

### 7.2 Automation router and background execution

- Match by organization, active status, source, document type and optional entity rules.
- If exactly one automation matches, queue it.
- If multiple automations match, create a routing Review task.
- If none match, leave the Inbox item visible with “No automation matched.”
- Execute OCR/AI, file parsing, SQL lookups and outputs outside the API request thread.
- Prevent duplicate capture events from creating duplicate runs.

**Acceptance:** upload returns quickly; the user can refresh or poll status while processing continues.

### 7.3 Maincell PO executor

- Port Excel, PDF/image and message extraction.
- Preserve original source descriptions and extracted evidence.
- Port multi-PO splitting for supported spreadsheets.
- Port forex formula parsing and deterministic calculation.
- Require every financial line to reconcile before approval.
- Translate CJK line descriptions in one structured AI call.
- Match against the selected entity's approved item dataset.
- Block output for missing customer, entity, currency, quantity, price, mapping or required translation.
- Generate the accounting payload and review preview.

**Acceptance:** the agreed Maincell PO UAT samples produce correct, reviewable document data without manual re-entry of every line.

### 7.4 Knowledge Base materialization

- Keep `KnowledgeSource` as the uploaded source record.
- Add processed dataset/version records rather than treating the raw file as the final knowledge.
- Implement structured import for customer, item/SKU, alias, price and entity-routing spreadsheets.
- Validate required columns and show row-level import errors.
- Support an approved alias writeback path without modifying the original uploaded file.
- Resolve an automation's selected knowledge types to actual ready dataset versions.
- Activation readiness must check data availability, not merely whether a type name is selected.

**Acceptance:** an uploaded Maincell item master becomes queryable mappings; a reviewed new alias is reused by the next run.

### 7.5 Entity routing

- Represent each Maincell legal entity explicitly.
- Store per-entity SQL connection/company, document rules and knowledge datasets.
- Allow manual entity selection at intake and review.
- Permit automatic selection only at high confidence.
- Block writes when the entity is unknown or conflicts with the selected SQL company.

**Acceptance:** a document can never be posted into a different entity merely because AI guessed incorrectly.

### 7.6 SQL Accounting adapter

- Confirm/deploy the Windows SDK Live sidecar; it is not contained in the two current repositories.
- Implement/test authenticated operations for:
  - health and company identity;
  - customer lookup;
  - item lookup;
  - open-invoice lookup;
  - authorized customer/item creation, if agreed;
  - configured SO/DO/invoice creation;
  - payment allocation/knockoff;
  - idempotency lookup by Smartdok request ID.
- Store secrets server-side only.
- Verify the connector's returned company before every write.
- Store request ID, external IDs, numbers and non-sensitive response summaries.
- Treat timeout/unknown outcomes as reconciliation-required; do not immediately repeat a write.

**Acceptance:** repeating an approval or retry cannot create duplicate SQL documents or duplicate payment knockoffs.

### 7.7 Payment knockoff executor

- Reuse the existing invoice/transaction matching and allocation logic where suitable.
- Add payment-slip ingestion as an automation source document.
- Query SQL open invoices rather than assuming all authoritative invoices exist locally.
- Produce ranked candidates using payer/customer, amount, currency, reference and date.
- Validate allocation totals deterministically.
- Require Finance approval for every knockoff in this release.
- Post the confirmed allocation through the connector and record returned references.

**Acceptance:** the payment UAT pack covers exact, combined, partial, duplicate, unmatched and ambiguous scenarios without over-allocation.

### 7.8 Audit, authorization and observability

- Organization administrators configure automations, integrations and knowledge.
- Assigned finance reviewers approve mapping and accounting actions.
- Record who changed data, before/after values, timestamps and reasons.
- Use structured logs with run ID, organization ID and connector request ID.
- Never log raw credentials, full document contents or session secrets.
- Expose retryable failure reasons to the UI.

**Acceptance:** every financial write can be traced from its SQL reference back to the approving user and original upload.

## 8. Frontend implementation plan

### Inbox

- Upload one or multiple supported files.
- Require/select entity when automatic routing is unsafe.
- Show capture, processing, review, completed and failed states.
- Link each item to its automation run and resulting record.

### Automations

- Seed two templates:
  - `Maincell PO to accounting documents`;
  - `Maincell payment knockoff`.
- Let the user configure sources, required fields, selected knowledge datasets, checks, approval and output connection.
- Show real readiness:
  - active source exists;
  - required knowledge is processed and ready;
  - entity mapping exists;
  - connector health/company is verified;
  - approval role exists;
  - last test passed.
- Replace the non-functional test step with a real sample run.

### Knowledge Base

- Show upload, processing, ready and failed statuses.
- Show imported row count and validation errors.
- Preview structured item/customer mappings.
- Show which automations use each dataset.
- Provide an alias/mapping review surface or link directly to its Review task.

### Review

- Include `AutomationRun` tasks in addition to Inbox and invoice exceptions.
- Support:
  - routing/entity decision;
  - extracted field correction;
  - item/translation mapping approval;
  - generated document approval;
  - customer/item creation proposal;
  - payment allocation adjustment;
  - retry/reconciliation after external failure.
- Show source evidence next to extracted/corrected values.
- Separate **Save correction**, **Prepare output** and **Approve accounting action**.

### Records

- Show completed PO document sets and payment allocations.
- Display source files, audit events, generated PDFs and SQL references.
- Make failed/retryable outputs visible without presenting them as completed.

### Integrations

- Show the SQL Accounting connection as `Not configured`, `Connection failed`, `Verified` or `Action restricted`.
- Display the verified SQL company/entity.
- Do not show a staging target as connected.

## 9. Four-day execution schedule

### Wednesday, 5 August — foundation and critical decisions

- [ ] Create both `maincell-stagev1` branches from `stagev1`.
- [ ] Freeze unrelated Stage V1 feature work until Maincell deployment.
- [ ] Revoke and remove committed WhatsApp sessions; start history cleanup.
- [ ] Confirm Maincell entities, required accounting outputs and approvers.
- [ ] Confirm SQL Accounting test access and sidecar deployment owner.
- [ ] Create forward database migration for run/event and required mapping fields.
- [ ] Unify the Automation/Agent models without duplicate SQLAlchemy table definitions.
- [ ] Port the Maincell run state machine and core PO skill files so the backend boots.
- [ ] Add Maincell template seeds and sanitized development fixtures.

**Exit gate:** backend boots, migrations apply on a fresh database, an upload can create a queued automation run, and SQL access has an owner/date.

### Thursday, 6 August — PO vertical slice

- [ ] Finish background automation routing and execution.
- [ ] Complete Excel/PDF/image PO extraction and multi-PO splitting.
- [ ] Complete translation, forex calculation and validation.
- [ ] Import the Maincell item/customer data as ready Knowledge Base datasets.
- [ ] Complete mapping review and reusable alias writeback.
- [ ] Add AutomationRun tasks to Review.
- [ ] Generate the configured document preview/PDF.
- [ ] Finalize and test the SQL connector contract for required document actions.

**12:00 PM dependency gate:** if SQL access or exact output objects are still unknown, escalate.  
**Exit gate:** a real Maincell PO reaches Review with correct lines, English descriptions, mappings and reconciled totals.

### Friday, 7 August — accounting output and payment workflow

- [ ] Complete SQL customer/item/open-invoice lookups.
- [ ] Complete idempotent SO/DO/invoice output as confirmed by Maincell.
- [ ] Store external references and support safe retry/reconciliation.
- [ ] Complete payment-slip extraction.
- [ ] Reuse/extend allocation matching for exact, combined and partial payments.
- [ ] Build the payment allocation Review UI.
- [ ] Complete confirmed SQL payment knockoff.
- [ ] Link completed outputs into Records.

**Exit gate:** one approved PO creates the correct test SQL records once, and one approved payment produces the correct test knockoff once.

### Saturday, 8 August — stabilization and deployment rehearsal

- [ ] Run the complete Maincell UAT matrix.
- [ ] Test wrong entity, missing mapping, duplicate PO and duplicate payment protections.
- [ ] Test SQL timeouts, connector downtime and safe retries.
- [ ] Test organization isolation and reviewer authorization.
- [ ] Run frontend typecheck/lint/build and targeted backend tests.
- [ ] Run migrations against a production-like database backup.
- [ ] Verify object storage, worker, API and connector networking.
- [ ] Verify no secrets/session files exist in the delivery branch or build artifact.
- [ ] Deploy to staging and complete a production deployment rehearsal.
- [ ] Prepare rollback commands and identify the on-call owner.

**Exit gate:** all P0 automated checks pass and no Sev-1/Sev-2 issue remains open.

### Sunday, 9 August — UAT, production release and handover

- [ ] Take backups and record deployed commit SHAs/migration revision.
- [ ] Conduct Maincell smoke UAT using agreed real samples.
- [ ] Obtain explicit acceptance for accounting objects, entity routing and knockoff behavior.
- [ ] Deploy API, worker, frontend and SQL connector.
- [ ] Run post-deployment health and organization-isolation checks.
- [ ] Run one controlled PO and one controlled payment end to end.
- [ ] Monitor errors, queue depth, AI latency and connector responses.
- [ ] Deliver the operator guide, known limitations and support/escalation contact.
- [ ] Record acceptance evidence and any dependency-blocked item.

**Release gate:** do not enable production financial writes until the SQL company identity, authorization rules, idempotency behavior and rollback path are verified.

## 10. UAT matrix

### PO workflow

| Case | Expected result |
|---|---|
| Known customer and known English items | Passes to approval with no mapping task. |
| Known Chinese item alias | Uses the approved English description and SKU. |
| New Chinese item | Requires mapping approval and reuses it on the next run. |
| Low-confidence item match | Does not silently accept; reviewer selects or creates mapping. |
| Missing customer/entity | Blocks accounting output. |
| Foreign currency with Maincell conversion instruction | MYR line values and total reconcile deterministically. |
| Domestic MYR order | Preserves MYR values without requiring forex. |
| Multiple POs in one supported workbook | Produces separate linked runs/documents. |
| Duplicate PO | Flags/blocks according to the confirmed rule. |
| SQL timeout after request | Reconciles by idempotency key before retrying. |
| Approval action submitted twice | Creates only one external document set. |

### Payment workflow

| Case | Expected result |
|---|---|
| Exact single invoice match | Proposes one allocation and waits for approval. |
| One payment covers several invoices | Proposes allocations whose total does not exceed the payment. |
| Partial payment | Allocates the partial amount and leaves the balance open. |
| Several payments cover one invoice | Preserves prior allocations and caps the remaining balance. |
| Unknown payer/reference | Requires Finance review. |
| Duplicate payment slip/reference | Blocks duplicate knockoff. |
| Currency mismatch | Blocks or requires an explicitly approved conversion rule. |
| SQL invoice already paid | Blocks the action and refreshes authoritative status. |
| Knockoff action submitted twice | Produces one external knockoff only. |

### Security and tenancy

| Case | Expected result |
|---|---|
| User changes active organization | No data from the previous organization remains visible. |
| Non-admin edits automation/integration | Access denied. |
| Unauthorized user attempts final approval | Access denied and audited. |
| File from another organization is referenced | Access denied. |
| Logs/build artifacts inspected | No API keys, SQL credentials or WhatsApp sessions. |

## 11. Definition of done

The Maincell Sunday release is done when all of the following are true:

- [ ] Both delivery branches are based on Stage V1 and have reviewed commit SHAs.
- [ ] Stage V1 navigation remains the product interface; no separate Agents product is required.
- [ ] The two Maincell automations exist and can execute, not merely save configuration.
- [ ] Maincell knowledge datasets are processed, entity-scoped and actually used during matching.
- [ ] The agreed PO samples extract, translate, match and reconcile correctly.
- [ ] New mappings require approval and are reused afterward.
- [ ] A reviewer can approve the configured accounting documents.
- [ ] The connector creates the correct SQL Accounting records exactly once.
- [ ] Payment samples propose correct allocations and confirmed knockoff executes exactly once.
- [ ] Wrong-entity, duplicate and ambiguous cases are blocked or routed to Review.
- [ ] Inbox, Review and Records show one connected audit history.
- [ ] Long-running work happens in the background and does not block unrelated APIs.
- [ ] Automated tests, migration rehearsal and production smoke tests pass.
- [ ] WhatsApp session credentials have been revoked and removed from delivery history/artifacts.
- [ ] Production secrets, backups, monitoring and rollback are verified.
- [ ] Maincell acceptance evidence and known limitations are documented.

## 12. Deployment and rollback checklist

### Before deployment

- Record frontend/backend commit SHAs and migration head.
- Back up the production database.
- Verify S3/object-storage access and retention.
- Verify API-to-worker and API/worker-to-SQL-connector networking.
- Verify the connector reports the expected Maincell entity/company.
- Verify production OpenAI model, limits, timeout and concurrency settings.
- Verify all secrets are injected through the deployment environment.
- Run the sanitized UAT pack against staging.

### Deployment order

1. Database migrations.
2. Backend API.
3. Background worker.
4. SQL Accounting connector.
5. Frontend.
6. Maincell seed/configuration and knowledge import.
7. Health checks and controlled smoke runs.
8. Enable production write actions only after validation.

### Rollback

- Disable/pause both Maincell automations first.
- Disable SQL write actions while preserving read-only diagnostics.
- Roll back frontend/API/worker to the recorded commit.
- Use a migration downgrade only if explicitly tested; otherwise restore the database backup.
- Reconcile any external request with unknown outcome using its idempotency key before reprocessing.
- Preserve audit events and original uploads during rollback.

## 13. Major risks and responses

| Risk | Impact | Response |
|---|---|---|
| SQL test access is late | Cannot complete document creation or knockoff | Escalate Thursday noon; do not mislabel staging as production integration. |
| Required SO/DO/invoice combination is unclear | Wrong accounting output | Obtain signed confirmation immediately; test exact objects. |
| Old branches are merged wholesale | Migration conflicts and duplicate models | Selectively port capabilities onto new Stage V1 branches. |
| Committed WhatsApp sessions remain valid | Account/session compromise | Revoke, rotate, purge history and scan artifacts immediately. |
| AI extraction varies | Incorrect financial data | Use schemas, confidence gates, deterministic totals and human review. |
| Duplicate approval/retry | Duplicate accounting records | Enforce idempotency and external reconciliation. |
| Multi-entity guess is wrong | Posting to wrong company | Require manual confirmation unless routing is deterministic/high-confidence. |
| Four-day scope grows | Sunday failure | Freeze unrelated work and enforce P0/P1 boundaries. |
| Existing PoC tests are too narrow | Regression during port | Add vertical-slice integration tests around the agreed Maincell samples. |

## 14. First actions

Start in this order:

1. Revoke the exposed WhatsApp linked-device session and quarantine the old bridge assets.
2. Obtain the SQL Accounting test environment, exact output objects and entity list.
3. Create the two `maincell-stagev1` branches.
4. Unify the Automation models and restore a runnable AutomationRun state machine.
5. Wire controlled upload to a background Maincell automation run.
6. Port the PO extraction, translation, matching, forex and document-generation capabilities.
7. Materialize the Maincell item/customer Knowledge Base datasets.
8. Integrate Review and perform the first real PO vertical slice.
9. Complete SQL output, then payment matching/knockoff.
10. Stabilize, rehearse deployment and run Sunday UAT.

## 15. Post-Sunday product follow-up

After the Maincell release is stable, extract the Maincell-specific assumptions into reusable templates and adapter contracts:

- general accounting/ERP output adapters;
- reusable entity-routing rules;
- configurable document/output sets;
- structured Knowledge Base schema mapping;
- more automation templates;
- official WhatsApp Business intake where commercially required;
- workflow version promotion and rollback;
- broader monitoring, analytics and SLA reporting.

This is how Maincell should strengthen Stage V1: the production workflow becomes the first proven template on the common platform rather than a second disconnected custom PoC.
