import { useLanguage } from "@/lib/i18n";

interface InvoiceHeaderProps {
  invoice: {
    id: number;
    invoice_no?: string;
    status?: 'draft' | 'validated' | 'posted';
    currency?: string;
    subtotal?: number;
    tax?: number;
    total?: number;
    total_in_myr?: number | null;
    exchange_rate?: number | null;
  };
  onEditToggle: () => void;
  isEditMode: boolean;
}

export function InvoiceHeader({ invoice, onEditToggle, isEditMode }: InvoiceHeaderProps) {
  const { t } = useLanguage();
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'posted':
        return 'bg-[var(--success)] text-white';
      case 'validated':
        return 'bg-[var(--info)] text-white';
      default:
        return 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
    }
  };

  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6 mb-6">
      {/* Header Top */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <div className="text-2xl font-bold">{t.documents.invoiceHeader.invoice}{invoice.id}</div>
          <div className="text-sm text-[var(--muted-foreground)] mt-1">
            {invoice.invoice_no || t.documents.invoiceHeader.noInvoiceNumber}
          </div>
          <span className={`inline-block px-3 py-1 text-xs rounded-md mt-2 ${getStatusColor(invoice.status)}`}>
            {invoice.status || 'draft'}
          </span>
        </div>
        <button
          onClick={onEditToggle}
          className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors hover:text-white"
        >
          <span className="mr-2">{isEditMode ? '✖️' : '✏️'}</span>
          {isEditMode ? t.documents.invoiceHeader.cancel : t.documents.invoiceHeader.edit}
        </button>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-[var(--muted)] rounded-md">
          <div className="text-sm text-[var(--muted-foreground)] mb-1">{t.documents.invoiceHeader.subtotal}</div>
          <div className="text-xl font-semibold text-[var(--foreground)]">
            {invoice.currency || 'MYR'} {(invoice.subtotal || 0).toFixed(2)}
          </div>
        </div>
        <div className="p-4 bg-[var(--muted)] rounded-md">
          <div className="text-sm text-[var(--muted-foreground)] mb-1">{t.documents.invoiceHeader.tax}</div>
          <div className="text-xl font-semibold text-[var(--foreground)]">
            {invoice.currency || 'MYR'} {(invoice.tax || 0).toFixed(2)}
          </div>
        </div>
        <div className="p-4 bg-[var(--primary)] rounded-md">
          <div className="text-sm font-medium mb-1 text-[var(--primary-foreground)]">{t.documents.invoiceHeader.totalAmount}</div>
          <div className="text-2xl font-bold text-[var(--primary-foreground)]">
            {invoice.currency || 'MYR'} {(invoice.total || 0).toFixed(2)}
          </div>
          {invoice.total_in_myr && invoice.total_in_myr > 0 && (
            <div className="text-sm mt-1 text-[var(--primary-foreground)] opacity-90">
              ≈ MYR {(invoice.total_in_myr).toFixed(2)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
