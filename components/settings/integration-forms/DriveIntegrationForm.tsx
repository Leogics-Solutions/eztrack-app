import type { DriveConnection } from '@/services/SettingsService';
import type { Translations } from '@/lib/i18n/types';

type DriveLabels = Translations['settings']['integrations']['drive'];

export interface DriveIntegrationFormProps {
  labels: DriveLabels;
  enabled: boolean;
  connected: boolean;
  connections: DriveConnection[];
  folderIdsInput: string;
  isLoadingFolders: boolean;
  isSavingFolders: boolean;
  isConnecting: boolean;
  isSyncing: boolean;
  disconnectingId: number | null;
  onFolderIdsChange: (value: string) => void;
  onSaveFolders: () => void;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: (id: number) => void;
}

export function DriveIntegrationForm({
  labels: d,
  enabled,
  connected,
  connections,
  folderIdsInput,
  isLoadingFolders,
  isSavingFolders,
  isConnecting,
  isSyncing,
  disconnectingId,
  onFolderIdsChange,
  onSaveFolders,
  onConnect,
  onSync,
  onDisconnect,
}: DriveIntegrationFormProps) {
  if (!enabled) {
    return (
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        {d.notEnabledByAdmin}
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
                      {conn.email || `Connection ${conn.id}`}
                      {conn.last_sync_at && (
                        <span className="ml-2" style={{ color: 'var(--muted-foreground)' }}>
                          ({d.lastSync}: {new Date(conn.last_sync_at).toLocaleString()})
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
                      {disconnectingId === conn.id ? d.disconnecting : d.disconnect}
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
              {isConnecting ? d.connecting : d.connect}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              className="px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 border"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              {isSyncing ? d.syncing : d.syncNow}
            </button>
          )}
        </div>
      </div>
      <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
          {d.folderIds}
        </label>
        <p className="text-sm mb-2" style={{ color: 'var(--muted-foreground)' }}>
          {d.folderIdsDescription}
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={folderIdsInput}
            onChange={(e) => onFolderIdsChange(e.target.value)}
            placeholder="1a2b3c4d5e6f, anotherFolderId"
            disabled={isLoadingFolders}
            className="flex-1 min-w-[200px] px-3 py-2 border rounded-md text-sm"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card)',
              color: 'var(--foreground)',
            }}
          />
          <button
            type="button"
            onClick={onSaveFolders}
            disabled={isSavingFolders || isLoadingFolders}
            className="px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50 border"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            {isSavingFolders ? d.savingFolders : d.saveFolders}
          </button>
        </div>
      </div>
    </div>
  );
}
