'use client';

import { AppLayout } from "@/components/layout";
import { InvoiceHeader } from "@/components/invoice/InvoiceHeader";
import { PaymentValidationResult } from "@/components/invoice/PaymentValidationResult";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  getInvoice,
  updateInvoice,
  downloadInvoiceFile,
  addLineItem as apiAddLineItem,
  updateLineItem as apiUpdateLineItem,
  deleteLineItem as apiDeleteLineItem,
  validateInvoice,
  verifyInvoice,
  addPayment as apiAddPayment,
  getSettings,
  pushInvoicesToBusinessCentral,
  matchInvoicesAcrossStatements,
  type Invoice as ApiInvoice,
  type UpdateInvoiceRequest,
  type AddLineItemRequest,
  type UpdateLineItemRequest,
  type AddPaymentRequest,
  type ValidateInvoiceResponse,
  type VerifyInvoiceResponse,
  type InvoicePayment,
  type PushInvoicesResponse,
  type MatchInvoicesAcrossStatementsResponse,
} from "@/services";
import { API_BASE_URL } from "@/services/config";

// Types
// Extend backend Invoice type with extra optional fields used by UI
interface Invoice extends ApiInvoice {
  // Core extra fields
  status?: 'draft' | 'validated' | 'posted' | 'paid';
  po_number?: string;
  do_number?: string;
  payment_terms?: string;
  source_file?: string;
  creditor_account?: string;
  shipping?: number;
  shipping_discount?: number;
  shopee_voucher?: number;
  shop_voucher?: number;
  coin_discount?: number;
  // Handwriting detection fields (already in ApiInvoice, but explicitly included for clarity)
  is_handwritten?: boolean | null;
  handwriting_clarity?: 'clear' | 'unclear' | 'mixed' | null;
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
  remarks?: string;
}

interface LineItem {
  id: number;
  description?: string;
  // Backend field name
  quantity?: number;
  // Legacy/local field name (still supported in UI)
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
  const { t } = useLanguage();
  const { showToast } = useToast();

