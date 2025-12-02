'use client';

import { AppLayout } from "@/components/layout";
import { InvoiceHeader } from "@/components/invoice/InvoiceHeader";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";

// Types
interface Invoice {
  id: number;
  vendor_name?: string;
  vendor_id?: number;
  invoice_no?: string;
  invoice_date?: string;
  currency?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  status?: 'draft' | 'validated' | 'posted';
  po_number?: string;
  do_number?: string;
  payment_terms?: string;
  source_file?: string;
  remarks?: string;
  // Vendor details
  tax_id?: string;
  tin_number?: string;
  vendor_registration_no_new?: string;
  vendor_registration_no_old?: string;
  phone?: string;
  email?: string;
  address?: string;
  // Customer details
  customer_name?: string;
  customer_registration_no?: string;
  customer_sst_number?: string;
  customer_address?: string;
  // Banking details
  bank_name?: string;
  bank_account_no?: string;
  bank_beneficiary_name?: string;
  bank_swift_code?: string;
  accepted_payment_methods?: string;
}

interface LineItem {
  id: number;
  description?: string;
  qty?: number;
  uom?: string;
  unit_price?: number;
  discount?: number;
  tax_rate?: number;
  line_total?: number;
  account_name?: string;
  account_type?: string;
  account_confidence?: number;
  classification_method?: string;
}

interface Payment {
  id: number;
  date: string;
  amount: number;
  method: string;
  reference?: string;
}

const InvoiceDetail = () => {
  const router = useRouter();
  const { id } = router.query;

  // State
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);

  // Load invoice data
  useEffect(() => {
    if (id) {
      loadInvoiceData();
    }
  }, [id]);

  const loadInvoiceData = async () => {
    // TODO: Replace with actual API calls
    // Mock data for now
    setInvoice({
      id: Number(id),
      vendor_name: 'Sample Vendor Ltd',
      invoice_no: 'INV-2024-001',
      invoice_date: '2024-01-15',
      currency: 'MYR',
      subtotal: 1300.00,
      tax: 200.00,
      total: 1500.00,
      status: 'validated',
      tax_id: 'SST123456',
      tin_number: 'TIN987654',
    });

    setLineItems([
      {
        id: 1,
        description: 'Office Supplies',
        qty: 10,
        uom: 'boxes',
        unit_price: 100.00,
        discount: 0,
        tax_rate: 6,
        line_total: 1000.00,
        account_name: 'Office Expenses',
        account_type: 'Expense',
        account_confidence: 0.95,
        classification_method: 'AI',
      },
    ]);

    setPayments([]);
  };

  const handleSaveInvoice = async (updatedData: Partial<Invoice>) => {
    // TODO: Implement API call
    console.log('Saving invoice:', updatedData);
    await loadInvoiceData();
    setIsEditMode(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`Change status to ${newStatus}?`)) return;
    // TODO: Implement API call
    console.log('Changing status to:', newStatus);
    await loadInvoiceData();
  };

  const handleRecordPayment = async (payment: Omit<Payment, 'id'>) => {
    // TODO: Implement API call
    console.log('Recording payment:', payment);
    await loadInvoiceData();
  };

  const handleAutoClassify = async () => {
    setIsClassifying(true);
    try {
      // TODO: Implement API call
      console.log('Auto-classifying line items');
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
      await loadInvoiceData();
    } finally {
      setIsClassifying(false);
    }
  };

  if (!invoice) {
    return (
      <AppLayout pageName="Invoice Detail">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-lg">Loading invoice...</div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageName={`Invoice #${invoice.id}`}>
      {/* Invoice Header */}
      <InvoiceHeader
        invoice={invoice}
        onEditToggle={() => setIsEditMode(!isEditMode)}
        isEditMode={isEditMode}
      />

      {/* Payment Recorder */}
      <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">💰 Record Payment</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleRecordPayment({
              amount: Number(formData.get('amount')),
              date: formData.get('date') as string,
              method: formData.get('method') as string,
              reference: formData.get('reference') as string,
            });
            e.currentTarget.reset();
          }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Amount</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              defaultValue={invoice.total}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              name="date"
              type="date"
              defaultValue={invoice.invoice_date}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Method</label>
            <input
              name="method"
              defaultValue="bank"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reference</label>
            <div className="flex gap-2">
              <input
                name="reference"
                placeholder="BANK-REF"
                className="flex-1 px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors whitespace-nowrap"
              >
                Add
              </button>
            </div>
          </div>
        </form>

        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-[var(--foreground)]">Date</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold text-[var(--foreground)]">Amount</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-[var(--foreground)]">Method</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-[var(--foreground)]">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-2 text-sm">{payment.date}</td>
                    <td className="px-4 py-2 text-sm text-right">{payment.amount.toFixed(2)}</td>
                    <td className="px-4 py-2 text-sm">{payment.method}</td>
                    <td className="px-4 py-2 text-sm">{payment.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-[var(--muted-foreground)]">No payments recorded.</div>
        )}
      </div>

      {/* Side-by-side Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document Preview - Left Column */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6 sticky top-6">
            <h3 className="text-lg font-semibold mb-4">📄 Document Preview</h3>
            {invoice.source_file ? (
              <>
                {invoice.source_file.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={`/${invoice.source_file}`}
                    className="w-full h-[600px] border border-[var(--border)] rounded-md"
                  />
                ) : invoice.source_file.toLowerCase().match(/\.(png|jpg|jpeg)$/) ? (
                  <img
                    src={`/${invoice.source_file}`}
                    alt="Source document"
                    className="w-full border border-[var(--border)] rounded-md"
                  />
                ) : (
                  <div className="text-sm text-[var(--muted-foreground)]">
                    Preview not available.{' '}
                    <a href={`/${invoice.source_file}`} target="_blank" className="text-[var(--primary)] hover:underline">
                      Open file
                    </a>
                  </div>
                )}
                <a
                  href={`/${invoice.source_file}`}
                  target="_blank"
                  className="block mt-4 text-sm text-[var(--primary)] hover:underline"
                >
                  📥 Open in new tab
                </a>
              </>
            ) : (
              <div className="text-sm text-[var(--muted-foreground)]">No source document available.</div>
            )}
          </div>
        </div>

        {/* Invoice Data - Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Information */}
          <InvoiceInformationCard invoice={invoice} isEditMode={isEditMode} onSave={handleSaveInvoice} onStatusChange={handleStatusChange} />

          {/* Vendor Details */}
          <VendorDetailsCard invoice={invoice} isEditMode={isEditMode} />

          {/* Customer Details */}
          <CustomerDetailsCard invoice={invoice} isEditMode={isEditMode} />

          {/* Banking Details */}
          <BankingDetailsCard invoice={invoice} isEditMode={isEditMode} />

          {/* Remarks */}
          <RemarksCard invoice={invoice} isEditMode={isEditMode} />

          {/* Line Items */}
          <LineItemsCard
            invoiceId={invoice.id}
            lineItems={lineItems}
            onAutoClassify={handleAutoClassify}
            isClassifying={isClassifying}
          />
        </div>
      </div>
    </AppLayout>
  );
};

