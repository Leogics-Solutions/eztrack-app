import type {
  BukkuConnection,
  BukkuConnectionStatus,
  BukkuTestConnectionResponse,
} from '@/services/BukkuService';
import type { Translations } from '@/lib/i18n/types';

type BukkuLabels = Translations['settings']['integrations']['bukku'];

export interface BukkuIntegrationFormProps {
  labels: BukkuLabels;
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
}

export function BukkuIntegrationForm({
  labels: b,
  connected,
  activeConnection,
  connectionStatus,
  isLoadingStatus,
  subdomain,
  accessToken,
  environment,
  dateFrom,
  syncAccounts,
  syncContacts,
  syncSales,
  syncPurchase,
  testResult,
  isTesting,
  isSaving,
  isSyncing,
  isDisconnecting,
  onSubdomainChange,
  onAccessTokenChange,
  onEnvironmentChange,
  onDateFromChange,
  onSyncAccountsChange,
  onSyncContactsChange,
  onSyncSalesChange,
  onSyncPurchaseChange,
  onTest,
  onSave,
  onSync,
  onDisconnect,
}: BukkuIntegrationFormProps) {
  return (
    <div className="space-y-5">
      {connected && connectionStatus && !isLoadingStatus && (
        <div
          className="p-4 rounded-md border text-sm space-y-2"
          style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}
        >
          {activeConnection?.last_sync_at && (
            <div style={{ color: 'var(--muted-foreground)' }}>
              {b.lastSync}: {new Date(activeConnection.last_sync_at).toLocaleString()}
            </div>
          )}
          <div>
            <span className="font-medium">{b.mappingCounts}: </span>
            {connectionStatus.mapping_counts.account} {b.accounts},{' '}
            {connectionStatus.mapping_counts.contact} {b.contacts},{' '}
            {connectionStatus.mapping_counts.sale_invoice} {b.salesInvoices},{' '}
            {connectionStatus.mapping_counts.purchase_bill} {b.purchaseBills}
          </div>
          <div style={{ color: 'var(--muted-foreground)' }}>
            {b.readyToPush}: {connectionStatus.ready_to_push_count}
          </div>
        </div>
      )}
      {connected && isLoadingStatus && (
        <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {b.loadingStatus}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
            {b.companySubdomain} *
          </label>
          <input
            type="text"
            value={subdomain}
            onChange={(e) => onSubdomainChange(e.target.value)}
            placeholder={b.companySubdomainPlaceholder}
            className="w-full px-3 py-2 border rounded-md text-sm"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card)',
              color: 'var(--foreground)',
            }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
            {b.accessToken} {!connected && '*'}
          </label>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => onAccessTokenChange(e.target.value)}
            placeholder={connected ? b.tokenKeepBlank : b.accessTokenPlaceholder}
            className="w-full px-3 py-2 border rounded-md text-sm"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card)',
              color: 'var(--foreground)',
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
            {b.environment}
          </label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="bukku-environment"
                checked={environment === 'production'}
                onChange={() => onEnvironmentChange('production')}
              />
              {b.production}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="bukku-environment"
                checked={environment === 'staging'}
                onChange={() => onEnvironmentChange('staging')}
              />
              {b.staging}
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
            {b.dateFrom}
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card)',
              color: 'var(--foreground)',
            }}
          />
        </div>
      </div>

      <div>
        <div className="text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
          {b.syncOptions}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={syncAccounts}
              onChange={(e) => onSyncAccountsChange(e.target.checked)}
            />
            {b.syncAccounts}
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={syncContacts}
              onChange={(e) => onSyncContactsChange(e.target.checked)}
            />
            {b.syncContacts}
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={syncSales}
              onChange={(e) => onSyncSalesChange(e.target.checked)}
            />
            {b.syncSalesInvoices}
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={syncPurchase}
              onChange={(e) => onSyncPurchaseChange(e.target.checked)}
            />
            {b.syncPurchaseBills}
          </label>
        </div>
      </div>

      {testResult && (
        <div
          className={`p-3 rounded-md border text-sm ${
            testResult.status === 'success'
              ? 'border-green-300 bg-green-50 dark:bg-green-900/20'
              : 'border-red-300 bg-red-50 dark:bg-red-900/20'
          }`}
        >
          {testResult.message}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onTest}
          disabled={isTesting || isSaving || isSyncing}
          className="px-4 py-2 rounded-md text-sm border transition-colors disabled:opacity-50"
          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
        >
          {isTesting ? b.testingConnection : b.testConnection}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || isTesting || isSyncing}
          className="px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {isSaving ? b.saving : connected ? b.updateCredentials : b.saveAndSync}
        </button>
        {connected && (
          <>
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing || isSaving || isTesting}
              className="px-4 py-2 rounded-md text-sm border transition-colors disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              {isSyncing ? b.syncing : b.syncNow}
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              disabled={isDisconnecting || isSaving}
              className="px-4 py-2 rounded-md text-sm border transition-colors disabled:opacity-50 hover:border-red-500 hover:text-red-600"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              {isDisconnecting ? b.disconnecting : b.disconnect}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
