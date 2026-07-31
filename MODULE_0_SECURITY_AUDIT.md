# Smartdok Module 0 Security Audit

**Audit date:** 29 July 2026  
**Repositories reviewed:** `eztrack-app` and `invoiceReaderBackend`  
**Audit type:** Read-only source, repository, dependency, and configuration review  
**Current decision:** Deferred for functionality planning, but mandatory before any build, deployment, pilot, or customer launch  
**Launch status:** `NO-GO`

## 1. Purpose

This document preserves the Module 0 findings discovered while reviewing the existing Smartdok codebase.

The product team may continue defining and prioritizing V1 functionality. However, the current frontend must not be installed, started, built, or deployed until the malicious code and exposed credentials described below have been contained.

Do not run:

```text
npm install
npm run dev
npm run build
next dev
next build
```

## 2. Executive summary

Module 0 is not currently complete.

The review identified:

- An obfuscated remote-code loader inside the public frontend repository.
- Evidence that the affected Next.js configuration was loaded locally after the malicious code was introduced.
- Real credentials committed in the backend example environment file.
- Real customer and financial data committed to the backend repository.
- Unauthenticated routes serving uploaded documents and bank statements.
- An unsigned WhatsApp webhook that can disclose Twilio credentials to an attacker-controlled URL.
- Weak OAuth state handling and plaintext storage of Google refresh tokens.
- Unsafe upload paths without reliable size limits, content validation, quarantine, or malware scanning.
- Browser-readable authentication tokens, missing rate limits, and incomplete session revocation.
- Sensitive information written to application logs.
- Vulnerable or unpinned dependencies and no automated security controls in CI.

These findings must be remediated before production use. Functionality planning can continue separately using `SCOPE_V1_LAUNCH.md`.

## 3. Critical finding register

### M0-01 — Obfuscated remote-code loader in the frontend

**Severity:** Critical  
**Status:** Open  
**Location:** `eztrack-app/next.config.ts`, after the normal Next.js configuration  
**Introduced by commit:** `c7cdf52d013663469b287c7f396219a390c91230`  
**Observed file SHA-256:** `A9EAD2785E7C2C06065D992E05A86053E5E736651DECD6794AA341F146D66280`

The appended code:

- Obfuscates its strings and behavior.
- Obtains remote payload pointers through blockchain transactions.
- Downloads and XOR-decrypts payloads.
- Executes one payload using `eval`.
- Starts another payload as a detached, hidden Node.js process.
- Runs when the Next.js configuration is loaded, including during development and production builds.

The indicators match a publicly documented cross-chain dead-drop malware technique associated with the Contagious Interview/DEV#POPPER campaign family.

The affected commit is reachable from multiple local and remote branches. The frontend repository is publicly accessible, so other developers or deployment systems may also have loaded it.

**Required remediation**

- Stop all builds and deployments.
- Preserve the malicious commit and file hash as incident evidence.
- Remove the malicious block from every affected active branch and tag.
- Coordinate Git-history cleanup only after credentials have been revoked.
- Review repository access, forks, clones, build logs, deployment logs, and organization audit events.
- Rebuild the affected workstation from known-good media before using it for production credentials.

### M0-02 — The development workstation must be treated as compromised

**Severity:** Critical  
**Status:** Open

Local `.next` artifacts were created after the loader entered the repository. Loading the Next.js configuration executes the malicious code, so the available evidence indicates that it ran on the workstation.

No active hidden Node payload or known persistence marker was found during the point-in-time inspection. This does not demonstrate that the machine is clean.

Additional concerns:

- Microsoft Defender real-time, behavior, IOAV, and network inspection protections were disabled at review time.
- No recorded Defender quick or full scan was available.
- A credential-stealing or backdoor payload may operate without leaving the specific known markers checked during this audit.

**Required remediation**

- Disconnect the affected workstation from the network.
- Do not use it to rotate credentials or access cloud administration consoles.
- Preserve relevant evidence before cleanup.
- Run enterprise incident-response tooling or Microsoft Defender Offline.
- Prefer a complete rebuild from known-good installation media.
- Reinstall editors, Node.js, Python, and development tools from trusted sources.
- Clone the repositories again only after repository cleanup is complete.

