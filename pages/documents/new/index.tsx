'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { FileUpload } from "@/components/FileUpload";
import { InvoiceScanner } from "@/components/InvoiceScanner";
import { uploadInvoice, DocumentType } from "@/services";

// Types
interface Vendor {
  id: number;
  name: string;
}

const NewInvoice = () => {
  const router = useRouter();
  const { t } = useLanguage();

  // State
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [useOCR, setUseOCR] = useState(true);
  const [autoClassify, setAutoClassify] = useState(true);
  const [documentType, setDocumentType] = useState<DocumentType>('auto');
  const [documentCategory, setDocumentCategory] = useState<string>('auto');
  const [documentSubCategory, setDocumentSubCategory] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [remark, setRemark] = useState('');
  const [scannerSession, setScannerSession] = useState<any>(null);

  // Manual input fields
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [currency, setCurrency] = useState('MYR');
  const [subtotal, setSubtotal] = useState('');
  const [tax, setTax] = useState('');
  const [total, setTotal] = useState('');

  // Timing state
  const [showTiming, setShowTiming] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Load vendors
  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    // TODO: Replace with actual API call
    setVendors([
      { id: 1, name: 'Sample Vendor Ltd' },
      { id: 2, name: 'Another Vendor Co' },
      { id: 3, name: 'Tech Solutions Inc' },
    ]);
  };

  // Check if AI mode is enabled
  const isAIEnabled = useOCR && autoClassify;

  // Find vendor by name
  const findVendorIdByName = (name: string): number | null => {
    if (!name) return null;
    const lower = name.toLowerCase();
    const match = vendors.find(v => v.name.toLowerCase() === lower);
    return match ? match.id : null;
  };

  // Handle document category change
  const handleCategoryChange = (category: string) => {
    setDocumentCategory(category);
    setDocumentSubCategory('');
    
    // Map category to document type
    if (category === 'petty_cash') {
      setDocumentType('petty_cash');
    } else if (category === 'claims_compilation') {
      setDocumentType('claims_compilation');
    } else {
      setDocumentType(category as DocumentType);
    }
  };

  // Handle document sub-category change
  const handleSubCategoryChange = (subCategory: string) => {
    setDocumentSubCategory(subCategory);
    
    // Keep document_type as base category (petty_cash or claims_compilation)
    // The sub-category will be passed separately as document_sub_type
    // This aligns with backend which expects: document_type + document_sub_type
    if (subCategory === '') {
      // Reset to base category type
      if (documentCategory === 'petty_cash') {
        setDocumentType('petty_cash');
      } else if (documentCategory === 'claims_compilation') {
        setDocumentType('claims_compilation');
      }
    }
    // documentType stays as the base category (petty_cash or claims_compilation)
    // documentSubCategory will be passed separately to backend
  };

  // Handle OCR extraction
  const extractAndFill = async (uploadedFile: File) => {
    const fd = new FormData();
    fd.append('file', uploadedFile);

    try {
      // TODO: Replace with actual API endpoint
      const res = await fetch('/api/ocr-extract', { method: 'POST', body: fd });
      const data = await res.json();

      if (!data.ok) {
        alert(t.documents.newInvoicePage.alerts.ocrFailed + ' ' + (data.error || 'unknown'));
        return;
      }

      const d = data.data || {};

      if (d.vendor_name) {
        const vid = findVendorIdByName(d.vendor_name);
        if (vid) setVendorId(vid.toString());
      }
      if (d.invoice_no) setInvoiceNo(d.invoice_no);
      if (d.invoice_date) setInvoiceDate(d.invoice_date);
      if (d.currency) setCurrency(d.currency);
      if (d.subtotal != null) setSubtotal(d.subtotal.toString());
      if (d.tax != null) setTax(d.tax.toString());
      if (d.total != null) setTotal(d.total.toString());
    } catch (e) {
      alert(t.documents.newInvoicePage.alerts.ocrError + ' ' + e);
    }
  };

  // Handle file change
  const handleFileSelect = (selectedFile: File | null) => {
    setFile(selectedFile);

    if (selectedFile && useOCR) {
      extractAndFill(selectedFile);
    }
  };

  // Start processing timer
  const startProcessingTimer = () => {
    setShowTiming(true);
    setIsProcessing(true);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = ((Date.now() - startTimeRef.current) / 1000);
      setProcessingTime(elapsed);
    }, 100);

    // Auto-clear after 30 seconds
    setTimeout(() => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        setIsProcessing(false);
      }
    }, 30000);
  };

  // Handle scanner session completion
  // Note: The InvoiceScanner now handles the completeGroup API call internally
  // This callback is called after async processing starts (not when invoice is created)
  // We stay on the page so user can immediately scan the next invoice
  const handleScannerComplete = async (session: any) => {
    setScannerSession(session);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsProcessing(false);

    // Invoice is processing in the background asynchronously
    // Don't redirect - let user continue scanning next invoice
    // The InvoiceScanner component will show success message and allow "Scan Next Invoice"
    console.log('Invoice processing started in background for session:', session);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      alert(t.documents.newInvoicePage.alerts.selectFile);
      return;
    }

    startProcessingTimer();

    try {
      // Use backend /invoices/upload via InvoiceService
      // const response = await uploadInvoice(file, { auto_classify: autoClassify });
      const response = await uploadInvoice(file, { 
        auto_classify: autoClassify,
        document_type: documentType,
        document_sub_type: documentSubCategory || undefined,
      });

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setIsProcessing(false);

      if (response.success) {
        alert(t.documents.newInvoicePage.alerts.createSuccess);
        router.push('/documents');
      } else {
        alert(t.documents.newInvoicePage.alerts.createFailed);
      }
    } catch (error) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setIsProcessing(false);
      console.error('Error creating invoice:', error);
      alert(t.documents.newInvoicePage.alerts.createError);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return (
    <AppLayout pageName={t.documents.newInvoicePage.title}>
      <div className="">
        <h1 className="text-3xl font-bold mb-6">{t.documents.newInvoicePage.title}</h1>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
          {/* Vendor and OCR Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">{t.documents.newInvoicePage.vendor}</label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
              >
                <option value="">{t.documents.newInvoicePage.selectVendor}</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useOCR}
                  onChange={(e) => setUseOCR(e.target.checked)}
                  className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span className="text-sm font-medium">{t.documents.newInvoicePage.useAIOCR}</span>
              </label>
            </div>
          </div>

          {/* Document Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Document Type</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <select
                  value={documentCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="invoice">Invoice</option>
                  <option value="petty_cash">Petty Cash</option>
                  <option value="claims_compilation">Claims Compilation</option>
                </select>
              </div>
              {(documentCategory === 'petty_cash' || documentCategory === 'claims_compilation') && (
                <div>
                  <select
                    value={documentSubCategory}
                    onChange={(e) => handleSubCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  >
                    <option value="">Select sub-category...</option>
                    {documentCategory === 'petty_cash' && (
                      <option value="summary">Summary Petty Cash</option>
                    )}
                    {documentCategory === 'claims_compilation' && (
                      <>
                        <option value="director">Director Claims</option>
                        <option value="staff">Staff Claims</option>
                      </>
                    )}
                  </select>
                </div>
              )}
            </div>
            <small className="text-xs text-[var(--muted-foreground)] mt-1 block">
              {documentType === 'petty_cash' && documentSubCategory === 'summary'
                ? 'Summary Petty Cash: Processes petty cash summary documents. Sub-category will be saved to invoice remarks.'
                : documentType === 'petty_cash'
                ? 'Petty cash documents skip summary validation.'
                : documentType === 'claims_compilation' && documentSubCategory === 'director'
                ? 'Director Claims: Processes director claims compilation documents. Sub-category will be saved to invoice remarks.'
                : documentType === 'claims_compilation' && documentSubCategory === 'staff'
                ? 'Staff Claims: Processes staff claims compilation documents. Sub-category will be saved to invoice remarks.'
                : documentType === 'claims_compilation'
                ? 'Claims compilation processes scanned multi-receipt PDFs.'
                : 'Select the document type. Petty cash documents skip summary validation. Claims compilation processes scanned multi-receipt PDFs.'
              }
            </small>
          </div>

          {/* Auto-classify checkbox */}
          <div className="mb-6">
            <label className="flex items-start space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoClassify}
                onChange={(e) => setAutoClassify(e.target.checked)}
                className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] mt-0.5"
              />
              <div>
                <span className="text-sm font-medium">
                  {t.documents.newInvoicePage.autoClassify} <span className="text-[var(--muted-foreground)]">(AI)</span>
                </span>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {t.documents.newInvoicePage.autoClassifyDescription}
                </div>
              </div>
            </label>
          </div>

          {/* File Upload / Scanner */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              {t.documents.newInvoicePage.uploadFile} <span className="text-[var(--error)]">{t.documents.newInvoicePage.uploadFileRequired}</span>
            </label>
            <InvoiceScanner
              onComplete={handleScannerComplete}
              autoClassify={autoClassify}
            />
            <small className="text-xs text-[var(--muted-foreground)] mt-2 block">
              {t.documents.newInvoicePage.uploadFileHelp}
            </small>
          </div>

          {/* Remark/Tag */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              {t.documents.newInvoicePage.remarkTag} <span className="text-[var(--muted-foreground)]">{t.documents.newInvoicePage.remarkTagOptional}</span>
            </label>
            <input
              type="text"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder={t.documents.newInvoicePage.remarkTagPlaceholder}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
            />
            <small className="text-xs text-[var(--muted-foreground)] mt-1 block">
              {t.documents.newInvoicePage.remarkTagHelp}
            </small>
          </div>

          {/* AI Enabled Message */}
          {isAIEnabled && (
            <div className="mb-6 px-3 py-7  bg-[var(--info-light)] border border-[var(--info)] rounded-md">
              <p className="text-sm">
                <strong>{t.documents.newInvoicePage.aiMode}</strong> {t.documents.newInvoicePage.aiModeDescription}
              </p>
            </div>
          )}

          {/* Manual Input Fields */}
          {!isAIEnabled && (
            <div className="space-y-6 mb-6">
              {/* Invoice Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t.documents.newInvoicePage.invoiceNo}</label>
                  <input
                    type="text"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t.documents.newInvoicePage.invoiceDate}</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t.documents.newInvoicePage.currency}</label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>
              </div>

              {/* Financial Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t.documents.newInvoicePage.subtotal}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={subtotal}
                    onChange={(e) => setSubtotal(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t.documents.newInvoicePage.tax}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t.documents.newInvoicePage.total}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full px-4 py-3 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors font-medium"
            style={{ display: 'none' }}
          >
            {t.documents.newInvoicePage.create}
          </button>
        </form>

        {/* Timing Information */}
        {showTiming && (
          <div className="mt-6 bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
            <h3 className="text-lg font-semibold mb-3">{t.documents.newInvoicePage.processingTime}</h3>
            <div>
              {isProcessing ? (
                <p className="text-sm">
                  {t.documents.newInvoicePage.processing} <span className="font-mono font-bold">{processingTime.toFixed(1)}</span>s
                </p>
              ) : (
                <p className="text-sm">
                  {t.documents.newInvoicePage.processingCompleted} <span className="font-mono font-bold">{processingTime.toFixed(1)}</span>s
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tip */}
        <p className="mt-6 text-sm text-[var(--muted-foreground)]">
          {t.documents.newInvoicePage.tip} <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">{t.documents.newInvoicePage.tipCode}</code>.
        </p>
      </div>
    </AppLayout>
  );
};

export default NewInvoice;