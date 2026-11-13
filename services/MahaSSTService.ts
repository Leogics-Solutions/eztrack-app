import { BASE_URL } from './config';
import { getScopedHeaders, getScopedHeadersForFormData } from './apiHelpers';
import { redirectToLogin } from '@/lib/auth/authHelpers';

export interface SSTLine {
  description: string;
  quantity: string;
  uom: string;
  unit_price: string | null;
  autocount_code: string;
  origin: 'unconfirmed' | 'local' | 'import';
  customs_code: string;
}
export interface SSTCaseInput {
  customer_name: string;
  po_reference: string;
  appointment_reference: string;
  schedule: 'C3' | 'C4';
  notes: string;
  lines: SSTLine[];
}
export interface SSTCase extends SSTCaseInput {
  id: string;
  revision: number;
  created_at: string;
  updated_at: string;
  readiness: 'review_required';
  checks: { code: string; message: string }[];
  attachments: { id: string; kind: AttachmentKind; filename: string; size: number; sha256: string }[];
}
export type AttachmentKind = 'purchase_order' | 'appointment_letter' | 'certificate';
export interface SSTWorkspace {
  organization_id: number;
  company_name: string;
  can_edit: boolean;
  capabilities: Record<string, boolean>;
}
export interface SSTAudit {
  id: number;
  case_id: string | null;
  action: string;
  detail: string;
  user_id: number;
  created_at: string;
}
export class SSTError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
async function request<T>(organizationId: number, path: string, options: RequestInit = {}, multipart = false): Promise<T> {
  const headers = multipart ? getScopedHeadersForFormData() : getScopedHeaders();
  // Capture the company for this request, independently of later company switching.
  headers['X-Organization-Id'] = String(organizationId);
  const response = await fetch(`${BASE_URL}/maha-sst${path}`, { ...options, headers, cache: 'no-store' });
  if (response.status === 401) {
    redirectToLogin('/maha');
    throw new SSTError('Please sign in again.', 401);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const fallback = response.status === 404 || response.status === 502 || response.status === 503
      ? 'The C3/C4 service is not available yet. Your existing Smartdok data is unchanged.'
      : 'Unable to complete this request. Please try again.';
    throw new SSTError(typeof body.detail === 'string' ? body.detail : fallback, response.status);
  }
  return response.json() as Promise<T>;
}
export const MahaSSTService = {
  workspace: (org: number, signal?: AbortSignal) => request<SSTWorkspace>(org, '/workspace', { signal }),
  cases: (org: number, offset = 0, signal?: AbortSignal) => request<{ total: number; items: SSTCase[] }>(org, `/cases?offset=${offset}&limit=100`, { signal }),
  case: (org: number, id: string) => request<SSTCase>(org, `/cases/${encodeURIComponent(id)}`),
  create: (org: number, data: SSTCaseInput) => request<SSTCase>(org, '/cases', { method: 'POST', body: JSON.stringify(data) }),
  save: (org: number, id: string, data: SSTCaseInput, revision: number) => request<SSTCase>(org, `/cases/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ ...data, revision }) }),
  audit: (org: number, signal?: AbortSignal) => request<{ items: SSTAudit[] }>(org, '/audit', { signal }),
  attach: (org: number, id: string, kind: AttachmentKind, file: File) => {
    const data = new FormData(); data.append('file', file);
    return request(org, `/cases/${encodeURIComponent(id)}/attachments?kind=${kind}`, { method: 'POST', body: data }, true);
  },
  download: (org: number, id: string, attachment: string) => request<{ url: string }>(org, `/cases/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachment)}/download`),
};