  // State
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileContentType, setFileContentType] = useState<string | null>(null);
  const [pageFiles, setPageFiles] = useState<Array<{ url: string; index: number }>>([]);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [verificationResult, setVerificationResult] = useState<VerifyInvoiceResponse['data'] | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Business Central push state
  const [bcConnectionId, setBcConnectionId] = useState<number | null>(null);
  const [isPushingToBC, setIsPushingToBC] = useState(false);
  const [showPushResultModal, setShowPushResultModal] = useState(false);
  const [pushResult, setPushResult] = useState<PushInvoicesResponse | null>(null);
  const [isValidatingPayment, setIsValidatingPayment] = useState(false);
  const [paymentValidationResult, setPaymentValidationResult] = useState<MatchInvoicesAcrossStatementsResponse | null>(null);
  const [showPaymentValidationResult, setShowPaymentValidationResult] = useState(false);

  // Load invoice data
  useEffect(() => {
    if (id) {
      loadInvoiceData();
    }
    loadBusinessCentralConnection();
  }, [id]);

  const loadBusinessCentralConnection = async () => {
    try {
      const settings = await getSettings();
      const connections = settings?.integrations?.business_central?.connections || [];
      const activeConnection = connections.find((c) => c.is_active);
      if (activeConnection) {
        setBcConnectionId(activeConnection.id);
      }
    } catch (error) {
      console.error('Failed to load Business Central connection', error);
    }
  };

  const handleValidatePayment = async () => {
    if (!invoice) return;

    setIsValidatingPayment(true);
    setPaymentValidationResult(null);
    setShowPaymentValidationResult(false);

    try {
      const result = await matchInvoicesAcrossStatements(
        [invoice.id],
        {
          date_tolerance_days: 7,
          amount_tolerance_percentage: 2.0,
          currency_tolerance_percentage: 5.0,
          min_match_score: 60.0,
          exclude_linked: true,
        }
      );

      setPaymentValidationResult(result);
      setShowPaymentValidationResult(true);
      
      if (result.matched_invoices === 0) {
        showToast(
          `No matching transactions found across ${result.statements_searched} statement(s)`,
          'info'
        );
      } else {
        showToast(
          `Found matches in ${result.statement_matches?.length || 0} statement(s)`,
          'success'
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate payment';
      showToast(errorMessage, 'error');
    } finally {
      setIsValidatingPayment(false);
    }
  };

  const handlePushToBusinessCentral = async () => {
    if (!bcConnectionId || !invoice) {
      alert('Business Central connection not available. Please configure it in Settings.');
      return;
    }

    setIsPushingToBC(true);
    try {
      const result = await pushInvoicesToBusinessCentral({
        connection_id: bcConnectionId,
        invoice_ids: [invoice.id],
      });
      setPushResult(result);
      setShowPushResultModal(true);
      
      // Reload invoice to get updated BC status
      await loadInvoiceData();
    } catch (error: any) {
      console.error('Failed to push invoice to Business Central', error);
      alert(error?.message || 'Failed to push invoice to Business Central');
    } finally {
      setIsPushingToBC(false);
    }
  };

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

  const loadInvoiceData = async () => {
    if (!id) return;

    setError(null);

    try {
      const invoiceId = Number(id);
      if (Number.isNaN(invoiceId)) {
        throw new Error('Invalid invoice ID');
      }

      const response = await getInvoice(invoiceId);

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to load invoice');
      }

      const apiInvoice = response.data as ApiInvoice & {
        lines?: LineItem[];
        payments?: InvoicePayment[];
        vendor_company_reg_no?: string | null;
        vendor_company_reg_no_old?: string | null;
        vendor_sst_number?: string | null;
        vendor_tin_number?: string | null;
        vendor_phone?: string | null;
        vendor_email?: string | null;
        customer_company_reg_no?: string | null;
        customer_address?: string | null;
        customer_sst_number?: string | null;
        shipping_fee?: number | null;
        shipping_discount?: number | null;
        voucher_discount?: number | null;
        coin_discount?: number | null;
        bank_name?: string | null;
        bank_account_number?: string | null;
        bank_beneficiary_name?: string | null;
        bank_swift_code?: string | null;
        payment_terms?: string | null;
        payment_method?: string | null;
        remarks?: string | null;
      };

      const uiInvoice: Invoice = {
        ...apiInvoice,
        // Normalise status casing for UI controls
        status: (apiInvoice.status
          ? (apiInvoice.status.toLowerCase() as Invoice['status'])
          : 'draft') ?? 'draft',
        // Amounts
        shipping: apiInvoice.shipping_fee ?? undefined,
        shipping_discount: apiInvoice.shipping_discount ?? undefined,
        coin_discount: apiInvoice.coin_discount ?? undefined,
        // Vendor details
        tax_id: apiInvoice.vendor_sst_number ?? undefined,
        tin_number: apiInvoice.vendor_tin_number ?? undefined,
        vendor_registration_no_new: apiInvoice.vendor_company_reg_no ?? undefined,
        vendor_registration_no_old: apiInvoice.vendor_company_reg_no_old ?? undefined,
        phone: apiInvoice.vendor_phone ?? undefined,
        email: apiInvoice.vendor_email ?? undefined,
        address: apiInvoice.vendor_address ?? undefined,
        // Customer details
        customer_registration_no: apiInvoice.customer_company_reg_no ?? undefined,
        customer_address: apiInvoice.customer_address ?? undefined,
        customer_sst_number: apiInvoice.customer_sst_number ?? undefined,
        // Banking
        bank_name: apiInvoice.bank_name ?? undefined,
        bank_account_no: apiInvoice.bank_account_number ?? undefined,
        bank_beneficiary_name: apiInvoice.bank_beneficiary_name ?? undefined,
        bank_swift_code: apiInvoice.bank_swift_code ?? undefined,
        payment_terms: apiInvoice.payment_terms ?? undefined,
        accepted_payment_methods: apiInvoice.payment_method ?? undefined,
        // Misc
        remarks: apiInvoice.remarks ?? undefined,
      };

      setInvoice(uiInvoice);
      setLineItems(
        (apiInvoice.lines || []).map((line: any) => ({
          ...line,
          // Ensure both quantity and qty are available for the UI
          quantity: line.quantity ?? line.qty,
          qty: line.qty ?? line.quantity,
          // Map classification confidence if provided by API
          account_confidence: line.account_confidence ?? line.classification_confidence,
        }))
      );

      // Map payments from API to UI model
      setPayments(
        (apiInvoice.payments || []).map((payment) => ({
          id: payment.id,
          date: payment.payment_date?.split("T")[0] ?? "",
          amount: payment.amount,
          method: payment.payment_method,
          reference: payment.reference ?? undefined,
        }))
      );

      // Load source file(s) for preview
      // Check if invoice has page_files (multi-page invoice)
      if (apiInvoice.page_files && apiInvoice.page_files.length > 0) {
        // Use page_files URLs directly (they're already server URLs)
        const pageFileUrls = apiInvoice.page_files.map((filePath, index) => {
          const url = filePath.startsWith("http")
            ? filePath
            : `${API_BASE_URL}${filePath}`;
          return { url, index: index + 1 };
        });
        setPageFiles(pageFileUrls);
        setSelectedPageIndex(0);
        setFileUrl(null); // Clear single file URL
        setFileContentType(null);
      } else {
        // Fallback to single file download
        try {
          const { blob, contentType } = await downloadInvoiceFile(invoiceId);
          // Revoke previous URL if any
          setFileUrl((prevUrl) => {
            if (prevUrl) {
              URL.revokeObjectURL(prevUrl);
            }
            return prevUrl;
          });
          const url = URL.createObjectURL(blob);
          setFileUrl(url);
          setFileContentType(contentType);
          setPageFiles([]); // Clear page files
        } catch (fileErr) {
          console.error('Failed to load invoice file:', fileErr);
          setFileUrl(null);
          setFileContentType(null);
          setPageFiles([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
      setInvoice(null);
      setLineItems([]);
      setPayments([]);
    }
  };

  const handleSaveInvoice = async (updatedData: Partial<Invoice>) => {
    if (!invoice) return;

    try {
      const payload: UpdateInvoiceRequest = {};

      // Core identifiers
      if (updatedData.invoice_no !== undefined) payload.invoice_no = updatedData.invoice_no;
      if (updatedData.invoice_date !== undefined) payload.invoice_date = updatedData.invoice_date;
      if (updatedData.status !== undefined) payload.status = updatedData.status;

      // Vendor
      if (updatedData.vendor_name !== undefined) payload.vendor_name = updatedData.vendor_name;
      if (updatedData.address !== undefined) payload.vendor_address = updatedData.address;
      if (updatedData.vendor_registration_no_new !== undefined) {
        payload.vendor_company_reg_no = updatedData.vendor_registration_no_new;
      }
      if (updatedData.vendor_registration_no_old !== undefined) {
        payload.vendor_company_reg_no_old = updatedData.vendor_registration_no_old;
      }
      if (updatedData.tax_id !== undefined) payload.vendor_sst_number = updatedData.tax_id;
      if (updatedData.tin_number !== undefined) payload.vendor_tin_number = updatedData.tin_number;
      if (updatedData.phone !== undefined) payload.vendor_phone = updatedData.phone;
      if (updatedData.email !== undefined) payload.vendor_email = updatedData.email;

      // Customer
      if (updatedData.customer_name !== undefined) payload.customer_name = updatedData.customer_name;
      if (updatedData.customer_registration_no !== undefined) {
        payload.customer_company_reg_no = updatedData.customer_registration_no;
      }
      if (updatedData.customer_address !== undefined) payload.customer_address = updatedData.customer_address;
      if (updatedData.customer_sst_number !== undefined) {
        payload.customer_sst_number = updatedData.customer_sst_number;
      }

      // Amounts (only those surfaced in UI)
      if (updatedData.subtotal !== undefined) payload.subtotal = updatedData.subtotal;
      if (updatedData.tax !== undefined) payload.tax = updatedData.tax;
      if (updatedData.total !== undefined) payload.total = updatedData.total;
      if (updatedData.shipping !== undefined) payload.shipping_fee = updatedData.shipping;
      if (updatedData.shipping_discount !== undefined) {
        payload.shipping_discount = updatedData.shipping_discount;
      }
      if (
        updatedData.shopee_voucher !== undefined ||
        updatedData.shop_voucher !== undefined
      ) {
        const currentShopee = updatedData.shopee_voucher ?? invoice.shopee_voucher ?? 0;
        const currentShop = updatedData.shop_voucher ?? invoice.shop_voucher ?? 0;
        payload.voucher_discount = currentShopee + currentShop;
      }
      if (updatedData.coin_discount !== undefined) payload.coin_discount = updatedData.coin_discount;

      // Banking / payment
      if (updatedData.bank_name !== undefined) payload.bank_name = updatedData.bank_name;
      if (updatedData.bank_account_no !== undefined) {
        payload.bank_account_number = updatedData.bank_account_no;
      }
      if (updatedData.bank_beneficiary_name !== undefined) {
        payload.bank_beneficiary_name = updatedData.bank_beneficiary_name;
      }
      if (updatedData.bank_swift_code !== undefined) payload.bank_swift_code = updatedData.bank_swift_code;
      if (updatedData.payment_terms !== undefined) payload.payment_terms = updatedData.payment_terms;
      if (updatedData.accepted_payment_methods !== undefined) {
        payload.payment_method = updatedData.accepted_payment_methods;
      }

      // Misc
      if ((updatedData as any).remarks !== undefined) {
        payload.remarks = (updatedData as any).remarks;
      }

      await updateInvoice(invoice.id, payload);
      await loadInvoiceData();
      setIsEditMode(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update invoice');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!invoice) return;

    if (!confirm(t.documents.invoiceDetailPage.changeStatusConfirm.replace('{status}', newStatus))) return;

    try {
      if (newStatus === 'validated') {
        const response: ValidateInvoiceResponse = await validateInvoice(invoice.id);

        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to validate invoice');
        }

        const { ok, errors, warnings } = response.data;

        if (!ok) {
          const messages = [
            ...errors,
            ...warnings.map((w) => `Warning: ${w}`),
          ];
          alert(messages.length ? messages.join('\n') : 'Invoice validation failed');
        } else if (warnings.length) {
          alert(['Invoice validated with warnings:', ...warnings].join('\n'));
        } else {
          alert('Invoice validated successfully');
        }
      } else {
        // Fallback for other status changes (e.g. posted, revert)
        await updateInvoice(invoice.id, { status: newStatus });
      }

      await loadInvoiceData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to change invoice status');
    }
  };

  const handleVerifyInvoice = async () => {
    if (!invoice) return;

    try {
      setIsVerifying(true);
      const response = await verifyInvoice(invoice.id);

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to verify invoice');
      }

      setVerificationResult(response.data);
      setShowVerificationModal(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to verify invoice');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRecordPayment = async (payment: Omit<Payment, 'id'>) => {
    if (!invoice) return;

    try {
      const payload: AddPaymentRequest = {
        amount: payment.amount,
        payment_date: payment.date,
        payment_method: payment.method,
        reference: payment.reference,
      };

      const response = await apiAddPayment(invoice.id, payload);

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to record payment');
      }

      const created = response.data;

      // Update local payments table
      setPayments((prev) => [
        ...prev,
        {
          id: created.id,
          date: created.payment_date?.split('T')[0] ?? payment.date,
          amount: created.amount,
          method: created.payment_method,
          reference: created.reference ?? payment.reference,
        },
      ]);

      // Refresh invoice (status may change to PAID)
      await loadInvoiceData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to record payment');
    }
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

  const handleAddLineItem = async (data: AddLineItemRequest) => {
    if (!invoice) return;

    try {
      // Ensure line_total is always sent, even if caller omitted it
      const quantity = data.quantity ?? 0;
      const unitPrice = data.unit_price ?? 0;
      const payload: AddLineItemRequest = {
        ...data,
        line_total:
          data.line_total !== undefined
            ? data.line_total
            : Number((quantity * unitPrice).toFixed(2)),
      };

      await apiAddLineItem(invoice.id, payload);
      await loadInvoiceData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add line item');
    }
  };

  const handleUpdateLineItem = async (lineId: number, data: UpdateLineItemRequest) => {
    if (!invoice) return;

    try {
      const quantity = data.quantity;
      const unitPrice = data.unit_price;

      const payload: UpdateLineItemRequest = {
        ...data,
      };

      // If quantity and unit_price are both available, recompute line_total
      if (quantity !== undefined && unitPrice !== undefined) {
        payload.line_total = Number((quantity * unitPrice).toFixed(2));
      }

      await apiUpdateLineItem(invoice.id, lineId, payload);
      await loadInvoiceData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update line item');
    }
  };

  const handleDeleteLineItem = async (lineId: number) => {
    if (!invoice) return;
    if (!confirm('Are you sure you want to delete this line item?')) return;

    try {
      await apiDeleteLineItem(invoice.id, lineId);
      await loadInvoiceData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete line item');
    }
  };

  if (!invoice) {
    return (
      <AppLayout pageName={t.documents.invoiceDetailPage.title}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-lg">
              {error || t.documents.invoiceDetailPage.loading}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageName={`${t.documents.invoiceDetailPage.title} #${invoice.id}`}>
      {/* Invoice Header */}
      <InvoiceHeader
        invoice={{
          id: invoice.id,
          invoice_no: invoice.invoice_no,
          status: (invoice.status as 'draft' | 'validated' | 'posted') ?? 'draft',
          currency: invoice.currency,
          subtotal: invoice.subtotal,
          tax: invoice.tax,
          total: invoice.total,
        }}
        onEditToggle={() => setIsEditMode(!isEditMode)}
        isEditMode={isEditMode}
      />

      {/* Payment Recorder */}
      <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">{t.documents.invoiceDetailPage.recordPayment}</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (payments.length > 0) return;
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
            <label className="block text-sm font-medium mb-1">{t.documents.invoiceDetailPage.amount}</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              defaultValue={invoice.total}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.documents.invoiceDetailPage.date}</label>
            <input
              name="date"
              type="date"
              defaultValue={invoice.invoice_date}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.documents.invoiceDetailPage.method}</label>
            <input
              name="method"
              defaultValue="bank"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t.documents.invoiceDetailPage.reference}</label>
            <div className="flex gap-2">
              <input
                name="reference"
                placeholder={t.documents.invoiceDetailPage.referencePlaceholder}
                className="flex-1 px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
              />
              <button
                type="submit"
                disabled={payments.length > 0}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.documents.invoiceDetailPage.add}
              </button>
            </div>
          </div>
        </form>

        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.invoiceDetailPage.paymentTable.date}</th>
                  <th className="px-4 py-2 text-right text-sm font-semibold text-[var(--foreground)]">{t.documents.invoiceDetailPage.paymentTable.amount}</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.invoiceDetailPage.paymentTable.method}</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-[var(--foreground)]">{t.documents.invoiceDetailPage.paymentTable.reference}</th>
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
          <div className="text-sm text-[var(--muted-foreground)]">{t.documents.invoiceDetailPage.noPayments}</div>
        )}
      </div>

      {/* Side-by-side Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Document Preview - Left Column */}
        <div>
          <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6 sticky top-24 max-h-[calc(100vh-7rem)] overflow-auto">
            <h3 className="text-lg font-semibold mb-4">{t.documents.invoiceDetailPage.documentPreview}</h3>
            
            {/* Multi-page files display */}
            {pageFiles.length > 0 ? (
              <>
                {/* Page tabs/selector */}
                {pageFiles.length > 1 && (
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {pageFiles.map((pageFile, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedPageIndex(index)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                          selectedPageIndex === index
                            ? 'bg-[var(--primary)] text-white'
                            : 'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted)]/80'
                        }`}
                      >
                        Page {pageFile.index}
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Current page preview */}
                {pageFiles[selectedPageIndex] && (
                  <>
                    {pageFiles[selectedPageIndex].url.endsWith('.pdf') || pageFiles[selectedPageIndex].url.includes('.pdf') ? (
                      <iframe
                        src={pageFiles[selectedPageIndex].url}
                        className="w-full h-[600px] border border-[var(--border)] rounded-md"
                      />
                    ) : (
                      <img
                        src={pageFiles[selectedPageIndex].url}
                        alt={`${t.documents.invoiceDetailPage.sourceDocument} - Page ${pageFiles[selectedPageIndex].index}`}
                        className="w-full border border-[var(--border)] rounded-md"
                      />
                    )}
                    <a
                      href={pageFiles[selectedPageIndex].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mt-4 text-sm text-[var(--primary)] hover:underline"
                    >
                      {t.documents.invoiceDetailPage.openInNewTab}
                    </a>
                  </>
                )}
              </>
            ) : fileUrl ? (
              <>
                {fileContentType?.startsWith('application/pdf') ? (
                  <iframe
                    src={fileUrl}
                    className="w-full h-[600px] border border-[var(--border)] rounded-md"
                  />
                ) : fileContentType?.startsWith('image/') ? (
                  <img
                    src={fileUrl}
                    alt={t.documents.invoiceDetailPage.sourceDocument}
                    className="w-full border border-[var(--border)] rounded-md"
                  />
                ) : (
                  <div className="text-sm text-[var(--muted-foreground)]">
                    {t.documents.invoiceDetailPage.previewNotAvailable}{' '}
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">
                      {t.documents.invoiceDetailPage.openFile}
                    </a>
                  </div>
                )}
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-4 text-sm text-[var(--primary)] hover:underline"
                >
                  {t.documents.invoiceDetailPage.openInNewTab}
                </a>
              </>
            ) : (
              <div className="text-sm text-[var(--muted-foreground)]">{t.documents.invoiceDetailPage.noSourceDocument}</div>
            )}
          </div>
        </div>

        {/* Invoice Data - Right Column (scrollable) */}
        <div className="space-y-6 lg:max-h-[calc(100vh-7rem)] lg:overflow-auto lg:pr-2">
          {/* Invoice Information */}
          <InvoiceInformationCard 
            invoice={invoice} 
            isEditMode={isEditMode} 
            onSave={handleSaveInvoice} 
            onStatusChange={handleStatusChange} 
            onVerify={handleVerifyInvoice} 
            isVerifying={isVerifying}
            bcConnectionId={bcConnectionId}
            isPushingToBC={isPushingToBC}
            onPushToBusinessCentral={handlePushToBusinessCentral}
            onValidatePayment={handleValidatePayment}
            isValidatingPayment={isValidatingPayment}
            t={t} 
          />

          {/* Invoice Payment Validation Results */}
          {showPaymentValidationResult && paymentValidationResult && (
            <PaymentValidationResult
              result={paymentValidationResult}
              invoiceNo={invoice.invoice_no}
              onClose={() => {
                setShowPaymentValidationResult(false);
                setPaymentValidationResult(null);
              }}
              onLinksCreated={async () => {
                // Reload invoice data to reflect the new links
                await loadInvoiceData();
                // Optionally refresh the validation results
                // You could re-run the validation here if needed
              }}
            />
          )}

          {/* Bank Reconciliation Status */}
          {invoice.bank_reconciliation && (
            <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                Bank Reconciliation
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    ✓ Reconciled
                  </span>
                  <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Matched on {new Date(invoice.bank_reconciliation.reconciled_at).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      Bank Account
                    </div>
                    <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {invoice.bank_reconciliation.account_number}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      Transaction Date
                    </div>
                    <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {new Date(invoice.bank_reconciliation.transaction_date).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      Transaction Amount
                    </div>
                    <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {invoice.bank_reconciliation.transaction_amount.toLocaleString('en-MY', {
                        style: 'currency',
                        currency: 'MYR',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      Match Score
                    </div>
                    <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {invoice.bank_reconciliation.match_score.toFixed(1)}%
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      Match Type
                    </div>
                    <div className="text-sm font-medium capitalize" style={{ color: 'var(--foreground)' }}>
                      {invoice.bank_reconciliation.match_type}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      Statement ID
                    </div>
                    <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      <button
                        onClick={() => router.push(`/bank-statements/${invoice.bank_reconciliation.statement_id}`)}
                        className="text-[var(--primary)] hover:underline"
                      >
                        #{invoice.bank_reconciliation.statement_id}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                    Transaction Description
                  </div>
                  <div className="text-sm" style={{ color: 'var(--foreground)' }}>
                    {invoice.bank_reconciliation.transaction_description}
                  </div>
                </div>
                
                {invoice.bank_reconciliation.notes && (
                  <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      Notes
                    </div>
                    <div className="text-sm" style={{ color: 'var(--foreground)' }}>
                      {invoice.bank_reconciliation.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vendor Details */}
          <VendorDetailsCard invoice={invoice} isEditMode={isEditMode} t={t} onSave={handleSaveInvoice} />

          {/* Customer Details */}
          <CustomerDetailsCard invoice={invoice} isEditMode={isEditMode} t={t} onSave={handleSaveInvoice} />

          {/* Banking Details */}
          <BankingDetailsCard invoice={invoice} isEditMode={isEditMode} t={t} onSave={handleSaveInvoice} />

          {/* Remarks */}
          <RemarksCard invoice={invoice} isEditMode={isEditMode} t={t} onSave={handleSaveInvoice} />

          {/* Line Items */}
          <LineItemsCard
            invoiceId={invoice.id}
            lineItems={lineItems}
            onAddLineItem={handleAddLineItem}
            onUpdateLineItem={handleUpdateLineItem}
            onDeleteLineItem={handleDeleteLineItem}
            onAutoClassify={handleAutoClassify}
            isClassifying={isClassifying}
            t={t}
          />
        </div>
      </div>

      {/* Verification Modal */}
      {showVerificationModal && verificationResult && (
        <VerificationModal
          result={verificationResult}
          onClose={() => {
            setShowVerificationModal(false);
            setVerificationResult(null);
          }}
          t={t}
        />
      )}

      {/* Push to Business Central Result Modal */}
      {showPushResultModal && pushResult && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPushResultModal(false);
              setPushResult(null);
            }
          }}
        >
          <div
            className="rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                Push to Business Central - Results
              </h3>
              <button
                onClick={() => {
                  setShowPushResultModal(false);
                  setPushResult(null);
                }}
                className="text-2xl hover:opacity-70 transition-opacity"
                style={{ color: 'var(--foreground)' }}
              >
                &times;
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {pushResult.success_count}
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">Success</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {pushResult.failed_count}
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-300">Failed</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {pushResult.skipped_count}
                  </div>
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">Skipped</div>
                </div>
              </div>

              <div className="space-y-2">
                {pushResult.details.map((detail) => (
                  <div
                    key={detail.invoice_id}
                    className={`p-3 rounded-md border ${
                      detail.status === 'SUCCESS'
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : detail.status === 'FAILED'
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium" style={{ color: 'var(--foreground)' }}>
                          Invoice #{detail.invoice_id} {detail.invoice_no && `(${detail.invoice_no})`}
                        </div>
                        <div className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                          Status: <span className="font-semibold">{detail.status}</span>
                        </div>
                        {detail.error_message && (
                          <div className="text-sm mt-1 text-red-600 dark:text-red-400">
                            {detail.error_message}
                          </div>
                        )}
                        {detail.bc_invoice_id && (
                          <div className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                            BC Invoice ID: {detail.bc_invoice_id}
                          </div>
                        )}
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-md font-semibold ${
                        detail.status === 'SUCCESS'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : detail.status === 'FAILED'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                      }`}>
                        {detail.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => {
                  setShowPushResultModal(false);
                  setPushResult(null);
                }}
                className="px-6 py-2 rounded-md transition-colors hover:opacity-90"
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

// Verification Modal Component
function VerificationModal({ result, onClose, t }: { result: VerifyInvoiceResponse['data']; onClose: () => void; t: any }) {
  const { verification } = result;
  const formatAmount = (value: string) => parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Helper function to compare values as numbers (accounting for floating point precision)
  const valuesMatch = (val1: string, val2: string) => {
    const num1 = parseFloat(val1);
    const num2 = parseFloat(val2);
    // Use small tolerance for floating point comparison
    return Math.abs(num1 - num2) < 0.01;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Invoice Verification Results</h2>
            <button
              onClick={onClose}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Indicator */}
          <div className={`p-4 rounded-lg ${verification.ok ? 'bg-[var(--success)] bg-opacity-10' : 'bg-[var(--error)] bg-opacity-10'}`}>
            <div className="flex items-center gap-2">
              <span className={`text-2xl ${verification.ok ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                {verification.ok ? '✓' : '✗'}
              </span>
              <div>
                <h3 className={`font-semibold ${verification.ok ? 'text-[var(--success)] dark:text-white' : 'text-[var(--error)] dark:text-white'}`}>
                  {verification.ok ? 'Verification Passed' : 'Verification Failed'}
                </h3>
                <p className="text-sm text-gray-900 dark:text-white">
                  {verification.ok 
                    ? 'All totals match correctly' 
                    : `${verification.errors.length} error(s) and ${verification.warnings.length} warning(s) found`}
                </p>
              </div>
            </div>
          </div>

          {/* Errors */}
          {verification.errors.length > 0 && (
            <div>
              <h3 className="font-semibold text-[var(--error)] mb-2">Errors:</h3>
              <ul className="list-disc list-inside space-y-1">
                {verification.errors.map((error, idx) => (
                  <li key={idx} className="text-sm text-[var(--error)]">{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {verification.warnings.length > 0 && (
            <div>
              <h3 className="font-semibold text-[var(--warning)] mb-2">Warnings:</h3>
              <ul className="list-disc list-inside space-y-1">
                {verification.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-[var(--warning-foreground)]">{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Comparison Table */}
          <div>
            <h3 className="font-semibold mb-3">Totals Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 px-3 text-sm font-semibold">Field</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold">Header Value</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold">Calculated Value</th>
                    <th className="text-center py-2 px-3 text-sm font-semibold">Match</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[var(--border)]">
                    <td className="py-2 px-3 text-sm font-medium">Subtotal</td>
                    <td className="py-2 px-3 text-sm text-right">{formatAmount(verification.header.subtotal)}</td>
                    <td className="py-2 px-3 text-sm text-right">{formatAmount(verification.calc.subtotal)}</td>
                    <td className="py-2 px-3 text-center">
                      {valuesMatch(verification.header.subtotal, verification.calc.subtotal) ? (
                        <span className="text-[var(--success)]">✓</span>
                      ) : (
                        <span className="text-[var(--warning)]">⚠</span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-[var(--border)]">
                    <td className="py-2 px-3 text-sm font-medium">Tax</td>
                    <td className="py-2 px-3 text-sm text-right">{formatAmount(verification.header.tax)}</td>
                    <td className="py-2 px-3 text-sm text-right">{formatAmount(verification.calc.tax)}</td>
                    <td className="py-2 px-3 text-center">
                      {valuesMatch(verification.header.tax, verification.calc.tax) ? (
                        <span className="text-[var(--success)]">✓</span>
                      ) : (
                        <span className="text-[var(--warning)]">⚠</span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-[var(--border)]">
                    <td className="py-2 px-3 text-sm font-medium">Total</td>
                    <td className="py-2 px-3 text-sm text-right">{formatAmount(verification.header.total)}</td>
                    <td className="py-2 px-3 text-sm text-right">{formatAmount(verification.calc.total)}</td>
                    <td className="py-2 px-3 text-center">
                      {valuesMatch(verification.header.total, verification.calc.total) ? (
                        <span className="text-[var(--success)]">✓</span>
                      ) : (
                        <span className="text-[var(--error)]">✗</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Additional Costs (if any) */}
          {verification.calc.additional_costs && (
            <div>
              <h3 className="font-semibold mb-3">Additional Costs</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(verification.calc.additional_costs).map(([key, value]) => {
                  const numValue = parseFloat(value);
                  if (numValue === 0) return null;
                  return (
                    <div key={key} className="flex justify-between py-1 border-b border-[var(--border)]">
                      <span className="text-[var(--muted-foreground)] capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="font-medium">{formatAmount(value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[var(--border)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Sub-components (keeping them in the same file for now for simplicity)

function InvoiceInformationCard({ 
  invoice, 
  isEditMode, 
  onSave, 
  onStatusChange, 
  onVerify, 
  isVerifying,
  bcConnectionId,
  isPushingToBC,
  onPushToBusinessCentral,
  onValidatePayment,
  isValidatingPayment,
  t 
}: any) {
  const [formData, setFormData] = useState(invoice);

  useEffect(() => {
    setFormData(invoice);
  }, [invoice]);

  const formatDate = (value?: string) => {
    if (!value) return '-';
    // Expecting ISO string; show only date part
    return value.split('T')[0];
  };

  const formatAmount = (value?: number) =>
    (value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderValue = (label: string, value: React.ReactNode) => (
    <div className="space-y-1">
      <div className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
        {label}
      </div>
      <div className="text-sm text-[var(--foreground)]">
        {value ?? '-'}
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold">{t.documents.invoiceDetailPage.invoiceInformation}</h3>

        {/* Status Actions (compact, right side) */}
        {!isEditMode && (
          <div className="flex flex-wrap gap-2 justify-end">
            {invoice.status === 'draft' && (
              <button
                onClick={() => onStatusChange('validated')}
                className="px-3 py-1.5 bg-[var(--primary)] text-white rounded-md text-xs font-medium hover:bg-[var(--primary-hover)] transition-colors"
              >
                {t.documents.invoiceDetailPage.validate}
              </button>
            )}
            {invoice.status === 'validated' && (
              <>
                <button
                  onClick={() => onStatusChange('posted')}
                  className="px-3 py-1.5 bg-[var(--success)] text-white rounded-md text-xs font-medium hover:bg-[var(--success-dark)] transition-colors"
                >
                  {t.documents.invoiceDetailPage.postToAccounting}
                </button>
                <button
                  onClick={() => onStatusChange('draft')}
                  className="px-3 py-1.5 border border-[var(--border)] rounded-md text-xs font-medium hover:bg-[var(--hover-bg-light)] dark:hover:bg-[var(--hover-bg)] transition-colors hover:text-white"
                >
                  {t.documents.invoiceDetailPage.revertToDraft}
                </button>
              </>
            )}
            {invoice.status === 'posted' && (
              <button
                onClick={() => onStatusChange('validated')}
                className="px-3 py-1.5 border border-[var(--border)] rounded-md text-xs font-medium hover:bg-[var(--hover-bg-light)] dark:hover:bg-[var(--hover-bg)] transition-colors"
              >
                {t.documents.invoiceDetailPage.revertToValidated}
              </button>
            )}
            <button
              onClick={onVerify}
              disabled={isVerifying}
              className="px-3 py-1.5 border border-[var(--border)] rounded-md text-xs font-medium hover:bg-[var(--hover-bg-light)] dark:hover:bg-[var(--hover-bg)] transition-colors hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? 'Verifying...' : '✓ Verify Totals'}
            </button>
            {false && onValidatePayment && (
              <button
                onClick={onValidatePayment}
                disabled={isValidatingPayment}
                className="px-3 py-1.5 bg-purple-600 text-white rounded-md text-xs font-medium hover:bg-purple-700 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isValidatingPayment ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Validating...
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Validate Payment
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border)] pt-4 space-y-4 text-sm">
        {/* Row 1: Vendor / Date / Currency */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderValue('VENDOR:', isEditMode ? (
            <input
              type="text"
              value={formData.vendor_name || ''}
              onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
              className="w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            invoice.vendor_name || invoice.vendor_id || '-'
          ))}

          {renderValue('DATE:', isEditMode ? (
            <input
              type="date"
              value={formData.invoice_date ? formatDate(formData.invoice_date) : ''}
              onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
              className="w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            formatDate(invoice.invoice_date)
          ))}

          {renderValue('CURRENCY:', invoice.currency || 'MYR')}
        </div>

        {/* Row 2: Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderValue('STATUS:', (invoice.status || 'draft').toUpperCase())}
        </div>

        {/* Row 2.5: Handwriting Information */}
        {(invoice.is_handwritten !== null && invoice.is_handwritten !== undefined) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {renderValue('HANDWRITING:', (() => {
              if (invoice.is_handwritten === true) {
                const clarity = invoice.handwriting_clarity;
                if (clarity === 'unclear') {
                  return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
                      ✍️ Handwritten - Unclear (needs review)
                    </span>
                  );
                } else if (clarity === 'mixed') {
                  return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                      ✍️ Handwritten - Mixed clarity
                    </span>
                  );
                } else if (clarity === 'clear') {
                  return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                      ✍️ Handwritten - Clear
                    </span>
                  );
                } else {
                  return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      ✍️ Handwritten
                    </span>
                  );
                }
              } else {
                return (
                  <span className="text-sm text-[var(--muted-foreground)]">Printed/Computer-generated</span>
                );
              }
            })())}
          </div>
        )}

        {/* Row 3: Creditor / Invoice No / PO No */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderValue('CREDITOR ACCOUNT:', invoice.creditor_account || invoice.vendor_name || '-')}
          {renderValue('INVOICE NO:', isEditMode ? (
            <input
              type="text"
              value={formData.invoice_no || ''}
              onChange={(e) => setFormData({ ...formData, invoice_no: e.target.value })}
              className="w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            invoice.invoice_no || '-'
          ))}
          {renderValue('PO NUMBER:', invoice.po_number || '-')}
        </div>

        {/* Row 4: DO Number / Payment Terms */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderValue('DO NUMBER:', invoice.do_number || '-')}
          {renderValue('PAYMENT TERMS:', isEditMode ? (
            <input
              type="text"
              value={formData.payment_terms || ''}
              onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
              className="w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            invoice.payment_terms || '-'
          ))}
        </div>

        {/* Row 5: Shipping / Shipping Discount */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderValue('SHIPPING:', isEditMode ? (
            <input
              type="number"
              step="0.01"
              value={formData.shipping ?? 0}
              onChange={(e) => setFormData({ ...formData, shipping: parseFloat(e.target.value || '0') })}
              className="w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            formatAmount(invoice.shipping)
          ))}
          {renderValue('SHIPPING DISCOUNT:', isEditMode ? (
            <input
              type="number"
              step="0.01"
              value={formData.shipping_discount ?? 0}
              onChange={(e) => setFormData({ ...formData, shipping_discount: parseFloat(e.target.value || '0') })}
              className="w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            formatAmount(invoice.shipping_discount)
          ))}
        </div>

        {/* Row 6: Vouchers / Coin Discount */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderValue('SHOPEE VOUCHER:', isEditMode ? (
            <input
              type="number"
              step="0.01"
              value={formData.shopee_voucher ?? 0}
              onChange={(e) => setFormData({ ...formData, shopee_voucher: parseFloat(e.target.value || '0') })}
              className="w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            formatAmount(invoice.shopee_voucher)
          ))}
          {renderValue('SHOP VOUCHER:', isEditMode ? (
            <input
              type="number"
              step="0.01"
              value={formData.shop_voucher ?? 0}
              onChange={(e) => setFormData({ ...formData, shop_voucher: parseFloat(e.target.value || '0') })}
              className="w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            formatAmount(invoice.shop_voucher)
          ))}
          {renderValue('COIN DISCOUNT:', isEditMode ? (
            <input
              type="number"
              step="0.01"
              value={formData.coin_discount ?? 0}
              onChange={(e) => setFormData({ ...formData, coin_discount: parseFloat(e.target.value || '0') })}
              className="w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            formatAmount(invoice.coin_discount)
          ))}
        </div>

        {/* Row 7: Subtotal / Tax / Total */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 border-t border-dashed border-[var(--border)]">
          {renderValue('SUBTOTAL:', `${invoice.currency || 'MYR'} ${formatAmount(invoice.subtotal)}`)}
          {renderValue('TAX:', `${invoice.currency || 'MYR'} ${formatAmount(invoice.tax)}`)}
          {renderValue('TOTAL:', `${invoice.currency || 'MYR'} ${formatAmount(invoice.total)}`)}
        </div>
      </div>

      {isEditMode && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => onSave(formData)}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors"
          >
            {t.documents.invoiceDetailPage.saveChanges}
          </button>
        </div>
      )}
    </div>
  );
}

function VendorDetailsCard({ invoice, isEditMode, t, onSave }: any) {
  const [formData, setFormData] = useState(invoice);

  useEffect(() => {
    setFormData(invoice);
  }, [invoice]);

  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
      <h3 className="text-lg font-semibold mb-4">{t.documents.invoiceDetailPage.vendorDetails}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <b>{t.documents.invoiceDetailPage.sstNumber}</b>{' '}
          {isEditMode ? (
            <input
              type="text"
              value={formData.tax_id || ''}
              onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
              className="mt-1 w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            <span>{invoice.tax_id || '-'}</span>
          )}
        </div>
        <div>
          <b>{t.documents.invoiceDetailPage.tinNumber}</b>{' '}
          {isEditMode ? (
            <input
              type="text"
              value={formData.tin_number || ''}
              onChange={(e) => setFormData({ ...formData, tin_number: e.target.value })}
              className="mt-1 w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            <span>{invoice.tin_number || '-'}</span>
          )}
        </div>
        <div>
          <b>{t.documents.invoiceDetailPage.registrationNoNew}</b>{' '}
          {isEditMode ? (
            <input
              type="text"
              value={formData.vendor_registration_no_new || ''}
              onChange={(e) => setFormData({ ...formData, vendor_registration_no_new: e.target.value })}
              className="mt-1 w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            <span>{invoice.vendor_registration_no_new || '-'}</span>
          )}
        </div>
        <div>
          <b>{t.documents.invoiceDetailPage.registrationNoOld}</b>{' '}
          {isEditMode ? (
            <input
              type="text"
              value={formData.vendor_registration_no_old || ''}
              onChange={(e) => setFormData({ ...formData, vendor_registration_no_old: e.target.value })}
              className="mt-1 w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            <span>{invoice.vendor_registration_no_old || '-'}</span>
          )}
        </div>
        <div>
          <b>{t.documents.invoiceDetailPage.phone}</b>{' '}
          {isEditMode ? (
            <input
              type="text"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="mt-1 w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            <span>{invoice.phone || '-'}</span>
          )}
        </div>
        <div>
          <b>{t.documents.invoiceDetailPage.email}</b>{' '}
          {isEditMode ? (
            <input
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="mt-1 w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            <span>{invoice.email || '-'}</span>
          )}
        </div>
        <div className="md:col-span-2">
          <b>{t.documents.invoiceDetailPage.address}</b>
          {isEditMode ? (
            <textarea
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="mt-1 w-full px-2 py-1 border border-[var(--border)] rounded"
              rows={2}
            />
          ) : (
            <div>{invoice.address || '-'}</div>
          )}
        </div>
      </div>
      {isEditMode && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() =>
              onSave({
                tax_id: formData.tax_id,
                tin_number: formData.tin_number,
                vendor_registration_no_new: formData.vendor_registration_no_new,
                vendor_registration_no_old: formData.vendor_registration_no_old,
                phone: formData.phone,
                email: formData.email,
                address: formData.address,
              })
            }
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors"
          >
            {t.documents.invoiceDetailPage.saveChanges}
          </button>
        </div>
      )}
    </div>
  );
}

function CustomerDetailsCard({ invoice, isEditMode, t, onSave }: any) {
  const [formData, setFormData] = useState(invoice);

  useEffect(() => {
    setFormData(invoice);
  }, [invoice]);

  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
      <h3 className="text-lg font-semibold mb-4">{t.documents.invoiceDetailPage.customerDetails}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <b>{t.documents.invoiceDetailPage.customerName}</b>{' '}
          {isEditMode ? (
            <input
              type="text"
              value={formData.customer_name || ''}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              className="mt-1 w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            <span>{invoice.customer_name || '-'}</span>
          )}
        </div>
        <div>
          <b>{t.documents.invoiceDetailPage.customerRegistrationNo}</b>{' '}
          {isEditMode ? (
            <input
              type="text"
              value={formData.customer_registration_no || ''}
              onChange={(e) => setFormData({ ...formData, customer_registration_no: e.target.value })}
              className="mt-1 w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            <span>{invoice.customer_registration_no || '-'}</span>
          )}
        </div>
        <div>
          <b>{t.documents.invoiceDetailPage.customerSstNumber}</b>{' '}
          {isEditMode ? (
            <input
              type="text"
              value={formData.customer_sst_number || ''}
              onChange={(e) => setFormData({ ...formData, customer_sst_number: e.target.value })}
              className="mt-1 w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            <span>{invoice.customer_sst_number || '-'}</span>
          )}
        </div>
        <div className="md:col-span-2">
          <b>{t.documents.invoiceDetailPage.customerAddress}</b>
          {isEditMode ? (
            <textarea
              value={formData.customer_address || ''}
              onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
              className="mt-1 w-full px-2 py-1 border border-[var(--border)] rounded"
              rows={2}
            />
          ) : (
            <div>{invoice.customer_address || '-'}</div>
          )}
        </div>
      </div>
      {isEditMode && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() =>
              onSave({
                customer_name: formData.customer_name,
                customer_registration_no: formData.customer_registration_no,
                customer_sst_number: formData.customer_sst_number,
                customer_address: formData.customer_address,
              })
            }
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors"
          >
            {t.documents.invoiceDetailPage.saveChanges}
          </button>
        </div>
      )}
    </div>
  );
}

function BankingDetailsCard({ invoice, isEditMode, t, onSave }: any) {
  const [formData, setFormData] = useState(invoice);

  useEffect(() => {
    setFormData(invoice);
  }, [invoice]);

  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
      <h3 className="text-lg font-semibold mb-4">{t.documents.invoiceDetailPage.bankingDetails}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <b>{t.documents.invoiceDetailPage.bankName}</b>{' '}
          {isEditMode ? (
            <input
              type="text"
              value={formData.bank_name || ''}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              className="mt-1 w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            <span>{invoice.bank_name || '-'}</span>
          )}
        </div>
        <div>
          <b>{t.documents.invoiceDetailPage.accountNo}</b>{' '}
          {isEditMode ? (
            <input
              type="text"
              value={formData.bank_account_no || ''}
              onChange={(e) => setFormData({ ...formData, bank_account_no: e.target.value })}
              className="mt-1 w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            <span>{invoice.bank_account_no || '-'}</span>
          )}
        </div>
        <div>
          <b>{t.documents.invoiceDetailPage.beneficiary}</b>{' '}
          {isEditMode ? (
            <input
              type="text"
              value={formData.bank_beneficiary_name || ''}
              onChange={(e) => setFormData({ ...formData, bank_beneficiary_name: e.target.value })}
              className="mt-1 w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            <span>{invoice.bank_beneficiary_name || '-'}</span>
          )}
        </div>
        <div>
          <b>{t.documents.invoiceDetailPage.swiftCode}</b>{' '}
          {isEditMode ? (
            <input
              type="text"
              value={formData.bank_swift_code || ''}
              onChange={(e) => setFormData({ ...formData, bank_swift_code: e.target.value })}
              className="mt-1 w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            <span>{invoice.bank_swift_code || '-'}</span>
          )}
        </div>
        <div className="md:col-span-2">
          <b>{t.documents.invoiceDetailPage.paymentMethods}</b>{' '}
          {isEditMode ? (
            <input
              type="text"
              value={formData.accepted_payment_methods || ''}
              onChange={(e) => setFormData({ ...formData, accepted_payment_methods: e.target.value })}
              className="mt-1 w-full px-2 py-1 border border-[var(--border)] rounded"
            />
          ) : (
            <span>{invoice.accepted_payment_methods || '-'}</span>
          )}
        </div>
      </div>
      {isEditMode && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() =>
              onSave({
                bank_name: formData.bank_name,
                bank_account_no: formData.bank_account_no,
                bank_beneficiary_name: formData.bank_beneficiary_name,
                bank_swift_code: formData.bank_swift_code,
                accepted_payment_methods: formData.accepted_payment_methods,
              })
            }
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors"
          >
            {t.documents.invoiceDetailPage.saveChanges}
          </button>
        </div>
      )}
    </div>
  );
}

function RemarksCard({ invoice, isEditMode, t, onSave }: any) {
  const [formData, setFormData] = useState(invoice);

  useEffect(() => {
    setFormData(invoice);
  }, [invoice]);

  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
      <h3 className="text-lg font-semibold mb-4">{t.documents.invoiceDetailPage.remarks}</h3>
      {isEditMode ? (
        <div className="space-y-3">
          <textarea
            value={formData.remarks || ''}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            className="w-full px-2 py-1 border border-[var(--border)] rounded"
            rows={3}
          />
          <div className="flex justify-end">
            <button
              onClick={() =>
                onSave({
                  remarks: formData.remarks,
                })
              }
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors"
            >
              {t.documents.invoiceDetailPage.saveChanges}
            </button>
          </div>
        </div>
      ) : (
        <div>{invoice.remarks || '-'}</div>
      )}
    </div>
  );
}

function LineItemsCard({
  invoiceId,
  lineItems,
  onAddLineItem,
  onUpdateLineItem,
  onDeleteLineItem,
  onAutoClassify,
  isClassifying,
  t,
}: any) {
  const [newItem, setNewItem] = useState<{
    description: string;
    quantity: number | "";
    unit_price: number | "";
    uom: string;
    tax_rate: number | "";
  }>({
    description: "",
    quantity: "",
    unit_price: "",
    uom: "",
    tax_rate: "",
  });

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<{
    description?: string;
    quantity?: number | "";
    unit_price?: number | "";
    uom?: string;
    tax_rate?: number | "";
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const computeLineTotal = (quantity?: number | "", unitPrice?: number | "") => {
    const q = typeof quantity === "string" ? parseFloat(quantity || "0") : quantity ?? 0;
    const p = typeof unitPrice === "string" ? parseFloat(unitPrice || "0") : unitPrice ?? 0;
    return Number((q * p).toFixed(2));
  };

  const handleNewItemChange = (field: keyof typeof newItem, value: string) => {
    if (field === "quantity" || field === "unit_price" || field === "tax_rate") {
      setNewItem((prev) => ({
        ...prev,
        [field]: value === "" ? "" : Number(value),
      }));
    } else {
      setNewItem((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handleEditingItemChange = (field: keyof NonNullable<typeof editingItem>, value: string) => {
    if (!editingItem) return;
    if (field === "quantity" || field === "unit_price" || field === "tax_rate") {
      setEditingItem({
        ...editingItem,
        [field]: value === "" ? "" : Number(value),
      });
    } else {
      setEditingItem({
        ...editingItem,
        [field]: value,
      });
    }
  };

  const handleCreate = async () => {
    if (!newItem.description.trim()) {
      alert("Description is required");
      return;
    }

    const quantity =
      typeof newItem.quantity === "string"
        ? parseFloat(newItem.quantity || "0")
        : newItem.quantity || 0;
    const unitPrice =
      typeof newItem.unit_price === "string"
        ? parseFloat(newItem.unit_price || "0")
        : newItem.unit_price || 0;

    if (!quantity || !unitPrice) {
      alert("Quantity and Unit Price must be greater than 0");
      return;
    }

    const payload: AddLineItemRequest = {
      description: newItem.description.trim(),
      quantity,
      unit_price: unitPrice,
      uom: newItem.uom || undefined,
      tax_rate:
        typeof newItem.tax_rate === "string"
          ? parseFloat(newItem.tax_rate || "0")
          : newItem.tax_rate || undefined,
      line_total: computeLineTotal(quantity, unitPrice),
    };

    try {
      setIsSaving(true);
      await onAddLineItem(payload);
      setNewItem({
        description: "",
        quantity: "",
        unit_price: "",
        uom: "",
        tax_rate: "",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (item: LineItem) => {
    setEditingItemId(item.id);
    setEditingItem({
      description: item.description,
      quantity: item.quantity ?? item.qty ?? 0,
      unit_price: item.unit_price ?? 0,
      uom: item.uom,
      tax_rate: item.tax_rate,
    });
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setEditingItem(null);
  };

  const handleUpdate = async () => {
    if (!editingItem || editingItemId == null) return;

    const quantity =
      typeof editingItem.quantity === "string"
        ? parseFloat(editingItem.quantity || "0")
        : editingItem.quantity;
    const unitPrice =
      typeof editingItem.unit_price === "string"
        ? parseFloat(editingItem.unit_price || "0")
        : editingItem.unit_price;

    const payload: UpdateLineItemRequest = {
      description: editingItem.description?.trim(),
      quantity,
      unit_price: unitPrice,
      uom: editingItem.uom || undefined,
      tax_rate:
        typeof editingItem.tax_rate === "string"
          ? parseFloat(editingItem.tax_rate || "0")
          : editingItem.tax_rate,
    };

    try {
      setIsSaving(true);
      await onUpdateLineItem(editingItemId, payload);
      cancelEditing();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this line item?")) return;
    try {
      setDeletingId(id);
      await onDeleteLineItem(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{t.documents.invoiceDetailPage.lineItems}</h3>
      </div>

      {lineItems.length > 0 ? (
        <div className="overflow-x-auto mb-4">
          <table className="w-full table-fixed">
            <thead className="bg-[var(--muted)]">
              <tr className="text-xs md:text-sm">
                <th className="px-3 py-2 text-left font-semibold text-[var(--foreground)] w-[32%]">
                  {t.documents.invoiceDetailPage.description}
                </th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--foreground)] w-[9%]">
                  {t.documents.invoiceDetailPage.qty}
                </th>
                <th className="px-3 py-2 text-left font-semibold text-[var(--foreground)] w-[10%]">
                  {t.documents.invoiceDetailPage.uom}
                </th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--foreground)] w-[14%]">
                  {t.documents.invoiceDetailPage.unitPrice}
                </th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--foreground)] w-[14%]">
                  {t.documents.invoiceDetailPage.lineTotal}
                </th>
                <th className="px-3 py-2 text-left font-semibold text-[var(--foreground)] w-[13%]">
                  {t.documents.invoiceDetailPage.account}
                </th>
                <th className="px-3 py-2 text-right font-semibold text-[var(--foreground)] w-[8%]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] align-middle">
              {lineItems.map((item: LineItem) => (
                <tr key={item.id}>
                  {editingItemId === item.id ? (
                    <>
                      <td className="px-3 py-2 align-top">
                        <input
                          className="w-full px-2 py-1.5 border border-[var(--border)] rounded-md text-sm bg-white dark:bg-[var(--input)]"
                          value={editingItem?.description ?? ""}
                          onChange={(e) => handleEditingItemChange("description", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        <input
                          type="number"
                          className="w-full px-2 py-1.5 border border-[var(--border)] rounded-md text-right text-sm bg-white dark:bg-[var(--input)]"
                          value={editingItem?.quantity ?? ""}
                          onChange={(e) => handleEditingItemChange("quantity", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          className="w-full px-2 py-1.5 border border-[var(--border)] rounded-md text-sm bg-white dark:bg-[var(--input)]"
                          value={editingItem?.uom ?? ""}
                          onChange={(e) => handleEditingItemChange("uom", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        <input
                          type="number"
                          className="w-full px-2 py-1.5 border border-[var(--border)] rounded-md text-right text-sm bg-white dark:bg-[var(--input)]"
                          value={editingItem?.unit_price ?? ""}
                          onChange={(e) => handleEditingItemChange("unit_price", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right align-top text-sm whitespace-nowrap">
                        {computeLineTotal(editingItem?.quantity, editingItem?.unit_price).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-sm align-top">
                        {item.account_name || <span className="text-[var(--muted-foreground)]">-</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-right space-x-1 align-top whitespace-nowrap">
                        <button
                          onClick={handleUpdate}
                          disabled={isSaving}
                          className="px-2.5 py-1 rounded-md bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="px-2.5 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--hover-bg-light)] dark:hover:bg-[var(--hover-bg)]"
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-sm align-top break-words">{item.description}</td>
                      <td className="px-3 py-2 text-sm text-right align-top whitespace-nowrap">
                        {item.quantity ?? item.qty}
                      </td>
                      <td className="px-3 py-2 text-sm align-top whitespace-nowrap">{item.uom || '-'}</td>
                      <td className="px-3 py-2 text-sm text-right align-top whitespace-nowrap">
                        {(item.unit_price || 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-sm text-right align-top whitespace-nowrap">
                        {(item.line_total ??
                          computeLineTotal(item.quantity ?? item.qty ?? 0, item.unit_price ?? 0)
                        ).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-sm align-top">
                        {item.account_name || <span className="text-[var(--muted-foreground)]">-</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-right space-x-1 align-top whitespace-nowrap">
                        <button
                          onClick={() => startEditing(item)}
                          className="px-2.5 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--hover-bg-light)] dark:hover:bg-[var(--hover-bg)]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="px-2.5 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === item.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {/* New line item row */}
              <tr>
                <td className="px-3 py-2 text-sm align-top">
                  <input
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm bg-white dark:bg-[var(--input)]"
                    placeholder={t.documents.invoiceDetailPage.description}
                    value={newItem.description}
                    onChange={(e) => handleNewItemChange("description", e.target.value)}
                  />
                </td>
                <td className="px-3 py-2 text-sm text-right align-top">
                  <input
                    type="number"
                    className="w-full px-2 py-2 border border-[var(--border)] rounded-md text-right text-sm bg-white dark:bg-[var(--input)]"
                    placeholder="0"
                    value={newItem.quantity}
                    onChange={(e) => handleNewItemChange("quantity", e.target.value)}
                  />
                </td>
                <td className="px-3 py-2 text-sm align-top">
                  <input
                    className="w-full px-2 py-2 border border-[var(--border)] rounded-md text-sm bg-white dark:bg-[var(--input)]"
                    placeholder={t.documents.invoiceDetailPage.uom}
                    value={newItem.uom}
                    onChange={(e) => handleNewItemChange("uom", e.target.value)}
                  />
                </td>
                <td className="px-3 py-2 text-sm text-right align-top">
                  <input
                    type="number"
                    className="w-full px-2 py-2 border border-[var(--border)] rounded-md text-right text-sm bg-white dark:bg-[var(--input)]"
                    placeholder="0.00"
                    value={newItem.unit_price}
                    onChange={(e) => handleNewItemChange("unit_price", e.target.value)}
                  />
                </td>
                <td className="px-3 py-2 text-sm text-right align-top whitespace-nowrap">
                  {computeLineTotal(newItem.quantity, newItem.unit_price).toFixed(2)}
                </td>
                <td className="px-3 py-2 text-sm align-top">
                  <span className="text-[var(--muted-foreground)]">-</span>
                </td>
                <td className="px-3 py-2 text-sm text-right align-top whitespace-nowrap">
                  <button
                    onClick={handleCreate}
                    disabled={isSaving}
                    className="px-4 py-2 text-xs rounded-md bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : t.documents.invoiceDetailPage.addLineItem}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-sm text-[var(--muted-foreground)] mb-4">{t.documents.invoiceDetailPage.noLineItems}</div>
      )}

      {/* AI Classify button hidden for now */}
      {/* <div className="flex gap-3">
        <button
          onClick={onAutoClassify}
          disabled={isClassifying}
          className="px-4 py-2 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg-light)] dark:hover:bg-[var(--hover-bg)] transition-colors disabled:opacity-50 hover:text-white"
        >
          {isClassifying ? t.documents.invoiceDetailPage.aiThinking : t.documents.invoiceDetailPage.aiClassifyAccount}
        </button>
      </div> */}
    </div>
  );
}

export default InvoiceDetail;