### M0-03 — Active credentials committed to the backend repository

**Severity:** Critical  
**Status:** Open  
**Primary location:** `invoiceReaderBackend/.env.example`

The tracked example environment file contains live-format or active credentials for:

- AWS IAM and S3.
- OpenAI.
- Gemini/Google API.
- Google OAuth.
- Twilio.
- JWT signing and application secrets.
- A remote AWS RDS database.
- Demo-user access.

Several tracked values exactly match values in the ignored local `.env` file. Secret values are intentionally not reproduced in this document.

The malicious frontend loader is capable of executing credential-stealing payloads. Therefore, even credentials that were not committed but were accessible on the workstation or in build environments must be considered at risk.

**Required remediation**

- Revoke and rotate credentials from a known-clean device.
- Rotate GitHub sessions, personal access tokens, SSH keys, OAuth grants, and deployment credentials first.
- Rotate AWS, database, OpenAI, Google/Gemini, Twilio, JWT, application, email, and integration credentials.
- Force logout or invalidate application sessions after rotating signing secrets.
- Audit provider usage and access logs for the full exposure window.
- Replace every example value with a clearly non-functional placeholder.
- Remove the secrets from Git history after revocation.
- Enable secret scanning and push protection.

Removing the values only from the latest commit is not sufficient because they remain in repository history.

### M0-04 — Customer and financial data committed to Git

**Severity:** Critical  
**Status:** Open  
**Repository:** `invoiceReaderBackend`

Tracked data includes:

- Billing invoices and receipts.
- A multi-page sales invoice test upload.
- A Chart of Accounts spreadsheet.
- Business Central item, company, vendor, purchase-order, address, contact, pricing, and tax exports.
- Vendor and salesperson contact information.

Some directories are now ignored, but their existing files remain tracked. Several sensitive paths are also not excluded from the Docker build context and may be copied into backend container images.

**Required remediation**

- Preserve an evidence inventory.
- Identify whether the backend repository, container images, artifacts, or backups were ever publicly accessible.
- Notify the appropriate privacy/legal owner.
- Replace real samples with synthetic fixtures.
- Remove sensitive files from every active branch and coordinated Git history.
- Delete or replace affected container images and build artifacts.
- Add explicit ignore and `.dockerignore` rules.
- Define test-data classification, retention, and approval rules.

### M0-05 — Unauthenticated financial-document routes

**Severity:** Critical  
**Status:** Open  
**Locations:** `invoiceReaderBackend/main.py`

The backend registers public file-serving routes for:

- `/uploads/{file_path}`
- `/bank_statements/{file_path}`

These routes do not require JWT authentication or organization authorization. The bank-statement route also logs filesystem details and filenames during error handling.

The newer S3 document routes generally use authentication and organization scoping, but these legacy routes bypass those controls.

**Required remediation**

- Disable or remove both public routes immediately.
- Serve documents only through authenticated, organization-scoped APIs.
- Prefer short-lived, organization-authorized download URLs.
- Remove directory and filename disclosure from errors and logs.
- Add negative cross-organization access tests.

### M0-06 — WhatsApp webhook can disclose Twilio credentials

**Severity:** Critical  
**Status:** Open  
**Location:** `invoiceReaderBackend/app/api/v1/endpoints/webhooks.py`

The `/whatsapp` endpoint:

- Does not validate the Twilio request signature.
- Trusts the submitted sender phone number.
- Does not consistently require a verified user phone.
- Accepts a caller-controlled media URL.
- Sends the Twilio account SID and auth token as HTTP Basic credentials when downloading that URL.
- Does not restrict the media host or redirect target.
- Loads the full response into memory before enforcing a size limit.
- Lacks strong idempotency, content verification, and malware scanning.

An attacker can submit a forged webhook and point `MediaUrl` to a server they control, causing the application to disclose the Twilio credentials. Internal addresses can also be targeted, creating an SSRF risk.

**Required remediation**

