# Maha C3/C4 workspace

The Maha workspace is `/maha` in the existing Smartdok Next.js frontend. It uses
the existing AuthProvider, OrganizationProvider, AppLayout and Smartdok accounts.
The Maha deployment lands on this page at `https://maha.smartdok.ai`.

Implemented: authenticated case intake, PDF source attachments, manual PO line
review, revision conflict handling, case filtering, company-scoped activity and
a setup page. There are no seeded example cases, local SQLite data, mock API
fallbacks, browser credential prompts or automated MySST submissions.

Not yet implemented: automatic PO extraction, approved AutoCount matching and
UOM conversion, the on-site connector, browser preparation and C4 validation.
The UI and API deliberately leave these capabilities pending.

## Release

Build `Dockerfile.maha` as `smartdok-maha-ui:20261113`. The build uses the same
Next.js 16.3.6 / React 19.2.8 dependency versions already installed in the primary
Smartdok checkout. `NEXT_PUBLIC_WORKSPACE=maha` selects the dedicated landing and
login branding; it is not an authorization boundary.

The browser calls the same-origin `/maha-api` gateway. Shared login, user and
company APIs go to the existing `backend:8000`. C3/C4 calls go to the isolated
release process `maha-sst-api:8000`, running the module from the existing FastAPI
repository with the same JWT verifier, company membership, database and storage.
This avoids restarting the shared backend and does not duplicate its workers.

The production Compose overlay and migration instructions are in
`invoiceReaderBackend` on the matching `feature/maha-c3c4` branch. The deployment
uses the user's existing Docker/ngrok host; the host and Docker must stay online.

## Validation

- `node node_modules/typescript/bin/tsc --noEmit --pretty false`
- `next build --webpack` and the Linux production Docker build
- Unauthenticated workspace/profile API requests must return JSON 401, not login
  HTML. The gateway explicitly bypasses page redirects for this reason.
- Root on the Maha deployment must redirect to `/maha`, then to its login if
  unauthenticated. Forged page cookies must never authorize the backend.

Company data always comes from the backend. A missing service, missing company
membership or disabled enrollment renders a visible setup/access message.
