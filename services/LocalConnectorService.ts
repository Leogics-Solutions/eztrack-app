import { BASE_URL } from './config';
import { getScopedHeaders, getScopedHeadersForFormData } from './apiHelpers';

export const LOCAL_CONNECTORS_ENABLED = process.env.NEXT_PUBLIC_LOCAL_CONNECTOR_ENABLED === 'true';
const LOCAL_CONNECTOR_ORGANIZATION_ID = Number(process.env.NEXT_PUBLIC_LOCAL_CONNECTOR_ORGANIZATION_ID || '76');

export function canUseLocalConnectors(organizationId: number | null | undefined): boolean {
  return LOCAL_CONNECTORS_ENABLED
    && Number.isInteger(LOCAL_CONNECTOR_ORGANIZATION_ID)
    && organizationId === LOCAL_CONNECTOR_ORGANIZATION_ID;
}
const API = `${BASE_URL}/local-connectors`;

export interface ConnectorDevice {
  id: string; name: string; readiness: string; profile_hash: string | null;
  local_company_name: string | null; app_version: string | null;
  last_seen_at: string | null; revoked_at: string | null; token_expires_at: string;
}
export interface ConnectorMasterStatus {
  synced_at: string; source_company_directory: string;
  counts: { customer: number; supplier: number; item: number };
}
export interface ConnectorCompany { id: string; name: string; device: ConnectorDevice | null; masters: ConnectorMasterStatus | null }
export interface ConnectorJob {
  id: string; invoice_id: number | null; invoice_no: string; kind: string; status: string;
  total: string; created_at: string; error_code: string | null;
  result: { ubs_reference?: string; status?: string } | null;
}
export interface InvoiceMappingLine { line_id: number; item_code: string; uom: string }
export interface ConnectorPreview {
  invoice_id: number; invoice_no: string; status: string; direction: string;
  total: string; currency: string; party_name: string | null;
  suggested_party_code: string | null;
  lines: (InvoiceMappingLine & { description: string; quantity: string; unit_price: string; total: string })[];
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(API + path, {
    method: body === undefined ? 'GET' : 'POST', headers: getScopedHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.detail === 'string' ? data.detail : typeof data.message === 'string' ? data.message : `Connector request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

export const connectorCompanies = () => request<{ role: string; companies: ConnectorCompany[] }>('/companies');
export const createConnectorCompany = (name: string) => request<{ id: string; name: string }>('/companies', { name });
export const createConnectorPairing = (id: string) => request<{ code: string; expires_at: string; company_name: string }>(`/companies/${encodeURIComponent(id)}/pairing`, {});
export const revokeConnector = (id: string) => request(`/devices/${encodeURIComponent(id)}/revoke`, {});
export const connectorJobs = (id: string) => request<{ jobs: ConnectorJob[] }>(`/companies/${encodeURIComponent(id)}/jobs`);
export const connectorPreview = (id: number, company?: string) => request<ConnectorPreview>(`/invoices/${id}/preview${company ? `?company_id=${encodeURIComponent(company)}` : ''}`);
export async function importConnectorMasters(company: string, file: File) {
  const form = new FormData(); form.append('file', file);
  const response = await fetch(`${API}/companies/${encodeURIComponent(company)}/masters/import`, {
    method: 'POST', headers: getScopedHeadersForFormData(), body: form, cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `Master import failed (${response.status})`);
  return data as { company_id: string; synced_at: string; source_company_directory: string; counts: { customers: number; suppliers: number; items: number } };
}
export const enqueueConnectorInvoice = (company: string, invoice: number, party: string, lines: InvoiceMappingLine[]) =>
  request<ConnectorJob>(`/companies/${encodeURIComponent(company)}/jobs`, { invoice_id: invoice, party_code: party, lines });
export const cancelConnectorJob = (id: string) => request<ConnectorJob>(`/jobs/${encodeURIComponent(id)}/cancel`, {});
export const closeConnectorReview = (id: string) => request<ConnectorJob>(`/jobs/${encodeURIComponent(id)}/close-review`, {});
