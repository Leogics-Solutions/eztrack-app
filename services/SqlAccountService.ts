import { getScopedHeaders } from './apiHelpers';
import { BASE_URL } from './config';

export interface SqlAccountConnection {
  id: number;
  organization_id: number;
  name: string;
  mode: 'api_call';
  api_url: string;
  company?: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  has_api_key: boolean;
  last_test_status?: string | null;
  last_test_message?: string | null;
  last_tested_at?: string | null;
  created_at?: string | null;
}

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    const detail = Array.isArray(error.detail) ? error.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(', ') : error.detail;
    throw new Error(detail || error.message || 'SQL Accounting request failed.');
  }
  return response.json();
}

export interface SqlAccountConnectionListResponse { connections: SqlAccountConnection[]; total: number }

export interface SqlAccountNumberSeriesItem {
  prefix: string;
  next_number: number;
  padding: number;
}

export interface SqlAccountNumberSeries {
  connection_id: number;
  configured: boolean;
  delivery_order: SqlAccountNumberSeriesItem;
  invoice: SqlAccountNumberSeriesItem;
}

export async function listSqlAccountConnections(): Promise<SqlAccountConnectionListResponse> {
  const result = await handle<{ items: Omit<SqlAccountConnection, 'mode'>[] }>(await fetch(`${BASE_URL}/sql-account/connections`, { headers: getScopedHeaders() }));
  const connections = result.items.map((item) => ({ ...item, mode: 'api_call' as const }));
  return { connections, total: connections.length };
}

export async function createSqlAccountConnection(input: { name: string; api_url: string; api_key: string; company?: string; config?: Record<string, unknown> }): Promise<SqlAccountConnection> {
  const result = await handle<Omit<SqlAccountConnection, 'mode'>>(await fetch(`${BASE_URL}/sql-account/connections`, { method: 'POST', headers: getScopedHeaders(), body: JSON.stringify(input) }));
  return { ...result, mode: 'api_call' };
}

export async function updateSqlAccountConnection(id: number, input: Partial<{ name: string; api_url: string; api_key: string; company: string; config: Record<string, unknown>; is_active: boolean }>): Promise<SqlAccountConnection> {
  const result = await handle<Omit<SqlAccountConnection, 'mode'>>(await fetch(`${BASE_URL}/sql-account/connections/${id}`, { method: 'PATCH', headers: getScopedHeaders(), body: JSON.stringify(input) }));
  return { ...result, mode: 'api_call' };
}

export async function testSqlAccountConnection(id: number): Promise<{ status: string; message: string; details: Record<string, unknown> }> {
  return handle(await fetch(`${BASE_URL}/sql-account/connections/${id}/test`, { method: 'POST', headers: getScopedHeaders() }));
}

export async function diagnoseSqlAccountCustomerPayment(id: number): Promise<Record<string, unknown>> {
  return handle(await fetch(`${BASE_URL}/sql-account/connections/${id}/payment-diagnostic`, { method: 'POST', headers: getScopedHeaders() }));
}

export async function getSqlAccountNumberSeries(id: number): Promise<SqlAccountNumberSeries | null> {
  const response = await fetch(`${BASE_URL}/sql-account/connections/${id}/number-series`, { headers: getScopedHeaders() });
  if (response.status === 404) return null;
  return handle(response);
}

export async function saveSqlAccountNumberSeries(
  id: number,
  input: Pick<SqlAccountNumberSeries, 'delivery_order' | 'invoice'>,
): Promise<SqlAccountNumberSeries> {
  return handle(await fetch(`${BASE_URL}/sql-account/connections/${id}/number-series`, {
    method: 'PUT', headers: getScopedHeaders(), body: JSON.stringify(input),
  }));
}

export async function deleteSqlAccountConnection(id: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/sql-account/connections/${id}`, { method: 'DELETE', headers: getScopedHeaders() });
  if (!response.ok) throw new Error('Could not remove SQL Accounting connection.');
}
