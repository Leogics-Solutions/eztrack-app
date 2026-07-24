/** Client for the SQL Account SDK Live connection settings.
 *
 * Credentials are deliberately never returned by the API; the agent editor only
 * selects an already-configured connection and can safely test it.
 */
import { BASE_URL } from './config';
import { getScopedHeaders } from './apiHelpers';

export interface SqlAccountConnection {
  id: number;
  name?: string | null;
  mode: string;
  api_url?: string | null;
  company?: string | null;
  config?: Record<string, unknown> | null;
  is_active: boolean;
  last_push_at?: string | null;
}

export interface SqlAccountConnectionListResponse {
  connections: SqlAccountConnection[];
  total: number;
}

export interface SqlAccountTestResponse {
  status: 'success' | 'error' | 'not_implemented' | string;
  message: string;
  mode?: string | null;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || error.detail || 'Request failed');
  }
  return res.json();
}

export async function listSqlAccountConnections(): Promise<SqlAccountConnectionListResponse> {
  const res = await fetch(`${BASE_URL}/sql-account/connections`, { headers: getScopedHeaders() });
  return handle<SqlAccountConnectionListResponse>(res);
}

export async function testSqlAccountConnection(connectionId: number): Promise<SqlAccountTestResponse> {
  const res = await fetch(`${BASE_URL}/sql-account/test-connection`, {
    method: 'POST',
    headers: getScopedHeaders(),
    body: JSON.stringify({ connection_id: connectionId }),
  });
  return handle<SqlAccountTestResponse>(res);
}

/** Update non-secret SQL Account connection settings. API keys are never read back. */
export async function updateSqlAccountConnection(connectionId: number, payload: Pick<SqlAccountConnection, 'api_url'>): Promise<SqlAccountConnection> {
  const res = await fetch(`${BASE_URL}/sql-account/connections/${connectionId}`, {
    method: 'PATCH', headers: getScopedHeaders(), body: JSON.stringify(payload),
  });
  return handle<SqlAccountConnection>(res);
}
