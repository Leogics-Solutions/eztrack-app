import { getScopedHeaders } from './apiHelpers';
import { BASE_URL } from './config';

export interface WeChatConnection {
  id: number;
  name: string;
  status: string;
  account_id?: string | null;
  display_name?: string | null;
  client_version?: string | null;
  last_error?: string | null;
  is_active: boolean;
  created_at?: string | null;
}

export interface WeChatGroup { id: string; name: string; member_count: number }
export interface WeChatBinding { connection_id: number; group_id: string; group_name?: string | null }

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.message || 'WeChat request failed.');
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function listWeChatConnections(): Promise<WeChatConnection[]> {
  const result = await handle<{ items: WeChatConnection[] }>(await fetch(`${BASE_URL}/wechat/connections`, { headers: getScopedHeaders() }));
  return result.items;
}

export async function createWeChatConnection(name: string): Promise<WeChatConnection> {
  return handle(await fetch(`${BASE_URL}/wechat/connections`, { method: 'POST', headers: getScopedHeaders(), body: JSON.stringify({ name }) }));
}

export async function getWeChatConnection(id: number): Promise<WeChatConnection> {
  return handle(await fetch(`${BASE_URL}/wechat/connections/${id}`, { headers: getScopedHeaders() }));
}

export async function connectWeChat(id: number): Promise<WeChatConnection> {
  return handle(await fetch(`${BASE_URL}/wechat/connections/${id}/connect`, { method: 'POST', headers: getScopedHeaders() }));
}

export async function disconnectWeChat(id: number): Promise<WeChatConnection> {
  return handle(await fetch(`${BASE_URL}/wechat/connections/${id}/disconnect`, { method: 'POST', headers: getScopedHeaders() }));
}

export async function deleteWeChatConnection(id: number): Promise<void> {
  await handle(await fetch(`${BASE_URL}/wechat/connections/${id}`, { method: 'DELETE', headers: getScopedHeaders() }));
}

export async function listWeChatGroups(id: number): Promise<WeChatGroup[]> {
  const result = await handle<{ groups: WeChatGroup[] }>(await fetch(`${BASE_URL}/wechat/connections/${id}/groups`, { headers: getScopedHeaders() }));
  return result.groups;
}

export async function sendWeChatTestMessage(id: number, groupId: string, message = 'Smartdok WeChat connection test'): Promise<void> {
  await handle(await fetch(`${BASE_URL}/wechat/connections/${id}/test-message`, { method: 'POST', headers: getScopedHeaders(), body: JSON.stringify({ group_id: groupId, text: message }) }));
}

export async function setAutomationWeChatBindings(automationId: number, bindings: WeChatBinding[]): Promise<void> {
  await handle(await fetch(`${BASE_URL}/wechat/automations/${automationId}/bindings`, { method: 'PUT', headers: getScopedHeaders(), body: JSON.stringify({ bindings }) }));
}
