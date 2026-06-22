import type { ReactNode } from 'react';

export type IntegrationCatalogStatus =
  | 'connected'
  | 'disconnected'
  | 'disabled'
  | 'locked';

interface IntegrationCatalogCardProps {
  icon: string;
  title: string;
  description: string;
  status: IntegrationCatalogStatus;
  statusLabel: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}

const STATUS_STYLES: Record<IntegrationCatalogStatus, string> = {
  connected:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  disconnected:
    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  disabled:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  locked:
    'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

/** Compact tile for the integrations catalog grid */
export function IntegrationCatalogCard({
  icon,
  title,
  description,
  status,
  statusLabel,
  actionLabel,
  onAction,
  disabled = false,
}: IntegrationCatalogCardProps) {
  return (
    <div
      className={`flex flex-col rounded-lg border h-full min-h-[148px] transition-shadow ${
        disabled ? 'opacity-70' : 'hover:shadow-sm'
      }`}
      style={{
        borderColor: 'var(--border)',
        background: 'var(--background)',
      }}
    >
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-2xl shrink-0" aria-hidden>
            {icon}
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUS_STYLES[status]}`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
            {title}
          </h4>
          <p
            className="text-xs mt-1 line-clamp-2"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {description}
          </p>
        </div>
      </div>
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className="w-full px-3 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border"
          style={{
            borderColor: 'var(--border)',
            color: disabled ? 'var(--muted-foreground)' : 'var(--foreground)',
          }}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

interface IntegrationCategoryGridProps {
  icon: string;
  title: string;
  description: string;
  children: ReactNode;
}

/** Category header + responsive grid of integration tiles */
export function IntegrationCategoryGrid({
  icon,
  title,
  description,
  children,
}: IntegrationCategoryGridProps) {
  return (
    <section>
      <div className="mb-4">
        <h3
          className="text-base font-semibold flex items-center gap-2"
          style={{ color: 'var(--foreground)' }}
        >
          <span aria-hidden>{icon}</span>
          {title}
        </h3>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {description}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{children}</div>
    </section>
  );
}

interface IntegrationConfigModalProps {
  open: boolean;
  icon: string;
  title: string;
  description: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

/** Modal shell for integration configuration (keeps settings page height fixed) */
export function IntegrationConfigModal({
  open,
  icon,
  title,
  description,
  closeLabel,
  onClose,
  children,
}: IntegrationConfigModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl"
        style={{
          background: 'var(--card)',
          borderColor: 'var(--border)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="integration-config-title"
      >
        <div
          className="px-6 py-4 border-b flex items-start justify-between gap-4 shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-2xl shrink-0" aria-hidden>
              {icon}
            </span>
            <div className="min-w-0">
              <h3
                id="integration-config-title"
                className="text-lg font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                {title}
              </h3>
              <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none shrink-0 hover:opacity-70 transition-opacity px-1"
            style={{ color: 'var(--foreground)' }}
            aria-label={closeLabel}
          >
            &times;
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
