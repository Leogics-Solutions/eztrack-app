'use client';

import { Bot, User, Wrench } from 'lucide-react';
import type { AgentPendingAction } from '@/services/AgentService';
import { AgentPendingActionCard } from './AgentPendingActionCard';
import { AgentMarkdown } from './AgentMarkdown';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  attachment?: { filename: string };
  attachments?: Array<{ filename: string }>;
  pendingAction?: AgentPendingAction | null;
  toolsUsed?: string[];
}

interface AgentMessageBubbleProps {
  message: ChatMessage;
  onResolveAction?: (
    actionId: string,
    resolution: 'approved' | 'rejected',
    payload?: Record<string, unknown>
  ) => void;
  isResolving?: boolean;
  approveLabel: string;
  rejectLabel: string;
}

export function AgentMessageBubble({
  message,
  onResolveAction,
  isResolving,
  approveLabel,
  rejectLabel,
}: AgentMessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          background: isUser ? 'var(--primary)' : 'var(--secondary)',
          color: isUser ? 'var(--primary-foreground)' : 'var(--secondary-foreground)',
        }}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={`flex flex-col gap-2 ${isUser ? 'max-w-[80%] items-end' : 'max-w-[min(100%,42rem)] items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isUser ? 'whitespace-pre-wrap' : ''}`}
          style={{
            background: isUser ? 'var(--primary)' : 'var(--card)',
            color: isUser ? 'var(--primary-foreground)' : 'var(--card-foreground)',
            border: isUser ? 'none' : '1px solid var(--border)',
            borderTopLeftRadius: isUser ? undefined : '0.25rem',
            borderTopRightRadius: isUser ? '0.25rem' : undefined,
          }}
        >
          {(message.attachments?.length ? message.attachments : message.attachment ? [message.attachment] : []).map(
            (file, index) => (
              <div
                key={`${file.filename}-${index}`}
                className="mb-2 rounded-md px-2 py-1 text-xs"
                style={{
                  background: isUser ? 'rgba(255,255,255,0.15)' : 'var(--muted)',
                  color: isUser ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                }}
              >
                📎 {file.filename}
              </div>
            )
          )}
          {isUser ? message.text : <AgentMarkdown content={message.text} />}
        </div>

        {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-1 text-xs"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <Wrench className="h-3 w-3" />
            {message.toolsUsed.join(', ')}
          </div>
        )}

        {!isUser && message.pendingAction && onResolveAction && (
          <AgentPendingActionCard
            action={message.pendingAction}
            onApprove={(payload) =>
              onResolveAction(message.pendingAction!.action_id, 'approved', payload)
            }
            onReject={() => onResolveAction(message.pendingAction!.action_id, 'rejected')}
            isResolving={isResolving}
            approveLabel={approveLabel}
            rejectLabel={rejectLabel}
          />
        )}
      </div>
    </div>
  );
}
