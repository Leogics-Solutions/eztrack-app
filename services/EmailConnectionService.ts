import { getScopedHeaders } from './apiHelpers';
import { BASE_URL } from './config';

export interface EmailConnection {
  id: number;
  organization_id: number;
  name: string;
  provider: 'YAHOO' | 'CUSTOM' | string;
  email_address: string;
  username: string;
  imap_host: string;
  imap_port: number;
  imap_security: 'SSL_TLS' | 'STARTTLS';
  imap_folder: string;
  smtp_host: string;
  smtp_port: number;
  smtp_security: 'SSL_TLS' | 'STARTTLS';
  poll_interval_minutes: number;
  is_active: boolean;
  has_password: boolean;
  last_test_status?: string | null;
  last_test_message?: string | null;
  last_tested_at?: string | null;
  last_sync_status?: string | null;
  last_sync_error?: string | null;
  last_synced_at?: string | null;
  created_at?: string | null;
}

export interface EmailConnectionInput {
  name: string;
  provider: 'YAHOO' | 'CUSTOM';
  email_address: string;
  username?: string;
  password: string;
  imap_host: string;
  imap_port: number;
  imap_security: 'SSL_TLS' | 'STARTTLS';
  imap_folder: string;
  smtp_host: string;
  smtp_port: number;
  smtp_security: 'SSL_TLS' | 'STARTTLS';
  poll_interval_minutes: number;
}

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.message || 'Email connection request failed.');
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function listEmailConnections(): Promise<EmailConnection[]> {
  const response = await fetch(`${BASE_URL}/email/connections`, { headers: getScopedHeaders() });
  return (await handle<{ items: EmailConnection[] }>(response)).items;
}

export async function createEmailConnection(input: EmailConnectionInput): Promise<EmailConnection> {
  return handle<EmailConnection>(await fetch(`${BASE_URL}/email/connections`, {
    method: 'POST', headers: getScopedHeaders(), body: JSON.stringify(input),
  }));
}

export async function updateEmailConnection(id: number, input: Partial<EmailConnectionInput> & { is_active?: boolean }): Promise<EmailConnection> {
  return handle<EmailConnection>(await fetch(`${BASE_URL}/email/connections/${id}`, {
    method: 'PATCH', headers: getScopedHeaders(), body: JSON.stringify(input),
  }));
}

export async function testEmailConnection(id: number): Promise<{ status: string; message: string; imap: boolean; smtp: boolean }> {
  return handle(await fetch(`${BASE_URL}/email/connections/${id}/test`, { method: 'POST', headers: getScopedHeaders() }));
}

export async function syncEmailConnection(id: number): Promise<{ status: string; checked: number; matched: number; attachments: number; error_message?: string | null }> {
  return handle(await fetch(`${BASE_URL}/email/connections/${id}/sync`, { method: 'POST', headers: getScopedHeaders() }));
}

export async function deleteEmailConnection(id: number): Promise<void> {
  await handle<void>(await fetch(`${BASE_URL}/email/connections/${id}`, { method: 'DELETE', headers: getScopedHeaders() }));
}
