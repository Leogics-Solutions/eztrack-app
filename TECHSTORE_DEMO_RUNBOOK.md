# TechStore Phase 1 Demo Runbook

Target: Thursday, 20 August 2026

## Presenter principle

Present Smartdok through its normal product surfaces. Do not open a TechStore-branded dashboard or describe the flows as a separate prototype.

Use TechStore files only as realistic input data. The visible story is:

`Existing channel or upload → Smartdok review → controlled finance action`

## Client-facing sequence

### 1. Supplier statement reconciliation

1. In **Automations**, confirm **Email supplier statement reconciliation** is active for the connected Gmail inbox.
2. Send an unread email with subject `Supplier Statement - <supplier> - <period>` or `SOA - <supplier> - <period>` and attach the PDF, image or Excel statement.
3. Wait for the five-minute Gmail poll, then open **Records → Payables → Supplier statements** (`/supplier-statements`). Manual upload remains available as a fallback.
4. Click **Reconcile statement** on its normal detail page.
5. Explain the exception-first results: matched, amount difference, missing invoice, duplicate reference, needs review and already linked.
6. Confirm one clean match. This creates the standard supplier-statement-to-invoice link; it is not demo-only state.

### 2. WhatsApp PO to DO and invoice

1. Open **Automations** (`/automations`).
2. Open the existing **WhatsApp PO to DO & Invoice** automation.
3. Show the bound WhatsApp group, extraction contract, validation checks, approval gates and SQL Account output.
4. Send or use the prepared PO through the existing WhatsApp workflow.
5. Review the generated run in **Review**, approve it, and show the resulting DO/invoice and source-channel return.

Do not create a second TechStore-specific PO screen. The point is that the same configured workflow handles the customer document.

### 3. Payment slip to bank reconciliation

1. Upload the relevant bank statement in **Records → Banking & reconciliation → Bank statements**.
2. In **Automations**, open or create **Payment slip to bank reconciliation**.
3. Confirm Gmail, Bank transactions and Upload are selected as sources, and the Gmail connection is ready.
4. Activate the automation. Activation installs the payment-slip Capture rule and scheduled Gmail intake.
5. Send an email with payment-slip attachment(s). Put the customer and invoice references in the subject/body.
6. Open the resulting item in **Review**.
7. Show **Bank-statement verification** before discussing invoice allocation. Every slip must match one uploaded bank transaction; unmatched or ambiguous evidence blocks posting.
8. Review the open-invoice allocation and approve only after the evidence and variance checks pass.

Suggested email structure:

```text
Subject: Payment advice - <customer name>

Please allocate the attached payment to:
<invoice number> <amount>
<invoice number> <amount>
```

## Other Phase 1 scenarios

### SOA and collection follow-up

1. Open **Records > Receivables > SOA & collections**.
2. Click **Import QNE ageing** and upload `01_INPUT_QNE_AR_Ageing_Aug2026.csv` from the workflow folder.
3. Explain the three visible stages while the file is processed: QNE data in, Smartdok recalculation and policy, then human control.
4. Show the persistent collection worklist and select customers to review the generated SOA, recalculated ageing and next collection action.
5. Download a generated SOA PDF, then approve or hold one prepared customer output.
6. Open **Review** to show the remaining approval and paused exception tasks.
7. Use **Remove import** after the presentation to reset the workflow for another clean run.

Customer email delivery, QNE write-back and automatic scheduling remain disabled until the production connectors and approved TechStore policies are commissioned.

Use the existing Records/Review/Automation surfaces wherever the corresponding workflow is configured. The former client-specific demo routes have been removed. Files in `public/techstore-demo` are internal fallback material only.

The fallback package still contains the prepared claim, SOA, payment-voucher, PO/DO/invoice and reconciliation examples, plus screenshots under `public/techstore-demo/backups`.

## Pre-flight

- Sign in and confirm no **TechStore Demo** item appears in the main navigation.
- Confirm the intended company is selected.
- Open one processed supplier statement and run reconciliation once.
- Confirm the WhatsApp PO automation is active and its group/SQL connections show ready.
- Confirm the payment automation has Gmail and Bank transactions enabled.
- Confirm the Gmail sync schedule is enabled and a connected Gmail account exists.
- Upload the prepared bank statement before sending the payment-slip email.
- Open the payment review and confirm the bank-evidence table shows a matched transaction.
- Keep `public/techstore-demo/backups` open in a separate local window as a non-client-facing fallback.

## Truthful integration answer

Smartdok is demonstrating reusable workflows using its existing capture, records, review, reconciliation and automation surfaces. Production integrations still depend on the API, database or approved export access available in each TechStore system. The demo does not imply that uncommissioned QNE, Info-Tech, CIMB or Microsoft 365 production connectors are already live.