// Sub-components (keeping them in the same file for now for simplicity)

function InvoiceInformationCard({ invoice, isEditMode, onSave, onStatusChange }: any) {
  const [formData, setFormData] = useState(invoice);

  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
      <h3 className="text-lg font-semibold mb-4">📋 Invoice Information</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <span className="text-sm font-medium">Vendor:</span>{' '}
          {isEditMode ? (
            <input
              type="text"
              value={formData.vendor_name}
              onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
              className="ml-2 px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            <span>{invoice.vendor_name || invoice.vendor_id}</span>
          )}
        </div>
        <div>
          <span className="text-sm font-medium">Date:</span>{' '}
          {isEditMode ? (
            <input
              type="date"
              value={formData.invoice_date}
              onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
              className="ml-2 px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            <span>{invoice.invoice_date}</span>
          )}
        </div>
      </div>

      {/* Status Actions */}
      {!isEditMode && (
        <div className="mt-4 flex gap-2">
          {invoice.status === 'draft' && (
            <button
              onClick={() => onStatusChange('validated')}
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors"
            >
              ✓ Validate
            </button>
          )}
          {invoice.status === 'validated' && (
            <>
              <button
                onClick={() => onStatusChange('posted')}
                className="px-4 py-2 bg-[var(--success)] text-white rounded-md hover:bg-[var(--success-dark)] transition-colors"
              >
                📝 Post to Accounting
              </button>
              <button
                onClick={() => onStatusChange('draft')}
                className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg-light)] dark:hover:bg-[var(--hover-bg)] transition-colors hover:text-white"
              >
                ↶ Revert to Draft
              </button>
            </>
          )}
          {invoice.status === 'posted' && (
            <button
              onClick={() => onStatusChange('validated')}
              className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg-light)] dark:hover:bg-[var(--hover-bg)] transition-colors"
            >
              ↶ Revert to Validated
            </button>
          )}
        </div>
      )}

      {isEditMode && (
        <div className="mt-4">
          <button
            onClick={() => onSave(formData)}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors mr-2"
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}

function VendorDetailsCard({ invoice, isEditMode }: any) {
  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
      <h3 className="text-lg font-semibold mb-4">🏢 Vendor Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><b>SST Number:</b> {invoice.tax_id || '-'}</div>
        <div><b>TIN Number:</b> {invoice.tin_number || '-'}</div>
        <div><b>Registration No (New):</b> {invoice.vendor_registration_no_new || '-'}</div>
        <div><b>Registration No (Old):</b> {invoice.vendor_registration_no_old || '-'}</div>
        <div><b>Phone:</b> {invoice.phone || '-'}</div>
        <div><b>Email:</b> {invoice.email || '-'}</div>
        <div className="md:col-span-2"><b>Address:</b><br/>{invoice.address || '-'}</div>
      </div>
    </div>
  );
}

