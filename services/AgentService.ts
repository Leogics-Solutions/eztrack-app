import { AGENT_BASE_URL } from './config';
import {
  AGENT_MAX_ATTACHMENTS,
  AGENT_MAX_FILE_BYTES,
  fileToBase64,
  isAcceptedAgentFile,
} from './agentAttachments';
import { getScopedHeaders } from './apiHelpers';

/** User + company context required by the agent service */
export interface AgentContext {
  user_id: string;
  company_id: string;
  session_id?: string | null;
}

export interface AgentAttachment {
  type: string;
  filename: string;
  mime: string;
  base64?: string;
  url?: string;
  s3_key?: string;
}

export interface AgentReplyBlock {
  type: string;
  content?: unknown;
}

export interface AgentButton {
  label: string;
  action: string;
  action_id?: string;
}

export interface AgentPendingAction {
  action_id: string;
  type: string;
  title?: string;
  description?: string;
  payload?: Record<string, unknown>;
}

export interface AgentReply {
  text: string;
  blocks?: AgentReplyBlock[];
  buttons?: AgentButton[];
  pending_action?: AgentPendingAction | null;
}

export interface AgentChatData {
  reply: string;
  session_id: string;
  blocks?: AgentReplyBlock[];
  buttons?: AgentButton[];
  pending_action?: AgentPendingAction | null;
}

export interface AgentMessageResponse {
  session_id: string;
  reply: AgentReply;
}

export interface AgentConfirmationResponse {
  session_id: string;
  reply: AgentReply;
}

export interface AgentConversationTurn {
  role: 'user' | 'clerk';
  text: string;
  at: string;
}

export interface SendAgentMessageParams {
  text: string;
  context: AgentContext;
  attachments?: AgentAttachment[];
  /** Prior turns only — exclude the current message in `text` */
  conversation_history?: AgentConversationTurn[];
}

export interface ResolveAgentConfirmationParams {
  action_id: string;
  resolution: 'approved' | 'rejected' | 'edited' | 'expired';
  context: AgentContext;
  edited_payload?: Record<string, unknown>;
}

function agentHeaders(): Record<string, string> {
  try {
    return getScopedHeaders();
  } catch {
    return { 'Content-Type': 'application/json' };
  }
}

function normalizeReply(data: AgentMessageResponse | AgentConfirmationResponse): AgentChatData {
  const reply = data.reply;
  return {
    reply: reply?.text ?? '',
    session_id: data.session_id ?? '',
    blocks: reply?.blocks,
    buttons: reply?.buttons,
    pending_action: reply?.pending_action ?? null,
  };
}

function guessMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function guessAttachmentType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpg|jpeg|webp)$/.test(lower)) return 'image';
  return 'file';
}

function createMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createAgentSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Map UI chat messages to agent conversation_history (excludes the message being sent). */
export function buildConversationHistory(
  messages: Array<{ role: 'user' | 'assistant'; text: string; timestamp: Date }>
): AgentConversationTurn[] {
  return messages.map((message) => ({
    role: message.role === 'assistant' ? 'clerk' : 'user',
    text: message.text,
    at: message.timestamp.toISOString(),
  }));
}

function formatAgentError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Failed to chat with Smartdok Agent';
  }
  const record = error as Record<string, unknown>;
  if (Array.isArray(record.detail)) {
    return record.detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          const loc = 'loc' in item && Array.isArray(item.loc) ? item.loc.join('.') : '';
          return loc ? `${loc}: ${String(item.msg)}` : String(item.msg);
        }
        return String(item);
      })
      .join('; ');
  }
  if (typeof record.detail === 'string') return record.detail;
  if (typeof record.message === 'string') return record.message;
  if (typeof record.error === 'string') return record.error;
  return 'Failed to chat with Smartdok Agent';
}

/** POST /agent/message — main chat entry (Ask / Do / Tell) */
export async function sendAgentMessage(
  params: SendAgentMessageParams
): Promise<AgentChatData> {
  const { text, context, attachments = [], conversation_history = [] } = params;
  const messageId = createMessageId();
  const sessionId = context.session_id || createAgentSessionId();

  const body: Record<string, unknown> = {
    company_id: context.company_id,
    user_id: context.user_id,
    channel: 'web',
    session_id: sessionId,
    message: {
      text,
      attachments,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      message_id: messageId,
    },
  };

  if (conversation_history.length > 0) {
    body.conversation_history = conversation_history;
  }

  const response = await fetch(`${AGENT_BASE_URL}/agent/message`, {
    method: 'POST',
    headers: agentHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(formatAgentError(error));
  }

  const json = (await response.json()) as AgentMessageResponse;
  const data = normalizeReply(json);
  if (!data.session_id) {
    data.session_id = sessionId;
  }
  return data;
}

/** POST /agent/confirmation-resolved — approve/reject pending actions */
export async function resolveAgentConfirmation(
  params: ResolveAgentConfirmationParams
): Promise<AgentChatData> {
  const body = {
    action_id: params.action_id,
    company_id: params.context.company_id,
    user_id: params.context.user_id,
    resolution: params.resolution,
    edited_payload: params.edited_payload,
    resolved_channel: 'web',
  };

  const response = await fetch(`${AGENT_BASE_URL}/agent/confirmation-resolved`, {
    method: 'POST',
    headers: agentHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(formatAgentError(error));
  }

  const json = (await response.json()) as AgentConfirmationResponse;
  return normalizeReply(json);
}

/** GET /health — agent service health check */
export async function checkAgentHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${AGENT_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/** Encode files as base64 attachments for agent vision (preferred over s3_key-only). */
export async function prepareAgentAttachmentsFromFiles(
  files: File[]
): Promise<AgentAttachment[]> {
  const batch = files.slice(0, AGENT_MAX_ATTACHMENTS);
  const attachments: AgentAttachment[] = [];

  for (const file of batch) {
    if (!isAcceptedAgentFile(file)) {
      throw new Error(`Unsupported file type: ${file.name}`);
    }
    if (file.size > AGENT_MAX_FILE_BYTES) {
      throw new Error(`File too large (max 5 MB): ${file.name}`);
    }

    const base64 = await fileToBase64(file);
    attachments.push({
      type: guessAttachmentType(file.name),
      filename: file.name,
      mime: file.type || guessMimeType(file.name),
      base64,
    });
  }

  return attachments;
}

/** @deprecated Use prepareAgentAttachmentsFromFiles for vision. S3-only uploads cannot be read by the agent. */
export async function uploadAgentAttachment(
  file: File
): Promise<AgentAttachment> {
  const [attachment] = await prepareAgentAttachmentsFromFiles([file]);
  return attachment;
}

/** @deprecated Use sendAgentMessage — kept for backward compatibility */
export async function chatWithAgent(payload: {
  message: string;
  session_id?: string | null;
  user_id: string;
  company_id: string;
  attachments?: AgentAttachment[];
}): Promise<{ success: boolean; data: AgentChatData }> {
  const data = await sendAgentMessage({
    text: payload.message,
    context: {
      user_id: payload.user_id,
      company_id: payload.company_id,
      session_id: payload.session_id,
    },
    attachments: payload.attachments,
  });
  return { success: true, data };
}
