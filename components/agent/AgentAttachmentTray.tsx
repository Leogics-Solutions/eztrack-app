'use client';

import { FileText, Image as ImageIcon, Paperclip, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { formatAgentFileSize } from '@/services/agentAttachments';

interface AgentAttachmentTrayProps {
  files: File[];
  onRemove: (index: number) => void;
  onClear: () => void;
}

function fileIcon(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return FileText;
  if (/\.(png|jpg|jpeg|webp)$/.test(name)) return ImageIcon;
  return Paperclip;
}

export function AgentAttachmentTray({ files, onRemove, onClear }: AgentAttachmentTrayProps) {
  const { t } = useLanguage();
  if (files.length === 0) return null;

  const countLabel =
    files.length === 1
      ? t.agent.pendingFileCountOne
      : t.agent.pendingFileCountMany.replace('{count}', String(files.length));

  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted-foreground)' }}>
        <span>{countLabel}</span>
        {files.length > 1 && (
          <button type="button" onClick={onClear} className="underline-offset-2 hover:underline">
            {t.agent.clearAttachments}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {files.map((file, index) => {
          const Icon = fileIcon(file);
          return (
            <div
              key={`${file.name}-${file.size}-${index}`}
              className="flex max-w-full items-center gap-2 rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
            >
              <Icon className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium" style={{ color: 'var(--foreground)' }}>
                  {file.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {formatAgentFileSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="flex-shrink-0 rounded p-1"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