function CustomerDetailsCard({ invoice, isEditMode }: any) {
  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
      <h3 className="text-lg font-semibold mb-4">👤 Customer Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><b>Customer Name:</b> {invoice.customer_name || '-'}</div>
        <div><b>Registration No:</b> {invoice.customer_registration_no || '-'}</div>
        <div><b>SST Number:</b> {invoice.customer_sst_number || '-'}</div>
        <div className="md:col-span-2"><b>Address:</b><br/>{invoice.customer_address || '-'}</div>
      </div>
    </div>
  );
}

function BankingDetailsCard({ invoice, isEditMode }: any) {
  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
      <h3 className="text-lg font-semibold mb-4">🏦 Banking & Payment Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><b>Bank Name:</b> {invoice.bank_name || '-'}</div>
        <div><b>Account No:</b> {invoice.bank_account_no || '-'}</div>
        <div><b>Beneficiary:</b> {invoice.bank_beneficiary_name || '-'}</div>
        <div><b>SWIFT Code:</b> {invoice.bank_swift_code || '-'}</div>
        <div className="md:col-span-2"><b>Payment Methods:</b> {invoice.accepted_payment_methods || '-'}</div>
      </div>
    </div>
  );
}

function RemarksCard({ invoice, isEditMode }: any) {
  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
      <h3 className="text-lg font-semibold mb-4">📝 Remarks</h3>
      <div>{invoice.remarks || '-'}</div>
    </div>
  );
}

function LineItemsCard({ invoiceId, lineItems, onAutoClassify, isClassifying }: any) {
  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
      <h3 className="text-lg font-semibold mb-4">📊 Line Items</h3>

      {lineItems.length > 0 ? (
        <div className="overflow-x-auto mb-4">
          <table className="w-full">
            <thead className="bg-[var(--muted)]">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold text-[var(--foreground)]">Description</th>
                <th className="px-4 py-2 text-right text-sm font-semibold text-[var(--foreground)]">Qty</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-[var(--foreground)]">UOM</th>
                <th className="px-4 py-2 text-right text-sm font-semibold text-[var(--foreground)]">Unit Price</th>
                <th className="px-4 py-2 text-right text-sm font-semibold text-[var(--foreground)]">Line Total</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-[var(--foreground)]">Account</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {lineItems.map((item: LineItem) => (
                <tr key={item.id}>
                  <td className="px-4 py-2 text-sm">{item.description}</td>
                  <td className="px-4 py-2 text-sm text-right">{item.qty}</td>
                  <td className="px-4 py-2 text-sm">{item.uom || '-'}</td>
                  <td className="px-4 py-2 text-sm text-right">{(item.unit_price || 0).toFixed(2)}</td>
                  <td className="px-4 py-2 text-sm text-right">{(item.line_total || 0).toFixed(2)}</td>
                  <td className="px-4 py-2 text-sm">
                    {item.account_name || <span className="text-[var(--muted-foreground)]">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-sm text-[var(--muted-foreground)] mb-4">No line items captured.</div>
      )}

      <div className="flex gap-3">
        <button className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg-light)] dark:hover:bg-[var(--hover-bg)] transition-colors hover:text-white">
          Add Line Item
        </button>
        <button
          onClick={onAutoClassify}
          disabled={isClassifying}
          className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg-light)] dark:hover:bg-[var(--hover-bg)] transition-colors disabled:opacity-50 hover:text-white"
        >
          {isClassifying ? '🤖 AI is thinking...' : '🤖 AI Classify Account'}
        </button>
      </div>
    </div>
  );
}

export default InvoiceDetail;
