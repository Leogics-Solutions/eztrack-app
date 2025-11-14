'use client';

import { AppLayout } from "@/components/layout";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";

// Types
interface Vendor {
  id: number;
  name: string;
}

const NewInvoice = () => {
  const router = useRouter();

  // State
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [useOCR, setUseOCR] = useState(true);
  const [autoClassify, setAutoClassify] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [remark, setRemark] = useState('');

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

  // Handle OCR extraction
  const extractAndFill = async (uploadedFile: File) => {
    const fd = new FormData();
    fd.append('file', uploadedFile);

    try {
      // TODO: Replace with actual API endpoint
      const res = await fetch('/api/ocr-extract', { method: 'POST', body: fd });
      const data = await res.json();

      if (!data.ok) {
        alert('OCR failed: ' + (data.error || 'unknown'));
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
      alert('OCR error: ' + e);
    }
  };

  // Handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
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

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      alert('Please select a file to upload');
      return;
    }

    startProcessingTimer();

    const formData = new FormData();
    formData.append('vendor_id', vendorId);
    formData.append('use_ocr', useOCR.toString());
    formData.append('auto_classify', autoClassify.toString());
    formData.append('file', file);
    formData.append('remark', remark);

    if (!isAIEnabled) {
      formData.append('invoice_no', invoiceNo);
      formData.append('invoice_date', invoiceDate);
      formData.append('currency', currency);
      formData.append('subtotal', subtotal);
      formData.append('tax', tax);
      formData.append('total', total);
    }

    try {
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/invoices/create', {
        method: 'POST',
        body: formData,
      });

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setIsProcessing(false);

      if (response.ok) {
        const result = await response.json();
        alert('Invoice created successfully!');
        router.push('/documents');
      } else {
        alert('Failed to create invoice');
      }
    } catch (error) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setIsProcessing(false);
      console.error('Error creating invoice:', error);
      alert('Error creating invoice');
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
    <AppLayout pageName="New Invoice">
      <div className="">
        <h1 className="text-3xl font-bold mb-6">New Invoice</h1>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
          {/* Vendor and OCR Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Vendor</label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
              >
                <option value="">-- Select vendor --</option>
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
                <span className="text-sm font-medium">Use AI OCR</span>
              </label>
            </div>
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
                  Auto-classify Line Items <span className="text-[var(--muted-foreground)]">(AI)</span>
                </span>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Automatically classify line items to chart of accounts when processing
                </div>
              </div>
            </label>
          </div>

          {/* File Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Upload file (image for OCR or .txt for demo) <span className="text-[var(--error)]">*</span>
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              required
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[var(--primary)] file:text-white hover:file:bg-[var(--primary-hover)] file:cursor-pointer"
            />
            <small className="text-xs text-[var(--muted-foreground)] mt-1 block">
              File attachment is required to create an invoice
            </small>
          </div>

          {/* Remark/Tag */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Remark / Tag <span className="text-[var(--muted-foreground)]">(optional)</span>
            </label>
            <input
              type="text"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="e.g., Project A, Q1 2025, Office Supplies"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
            />
            <small className="text-xs text-[var(--muted-foreground)] mt-1 block">
              Add a tag to easily filter and group invoices later
            </small>
          </div>

          {/* AI Enabled Message */}
          {isAIEnabled && (
            <div className="mb-6 px-3 py-7  bg-[var(--info-light)] border border-[var(--info)] rounded-md">
              <p className="text-sm">
                <strong>AI Mode:</strong> Invoice details will be automatically extracted from the uploaded file.
              </p>
            </div>
          )}

          {/* Manual Input Fields */}
          {!isAIEnabled && (
            <div className="space-y-6 mb-6">
              {/* Invoice Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Invoice No</label>
                  <input
                    type="text"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Invoice Date</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Currency</label>
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
                  <label className="block text-sm font-medium mb-2">Subtotal</label>
                  <input
                    type="number"
                    step="0.01"
                    value={subtotal}
                    onChange={(e) => setSubtotal(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tax</label>
                  <input
                    type="number"
                    step="0.01"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Total</label>
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
          >
            Create
          </button>
        </form>

        {/* Timing Information */}
        {showTiming && (
          <div className="mt-6 bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6">
            <h3 className="text-lg font-semibold mb-3">Processing Time</h3>
            <div>
              {isProcessing ? (
                <p className="text-sm">
                  Processing invoice... <span className="font-mono font-bold">{processingTime.toFixed(1)}</span>s
                </p>
              ) : (
                <p className="text-sm">
                  Processing completed in <span className="font-mono font-bold">{processingTime.toFixed(1)}</span>s
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tip */}
        <p className="mt-6 text-sm text-[var(--muted-foreground)]">
          Tip: For quick OCR-free testing, upload the sample at <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">sample_data/sample_invoice.txt</code>.
        </p>
      </div>
    </AppLayout>
  );
};

export default NewInvoice;