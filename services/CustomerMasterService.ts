import { BASE_URL } from './config';
import { getScopedHeaders } from './apiHelpers';

export interface CustomerForm {
  company_name: string; registration_no: string; branch_name: string; address_lines: string[];
  country: string; postcode: string; city: string; state: string; attention: string;
  phone: string; mobile: string; email: string; agent: string; tin: string;
}
export interface SavedCustomer extends CustomerForm {
  code: string; control_account: string; credit_term: string; submission_type: string;
}
export interface CustomerPlan { operation: 'CREATE' | 'UPDATE'; code: string; customer: CustomerForm; before: SavedCustomer | null }
export interface CustomerChange {
  id: string; status: string; connection_id: number; native_plan: CustomerPlan;
  readback?: SavedCustomer; confirmed_by?: number; confirmed_at?: string; resume_error?: string;
}
export interface CustomerContext {
  companies: { connection_id: number; name: string }[]; connection_id: number | null;
  order_connection_id: number | null; prefill: CustomerForm; last_change?: CustomerChange;
  can_resume_order: boolean;
  native?: { customer?: SavedCustomer; matches: { CODE: string; COMPANYNAME: string; BRN2: string; STATUS: string }[];
    agents: { CODE: string; DESCRIPTION: string }[]; truncated: boolean };
}
export interface CustomerPreview { ready: boolean; preview_id?: string; expires_at?: string; plan?: CustomerPlan;
  duplicates?: { CODE: string; COMPANYNAME: string; BRN2: string; STATUS: string }[] }
export interface CustomerResult { status: string; readback: SavedCustomer; resumed: boolean; resume_error?: string;
  confirmed_by?: number; confirmed_at?: string; note?: string }

async function request<T>(runId: number, suffix: string, body?: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}/agents/runs/${runId}/customer-master${suffix}`, {
    headers: getScopedHeaders(), ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(typeof value.detail === 'string' ? value.detail : value.detail?.message || 'Customer maintenance request failed.');
  return value;
}
export function customerContext(runId: number, connectionId?: number, code = '', search = '') {
  const query = new URLSearchParams({ code, search });
  if (connectionId) query.set('connection_id', String(connectionId));
  return request<CustomerContext>(runId, `?${query}`);
}
export function previewCustomer(runId: number, connectionId: number, operation: 'CREATE' | 'UPDATE', code: string, customer: CustomerForm) {
  return request<CustomerPreview>(runId, '/preview', { connection_id: connectionId, operation, code, customer });
}
export function confirmCustomer(runId: number, previewId: string, resume: boolean, checkOnly = false) {
  return request<CustomerResult>(runId, '/confirm', { preview_id: previewId, confirmed: true, resume_order: resume, check_only: checkOnly });
}
