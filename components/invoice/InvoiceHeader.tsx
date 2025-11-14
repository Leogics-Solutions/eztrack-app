interface InvoiceHeaderProps {
  invoice: {
    id: number;
    invoice_no?: string;
    status?: 'draft' | 'validated' | 'posted';
    currency?: string;
    subtotal?: number;
    tax?: number;
    total?: number;
  };
  onEditToggle: () => void;
  isEditMode: boolean;
}

export function InvoiceHeader({ invoice, onEditToggle, isEditMode }: InvoiceHeaderProps) {
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
          <div className="text-2xl font-bold">Invoice #{invoice.id}</div>
          <div className="text-sm text-[var(--muted-foreground)] mt-1">
            {invoice.invoice_no || '(no invoice number)'}
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
          {isEditMode ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-[var(--muted)] rounded-md">
          <div className="text-sm text-[var(--muted-foreground)] mb-1">Subtotal</div>
          <div className="text-xl font-semibold text-[var(--foreground)]">
            {invoice.currency || 'MYR'} {(invoice.subtotal || 0).toFixed(2)}
          </div>
        </div>
        <div className="p-4 bg-[var(--muted)] rounded-md">
          <div className="text-sm text-[var(--muted-foreground)] mb-1">Tax</div>
          <div className="text-xl font-semibold text-[var(--foreground)]">
            {invoice.currency || 'MYR'} {(invoice.tax || 0).toFixed(2)}
          </div>
        </div>
        <div className="p-4 bg-[var(--primary)] rounded-md">
          <div className="text-sm font-medium mb-1 text-[var(--primary-foreground)]">Total Amount</div>
          <div className="text-2xl font-bold text-[var(--primary-foreground)]">
            {invoice.currency || 'MYR'} {(invoice.total || 0).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
