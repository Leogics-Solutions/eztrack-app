import { BASE_URL } from './config';
import { getScopedHeaders } from './apiHelpers';

export interface AgentChatRequest {
  message: string;
  session_id?: string | null;
  attached_file_s3_key?: string | null;
  attached_file_name?: string | null;
}

export interface AgentChatData {
  reply: string;
  session_id: string;
  tools_used: string[];
}

export interface AgentChatResponse {
  success: boolean;
  data: AgentChatData;
  message?: string;
  timestamp?: string;
}

export async function chatWithAgent(
  payload: AgentChatRequest
): Promise<AgentChatResponse> {
  const response = await fetch(`${BASE_URL}/agent/chat`, {
    method: 'POST',
    headers: getScopedHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to chat with Smartdok Agent');
  }

  return response.json();
}
