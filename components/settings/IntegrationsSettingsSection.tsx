import { useMemo, useState, type ReactNode } from 'react';
import {
  IntegrationCatalogCard,
  IntegrationCategoryGrid,
  IntegrationConfigModal,
  type IntegrationCatalogStatus,
} from '@/components/settings/IntegrationCatalog';
import { GmailIntegrationForm } from '@/components/settings/integration-forms/GmailIntegrationForm';
import { DriveIntegrationForm } from '@/components/settings/integration-forms/DriveIntegrationForm';
import { BukkuIntegrationForm } from '@/components/settings/integration-forms/BukkuIntegrationForm';
import type { GmailConnection, DriveConnection } from '@/services/SettingsService';
import type {
  BukkuConnection,
  BukkuConnectionStatus,
  BukkuTestConnectionResponse,
} from '@/services/BukkuService';
import type { Translations } from '@/lib/i18n/types';

type IntegrationLabels = Translations['settings']['integrations'];

export type IntegrationId = 'gmail' | 'drive' | 'bukku';

interface CatalogEntry {
  id: IntegrationId;
  category: 'input' | 'accounting';
  icon: string;
  title: string;
  description: string;
  status: IntegrationCatalogStatus;
  statusLabel: string;
  actionLabel: string;
  canOpen: boolean;
  renderForm: () => ReactNode;
}

export interface IntegrationsSettingsSectionProps {
  labels: IntegrationLabels;
  isLoadingSettings: boolean;
  isAdmin: boolean;
  hasOrganization: boolean;
  gmail: {
    enabled: boolean;
    connected: boolean;
    connections: GmailConnection[];
    keywordsInput: string;
    maxMessagesInput: string;
    isLoadingKeywords: boolean;
    isSavingKeywords: boolean;
    isConnecting: boolean;
    isSyncing: boolean;
    disconnectingId: number | null;
    onKeywordsChange: (value: string) => void;
    onMaxMessagesChange: (value: string) => void;
    onSaveKeywords: () => void;
    onConnect: () => void;
    onSync: () => void;
    onDisconnect: (id: number) => void;
  };
  drive: {
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
  };
  bukku: {
    connected: boolean;
    activeConnection: BukkuConnection | null;
    connectionStatus: BukkuConnectionStatus | null;
    isLoadingStatus: boolean;
    subdomain: string;
    accessToken: string;
    environment: 'production' | 'staging';
    dateFrom: string;
    syncAccounts: boolean;
    syncContacts: boolean;
    syncSales: boolean;
    syncPurchase: boolean;
    testResult: BukkuTestConnectionResponse | null;
    isTesting: boolean;
    isSaving: boolean;
    isSyncing: boolean;
    isDisconnecting: boolean;
    onSubdomainChange: (value: string) => void;
    onAccessTokenChange: (value: string) => void;
    onEnvironmentChange: (value: 'production' | 'staging') => void;
    onDateFromChange: (value: string) => void;
    onSyncAccountsChange: (value: boolean) => void;
    onSyncContactsChange: (value: boolean) => void;
    onSyncSalesChange: (value: boolean) => void;
    onSyncPurchaseChange: (value: boolean) => void;
    onTest: () => void;
    onSave: () => void;
    onSync: () => void;
    onDisconnect: () => void;
  };
}