- Disable the endpoint until fixed.
- Validate Twilio signatures using the exact public request URL and body.
- Require a verified phone-to-user mapping.
- Use Twilio APIs or a strict allowlist for media retrieval.
- Never send credentials to an unverified or redirected host.
- Stream into a bounded quarantine area.
- Verify content type and file signature.
- Scan the content before parsing.
- Deduplicate requests using Twilio message identifiers.

## 4. High-severity finding register

### M0-07 — OAuth connection and token-storage weaknesses

**Severity:** High  
**Status:** Open

The Gmail and Google Drive OAuth flows use predictable state values and insufficient state validation. Callback endpoints derive the user identity from that state. Google access and refresh tokens are stored as plaintext database values, and disconnecting a connection does not revoke the provider token.

OAuth callback errors may also be inserted directly into HTML responses.

**Required remediation**

- Generate cryptographically random, one-time state values.
- Bind state to an authenticated browser session, user, organization, and expiry.
- Use PKCE consistently.
- Encrypt provider tokens using a managed key.
- Revoke provider grants during disconnect.
- Escape callback output and return controlled error pages.
- Add connection-swapping and login-CSRF tests.

### M0-08 — Unsafe upload and document-processing boundaries

**Severity:** High  
**Status:** Open

Several upload paths validate only the filename extension. Some read the entire request into memory before applying limits; other multipart and presigned upload paths have no meaningful maximum size enforcement.

The presigned S3 flow does not bind the content type or size, and confirmation does not verify magic bytes, content hash, allowed type, or malware status before OCR and AI processing.

**Required remediation**

- Apply per-file, per-request, and per-organization limits.
- Stream uploads with an early hard limit.
- Validate file signatures independently of names and browser MIME values.
- Record a cryptographic content hash.
- Quarantine new files before OCR or parsing.
- Add malware and archive-bomb scanning.
- Restrict parsers to supported types.
- Add duplicate and idempotency controls.

These controls should become part of Module 1, the canonical capture pipeline.

### M0-09 — Authentication and session weaknesses

**Severity:** High  
**Status:** Open

Current concerns include:

- Access and refresh tokens stored in browser `localStorage`.
- JavaScript-created cookies that cannot be `HttpOnly`.
- Frontend route protection that checks only for cookie presence, not token validity.
- No effective login, registration, or admin-login rate limiting.
- Weak minimum password requirements.
- No completed email verification, password recovery, or refresh-token workflow.
- Stateless logout with no refresh-token revocation.
- Long-lived access tokens.
- Active-user status is not consistently checked on every authenticated request.
- Leaked JWT secrets make existing tokens untrustworthy.

**Required remediation**

- Rotate signing secrets and force session invalidation.
- Move sessions to `HttpOnly`, `Secure`, appropriately `SameSite` cookies.
- Implement refresh-token rotation, storage, revocation, reuse detection, and logout.
- Add rate limiting and account-abuse monitoring.
- Enforce active-user and active-organization checks on every request.
- Complete email verification and password recovery.
- Add CSRF protection where cookie authentication is used.

### M0-10 — Sensitive information enters application logs

**Severity:** High  
**Status:** Open

The backend can log:

- Extracted financial-document text.
- Model prompts or responses containing transaction data.
- WhatsApp phone numbers and message previews.
- Business Central request and response payloads.
- S3 keys, file paths, filenames, URLs, and exception details.

**Required remediation**

- Adopt structured, allowlist-based logging.
- Remove raw document and integration payload logging.
- Redact credentials, tokens, personal data, financial data, and file names.
- Add correlation IDs that do not reveal customer data.
- Define access, retention, deletion, and export controls for logs.

### M0-11 — Dependency and supply-chain weaknesses

**Severity:** High  
**Status:** Open

Frontend dependency review found multiple known vulnerabilities, including high and critical package-level findings. The current Next.js version requires an upgrade after the environment is clean.

Backend concerns include:

- Mostly unpinned Python dependencies.
- No lock file or package hashes.
- A vulnerable `python-jose` version in the reviewed environment.
- A vulnerable `python-multipart` version in the reviewed environment.
- A vulnerable development `pytest` version.
- Floating Docker base-image tags.

**Minimum upgrade targets identified during review**

