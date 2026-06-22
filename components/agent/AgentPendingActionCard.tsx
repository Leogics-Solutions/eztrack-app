'use client';

import { AlertCircle, Check, X } from 'lucide-react';
import type { AgentPendingAction } from '@/services/AgentService';

interface AgentPendingActionCardProps {
  action: AgentPendingAction;
  onApprove: (payload?: Record<string, unknown>) => void;
  onReject: () => void;
  isResolving?: boolean;
  approveLabel: string;
  rejectLabel: string;
}

export function AgentPendingActionCard({
  action,
  onApprove,
  onReject,
  isResolving,
  approveLabel,
  rejectLabel,
}: AgentPendingActionCardProps) {
  return (
    <div
      className="w-full max-w-md rounded-lg border p-4"
      style={{
        background: 'var(--warning-light)',
        borderColor: 'var(--warning)',
        color: 'var(--foreground)',
      }}
    >
      <div className="mb-3 flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: 'var(--warning-dark)' }} />
        <div>
          <p className="text-sm font-medium">
            {action.title || 'Confirmation required'}
          </p>
          {action.description && (
            <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {action.description}
            </p>
          )}
          {action.type && (
            <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {action.type}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isResolving}
          onClick={() => onApprove(action.payload)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            background: 'var(--success)',
            color: 'var(--primary-foreground)',
          }}
        >
          <Check className="h-4 w-4" />
          {approveLabel}
        </button>
        <button
          type="button"
          disabled={isResolving}
          onClick={onReject}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            background: 'var(--card)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
          }}
        >
          <X className="h-4 w-4" />
          {rejectLabel}
        </button>
      </div>
    </div>
  );
}