export function IntegrationsSettingsSection({
  labels,
  isLoadingSettings,
  isAdmin,
  hasOrganization,
  gmail,
  drive,
  bukku,
}: IntegrationsSettingsSectionProps) {
  const [activeId, setActiveId] = useState<IntegrationId | null>(null);
  const c = labels.catalog;

  const catalog = useMemo((): CatalogEntry[] => {
    const g = labels.gmail;
    const d = labels.drive;
    const b = labels.bukku;

    const gmailStatus: IntegrationCatalogStatus = !gmail.enabled
      ? 'disabled'
      : gmail.connected
        ? 'connected'
        : 'disconnected';

    const driveStatus: IntegrationCatalogStatus = !drive.enabled
      ? 'disabled'
      : drive.connected
        ? 'connected'
        : 'disconnected';

    const bukkuStatus: IntegrationCatalogStatus =
      !hasOrganization || !isAdmin
        ? 'locked'
        : bukku.connected
          ? 'connected'
          : 'disconnected';

    return [
      {
        id: 'gmail',
        category: 'input',
        icon: '📧',
        title: g.title,
        description: g.description,
        status: gmailStatus,
        statusLabel:
          gmailStatus === 'disabled'
            ? c.disabledByAdmin
            : gmail.connected
              ? g.connected
              : g.notConnected,
        actionLabel: gmail.connected ? c.manage : c.configure,
        canOpen: true,
        renderForm: () => <GmailIntegrationForm labels={g} {...gmail} />,
      },
      {
        id: 'drive',
        category: 'input',
        icon: '📁',
        title: d.title,
        description: d.description,
        status: driveStatus,
        statusLabel:
          driveStatus === 'disabled'
            ? c.disabledByAdmin
            : drive.connected
              ? d.connected
              : d.notConnected,
        actionLabel: drive.connected ? c.manage : c.configure,
        canOpen: true,
        renderForm: () => <DriveIntegrationForm labels={d} {...drive} />,
      },
      {
        id: 'bukku',
        category: 'accounting',
        icon: '📒',
        title: b.title,
        description: b.description,
        status: bukkuStatus,
        statusLabel:
          bukkuStatus === 'locked'
            ? c.adminRequired
            : bukku.connected
              ? bukku.activeConnection
                ? `${b.connected}: ${bukku.activeConnection.company_subdomain}`
                : b.connected
              : b.notConnected,
        actionLabel: bukku.connected ? c.manage : c.configure,
        canOpen: hasOrganization && isAdmin,
        renderForm: () => <BukkuIntegrationForm labels={b} {...bukku} />,
      },
    ];
  }, [labels, gmail, drive, bukku, hasOrganization, isAdmin, c]);

  const activeEntry = activeId ? catalog.find((e) => e.id === activeId) : null;
  const inputEntries = catalog.filter((e) => e.category === 'input');
  const accountingEntries = catalog.filter((e) => e.category === 'accounting');

  return (
    <>
      <div
        className="rounded-lg border lg:col-span-2"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="text-3xl" aria-hidden>
              🔌
            </div>
            <div>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                {labels.title}
              </h3>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {labels.description}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {isLoadingSettings ? (
            <div className="text-center py-8" style={{ color: 'var(--muted-foreground)' }}>
              {labels.businessCentral.loading}
            </div>
          ) : (
            <div className="space-y-10">
              <IntegrationCategoryGrid
                icon="📥"
                title={labels.inputSources.title}
                description={labels.inputSources.description}
              >
                {inputEntries.map((entry) => (
                  <IntegrationCatalogCard
                    key={entry.id}
                    icon={entry.icon}
                    title={entry.title}
                    description={entry.description}
                    status={entry.status}
                    statusLabel={entry.statusLabel}
                    actionLabel={entry.actionLabel}
                    disabled={!entry.canOpen}
                    onAction={() => entry.canOpen && setActiveId(entry.id)}
                  />
                ))}
              </IntegrationCategoryGrid>

              <div className="pt-8 border-t" style={{ borderColor: 'var(--border)' }}>
                <IntegrationCategoryGrid
                  icon="📤"
                  title={labels.accountingOutput.title}
                  description={labels.accountingOutput.description}
                >
                  {accountingEntries.map((entry) => (
                    <IntegrationCatalogCard
                      key={entry.id}
                      icon={entry.icon}
                      title={entry.title}
                      description={entry.description}
                      status={entry.status}
                      statusLabel={entry.statusLabel}
                      actionLabel={entry.canOpen ? entry.actionLabel : c.adminRequired}
                      disabled={!entry.canOpen}
                      onAction={() => entry.canOpen && setActiveId(entry.id)}
                    />
                  ))}
                </IntegrationCategoryGrid>
              </div>
            </div>
          )}
        </div>
      </div>

      <IntegrationConfigModal
        open={!!activeEntry}
        icon={activeEntry?.icon ?? '🔌'}
        title={activeEntry?.title ?? ''}
        description={activeEntry?.description ?? ''}
        closeLabel={c.close}
        onClose={() => setActiveId(null)}
      >
        {activeEntry?.renderForm()}
      </IntegrationConfigModal>
    </>
  );
}