- Next.js: verify and upgrade to a currently supported patched release; the audit resolution available at review time was at least `16.2.12`.
- `python-jose`: at least `3.4.0`.
- `python-multipart`: at least `0.0.31`, subject to compatibility testing.
- `pytest`: at least `9.0.3` for development tooling.

Versions must be revalidated against current upstream advisories when remediation starts.

### M0-12 — Missing automated security and repository controls

**Severity:** High  
**Status:** Open

Neither repository currently provides a complete security CI baseline. Missing or insufficient controls include:

- Secret scanning and push protection.
- Dependency update automation.
- Static application security testing.
- Container and infrastructure scanning.
- Protected build and test checks.
- Branch protection and required review.
- `CODEOWNERS`.
- Security policy and incident reporting instructions.
- Signed-commit enforcement or equivalent provenance controls.

The frontend deployment configuration runs a production build, which would load the compromised Next.js configuration.

Tracked local AI/automation permission files also allow broad commands that could execute repository code without an adequate trust review.

## 5. Additional application-security findings

### M0-13 — Organization-role mutation wiring

**Severity:** Medium to High  
**Status:** Open

Some organization role-management routes use a system-admin dependency while downstream services expect a normal organization user. This can produce broken authorization, unexpected denial, or accidental behavior if unrelated numeric IDs collide.

**Required remediation**

- Separate system-admin and organization-admin endpoints.
- Use explicit actor types and authorization policies.
- Add allow and deny tests for every role mutation.

### M0-14 — Security headers and public API documentation

**Severity:** Medium  
**Status:** Open

No consistent Content Security Policy, HSTS, frame restrictions, referrer policy, or permissions policy was found. Interactive API documentation and the OpenAPI schema may also be publicly available in production.

**Required remediation**

- Add an application-wide security-header policy.
- Restrict production API documentation where appropriate.
- Add CSP reporting before enforcing a strict policy.

### M0-15 — Production data and image hygiene

**Severity:** High  
**Status:** Open

The backend Docker context excludes some local runtime directories but does not exclude all tracked financial samples and Business Central exports. A normal image build can therefore include confidential files unrelated to runtime.

**Required remediation**

- Use a minimal, allowlisted Docker build context.
- Add sensitive sample and export patterns to `.dockerignore`.
- Verify image layers do not contain deleted secrets or customer data.
- Rebuild and replace affected images after cleanup.

## 6. Controls that were found

The audit also found useful foundations:

- Newer S3 document endpoints generally use JWT authentication and organization-scoped access.
- The active-organization resolver checks organization membership.
- Ten existing active-organization and organization-wide data-access tests passed during the read-only audit.
- The frontend uses a package lock file.
- Local `.env`, logs, uploads, and some runtime directories are ignored.

These controls should be retained and expanded. They do not mitigate the critical public routes, webhook, malware, or credential findings.

## 7. Immediate containment checklist

Complete these actions from a known-clean device:

- [ ] Stop frontend deployment pipelines and build webhooks.
- [ ] Make the affected public repository private while the incident is investigated.
- [ ] Isolate the affected development workstation.
- [ ] Preserve the malicious commit, hash, access logs, and build logs.
- [ ] Revoke GitHub sessions, tokens, OAuth grants, SSH keys, and deployment credentials.
- [ ] Rotate AWS IAM keys and review CloudTrail, S3, RDS, and relevant service activity.
- [ ] Rotate database users and restrict network access.
- [ ] Revoke and rotate OpenAI and Gemini/Google keys.
- [ ] Rotate the Google OAuth client secret and revoke stored Gmail/Drive grants.
- [ ] Rotate Twilio credentials and inspect messaging activity.
- [ ] Rotate application/JWT secrets and invalidate existing sessions.
- [ ] Rotate other credentials or browser sessions accessible from the affected machine.
- [ ] Disable `/uploads`, `/bank_statements`, and `/webhooks/whatsapp`.
- [ ] Start legal/privacy review for tracked customer data.
- [ ] Rebuild the affected workstation from known-good media.

## 8. Repository remediation checklist

