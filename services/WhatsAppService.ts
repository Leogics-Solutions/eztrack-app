import { getScopedHeaders } from './apiHelpers';
import { BASE_URL } from './config';

export interface WhatsAppConnection {
  id: number;
  name: string;
  status: string;
  qr_data_url?: string | null;
  phone_number?: string | null;
  last_error?: string | null;
  is_active: boolean;
  in_use: boolean;
  automation_names: string[];
  created_at?: string | null;
}

export interface WhatsAppGroup {
  jid: string;
  name: string;
  participant_count: number;
}

export interface WhatsAppBinding {
  connection_id: number;
  group_jid: string;
  group_name?: string | null;
  sql_connection_id?: number | null;
  sql_connection_ids?: number[];
  sql_routes?: Array<{ sql_connection_id: number; company_name?: string | null; company_key?: string | null; match_terms?: string[] }>;
  company_name?: string | null;
  company_key?: string | null;
}

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.message || 'WhatsApp request failed.');
  }
  return response.json();
}

export async function listWhatsAppConnections(): Promise<WhatsAppConnection[]> {
  const result = await handle<{ items: WhatsAppConnection[] }>(await fetch(`${BASE_URL}/whatsapp/connections`, { headers: getScopedHeaders() }));
  return result.items;
}

export async function createWhatsAppConnection(name: string): Promise<WhatsAppConnection> {
  return handle(await fetch(`${BASE_URL}/whatsapp/connections`, {
    method: 'POST', headers: getScopedHeaders(), body: JSON.stringify({ name }),
  }));
}

export async function getWhatsAppConnection(id: number): Promise<WhatsAppConnection> {
  return handle(await fetch(`${BASE_URL}/whatsapp/connections/${id}`, { headers: getScopedHeaders() }));
}

export async function connectWhatsApp(id: number): Promise<WhatsAppConnection> {
  return handle(await fetch(`${BASE_URL}/whatsapp/connections/${id}/connect`, { method: 'POST', headers: getScopedHeaders() }));
}

export async function disconnectWhatsApp(id: number): Promise<WhatsAppConnection> {
  return handle(await fetch(`${BASE_URL}/whatsapp/connections/${id}/disconnect`, { method: 'POST', headers: getScopedHeaders() }));
}

export async function deleteWhatsAppConnection(id: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/whatsapp/connections/${id}`, {
    method: 'DELETE', headers: getScopedHeaders(),
  });
  if (!response.ok) await handle(response);
}

export async function listWhatsAppGroups(id: number): Promise<WhatsAppGroup[]> {
  const result = await handle<{ groups: WhatsAppGroup[] }>(await fetch(`${BASE_URL}/whatsapp/connections/${id}/groups`, { headers: getScopedHeaders() }));
  return result.groups;
}

export async function setAutomationWhatsAppBindings(automationId: number, bindings: WhatsAppBinding[]): Promise<void> {
  await handle(await fetch(`${BASE_URL}/whatsapp/automations/${automationId}/bindings`, {
    method: 'PUT', headers: getScopedHeaders(), body: JSON.stringify({ bindings }),
  }));
}
