import { getScopedHeaders, getScopedHeadersForFormData } from './apiHelpers';
import { BASE_URL } from './config';

export type CollectionReviewStatus = 'PENDING_APPROVAL' | 'PAUSED' | 'APPROVED' | 'HELD';

export interface CollectionInvoice {
  statement_date: string;
  customer_code: string;
  customer: string;
  customer_email: string;
  payment_terms: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  original_amount: number;
  outstanding_amount: number;
  currency: string;
  collection_status: string;
  promise_to_pay_date?: string | null;
  dispute_reason?: string | null;
  days_overdue: number;
}

export interface CollectionCase {
  customer_code: string;
  customer: string;
  customer_email: string;
  payment_terms: string;
  statement_date: string;
  currency: string;
  total_outstanding: number;
  oldest_days_overdue: number;
  stage: string;
  next_action: string;
  pause_reason?: string | null;
  review_status: CollectionReviewStatus;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  review_note?: string | null;
  output_type: string;
  output_status: string;
  draft_subject?: string | null;
  draft_body?: string | null;
  invoices: CollectionInvoice[];
}

export interface CollectionImport {
  id: string;
  status: string;
  created_at?: string | null;
  source_filename: string;
  statement_date: string;
  total_outstanding: number;
  customer_count: number;
  pending_approval_count: number;
  paused_count: number;
  cases: CollectionCase[];
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || body.message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function listCollectionImports(): Promise<CollectionImport[]> {
  const response = await fetch(`${BASE_URL}/collections/imports`, { headers: getScopedHeaders() });
  return (await parse<{ items: CollectionImport[] }>(response)).items;
}

export async function importCollectionAgeing(file: File): Promise<CollectionImport> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${BASE_URL}/collections/imports`, {
    method: 'POST',
    headers: getScopedHeadersForFormData(),
    body: form,
  });
  return parse<CollectionImport>(response);
}

export async function reviewCollectionCase(importId: string, customerCode: string, action: 'APPROVE' | 'HOLD', note?: string): Promise<CollectionCase> {
  const response = await fetch(`${BASE_URL}/collections/imports/${encodeURIComponent(importId)}/cases/${encodeURIComponent(customerCode)}`, {
    method: 'PATCH',
    headers: getScopedHeaders(),
    body: JSON.stringify({ action, note: note || null }),
  });
  return parse<CollectionCase>(response);
}

export async function deleteCollectionImport(importId: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/collections/imports/${encodeURIComponent(importId)}`, {
    method: 'DELETE',
    headers: getScopedHeaders(),
  });
  if (!response.ok) await parse(response);
}

export async function downloadCollectionSoa(importId: string, customerCode: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/collections/imports/${encodeURIComponent(importId)}/cases/${encodeURIComponent(customerCode)}/soa.pdf`, {
    headers: getScopedHeaders(),
  });
  if (!response.ok) await parse(response);
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `SOA_${customerCode}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
