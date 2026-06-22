import type { GmailConnection } from '@/services/SettingsService';
import type { Translations } from '@/lib/i18n/types';

type GmailLabels = Translations['settings']['integrations']['gmail'];

export interface GmailIntegrationFormProps {
  labels: GmailLabels;
  enabled: boolean;
  connected: boolean;
  connections: GmailConnection[];
  keywordsInput: string;
  isLoadingKeywords: boolean;
  isSavingKeywords: boolean;
  isConnecting: boolean;
  isSyncing: boolean;
  disconnectingId: number | null;
  onKeywordsChange: (value: string) => void;
  onSaveKeywords: () => void;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: (id: number) => void;
}

export function GmailIntegrationForm({
  labels: g,
  enabled,
  connected,
  connections,
  keywordsInput,
  isLoadingKeywords,
  isSavingKeywords,
  isConnecting,
  isSyncing,
  disconnectingId,
  onKeywordsChange,
  onSaveKeywords,
  onConnect,
  onSync,
  onDisconnect,
}: GmailIntegrationFormProps) {
  if (!enabled) {
    return (
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        {g.notEnabledByAdmin}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1 min-w-0 flex-1">
          {connected && connections.length > 0 && (
            <ul className="text-sm space-y-1" style={{ color: 'var(--foreground)' }}>
              {connections
                .filter((c) => c.is_active)
                .map((conn) => (
                  <li key={conn.id} className="flex items-center gap-2 flex-wrap">
                    <span>
                      {conn.email}
                      {conn.last_sync_at && (
                        <span className="ml-2" style={{ color: 'var(--muted-foreground)' }}>
                          ({g.lastSync}: {new Date(conn.last_sync_at).toLocaleString()})
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDisconnect(conn.id)}
                      disabled={disconnectingId === conn.id}
                      className="text-sm px-2 py-1 rounded border transition-colors disabled:opacity-50"
                      style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                    >
                      {disconnectingId === conn.id ? g.disconnecting : g.disconnect}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {!connected ? (
            <button
              type="button"
              onClick={onConnect}
              disabled={isConnecting}
              className="px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {isConnecting ? g.connecting : g.connect}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              className="px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 border"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              {isSyncing ? g.syncing : g.syncNow}
            </button>
          )}
        </div>
      </div>
      <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
          {g.ingestKeywords}
        </label>
        <p className="text-sm mb-2" style={{ color: 'var(--muted-foreground)' }}>
          {g.ingestKeywordsDescription}
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={keywordsInput}
            onChange={(e) => onKeywordsChange(e.target.value)}
            placeholder="invoice, receipt, statement"
            disabled={isLoadingKeywords}
            className="flex-1 min-w-[200px] px-3 py-2 border rounded-md text-sm"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card)',
              color: 'var(--foreground)',
            }}
          />
          <button
            type="button"
            onClick={onSaveKeywords}
            disabled={isSavingKeywords || isLoadingKeywords}
            className="px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 border"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            {isSavingKeywords ? g.savingKeywords : g.saveKeywords}
          </button>
        </div>
      </div>
    </div>
  );
}