- [ ] Create clean remediation branches from reviewed commits.
- [ ] Remove the malicious loader from all active frontend branches and tags.
- [ ] Replace every real environment value with a non-functional placeholder.
- [ ] Replace real customer files with synthetic fixtures.
- [ ] Correct `.gitignore` and `.dockerignore`.
- [ ] Remove tracked local AI-agent permissions and unrelated workspace paths.
- [ ] Add secret scanning before any push or pull request.
- [ ] Rewrite coordinated Git history after secrets are revoked and evidence is preserved.
- [ ] Invalidate old clones and require clean re-cloning.
- [ ] Delete and rebuild affected deployment artifacts and container images.

## 9. Application remediation checklist

- [ ] Authenticate and organization-scope every document download.
- [ ] Verify every external webhook signature and make handlers replay-safe.
- [ ] Redesign WhatsApp media retrieval so credentials never reach arbitrary hosts.
- [ ] Implement safe OAuth state, PKCE, encrypted token storage, and provider revocation.
- [ ] Implement bounded, verified, quarantined uploads with malware scanning.
- [ ] Move web sessions to secure `HttpOnly` cookies with rotation and revocation.
- [ ] Add rate limiting, abuse monitoring, and active-user checks.
- [ ] Redact logs and define log retention/access policies.
- [ ] Fix organization role-management authorization.
- [ ] Add security headers and restrict production API documentation.

## 10. CI and supply-chain checklist

- [ ] Pin and lock frontend and backend dependencies.
- [ ] Upgrade vulnerable packages in a known-clean environment.
- [ ] Pin Docker images by supported version and digest.
- [ ] Add unit, integration, tenant-isolation, webhook, upload-abuse, and authentication tests.
- [ ] Add secret, dependency, SAST, and container scanning.
- [ ] Add protected branches and required review.
- [ ] Add `CODEOWNERS` and `SECURITY.md`.
- [ ] Prevent unreviewed repository code from running automatically in local agents or CI.
- [ ] Require a clean build and deployment provenance record.

## 11. Module 0 completion gates

Module 0 is complete only when:

- [ ] The affected workstation and build environments have been contained or rebuilt.
- [ ] All potentially exposed credentials have been revoked and replaced.
- [ ] Provider and repository access logs have been reviewed.
- [ ] No malicious loader remains in active branches, tags, release artifacts, or images.
- [ ] No active secret or real customer document remains in Git.
- [ ] Public financial-file routes are removed or authenticated and organization-scoped.
- [ ] WhatsApp webhook signature verification and safe media retrieval are tested.
- [ ] OAuth state and token storage are remediated.
- [ ] Upload limits, content validation, quarantine, and malware scanning are operational.
- [ ] Authentication sessions, rate limits, and active-user enforcement are operational.
- [ ] Security CI passes on a clean checkout.
- [ ] Cross-organization negative tests pass.
- [ ] Privacy, incident, and remediation decisions are documented.
- [ ] A security owner signs off before deployment resumes.

## 12. Relationship to the V1 functionality roadmap

The product functionality sequence remains:

1. Module 1 — Canonical capture and intake foundation.
2. Module 2 — Manual upload first, followed by inbound email.
3. Module 3 — Transaction case and workflow engine.
4. Module 4 — Purchase Order understanding and normalization.
5. Modules 5–8 — Matching, validation, human review, and output generation.
6. Modules 9–11 — Self-onboarding, billing, and production operations.

Functionality specifications, schemas, UI flows, API contracts, and backlogs can be finalized while Module 0 is pending. Running, testing, building, or deploying the compromised frontend remains blocked until the immediate Module 0 containment work is completed.

## 13. External references

- GitHub — Removing sensitive data from a repository:  
  <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository>
- GitHub — Secret scanning:  
  <https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning>
- Google Threat Intelligence — DPRK use of EtherHiding:  
  <https://cloud.google.com/blog/topics/threat-intelligence/dprk-adopts-etherhiding>
- Public analysis matching the observed blockchain indicators:  
  <https://medium.com/@0xOZ/how-to-get-scammed-by-dprk-hackers-b2f7588aea76>

## 14. Change record

No application source code, credentials, customer data, Git history, remote repository settings, or external services were changed as part of this audit. This document records findings and recommended actions only.
