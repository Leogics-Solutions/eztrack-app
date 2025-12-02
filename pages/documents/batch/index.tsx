'use client';

import { AppLayout } from "@/components/layout";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";

interface ProgressData {
  status: 'not_found' | 'waiting' | 'processing' | 'completed' | 'error';
  percentage?: number;
  current?: number;
  total?: number;
  message?: string;
  summary?: {
    created?: number;
    failed?: number;
    failed_files?: Array<{
      file?: string;
      type?: string;
      reason?: string;
      extracted?: {
        vendor_name?: string;
        invoice_no?: string;
        invoice_date?: string;
        total?: number;
      };
      duplicate_of?: {
        id?: number;
        vendor_name?: string;
        invoice_no?: string;
        invoice_date?: string;
        total?: number;
        status?: string;
      };
    }>;
  };
}

const BatchUpload = () => {
  const router = useRouter();
  const [useOcr, setUseOcr] = useState(true);
  const [autoClassify, setAutoClassify] = useState(true);
  const [batchRemark, setBatchRemark] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("Preparing upload...");
  const [progressDetails, setProgressDetails] = useState("");
  const [elapsedTime, setElapsedTime] = useState("0.0s");
  const [currentFileTime, setCurrentFileTime] = useState("0.0s");
  const [showFileTiming, setShowFileTiming] = useState(false);
  const [progressStatus, setProgressStatus] = useState<'normal' | 'error' | 'completed'>('normal');
  const [resultSummary, setResultSummary] = useState<ProgressData['summary'] | null>(null);
  const [showResultActions, setShowResultActions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const currentFileStartTimeRef = useRef<number>(0);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (timingIntervalRef.current) {
        clearInterval(timingIntervalRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) {
      alert('Please select at least one file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('use_ocr', useOcr ? 'on' : '');
    formData.append('auto_classify', autoClassify ? 'on' : '');
    formData.append('batch_remark', batchRemark);

    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    setIsUploading(true);
    setShowProgress(true);
    setProgressStatus('normal');
    setResultSummary(null);
    setShowResultActions(false);

    // Start timing
    startTimeRef.current = Date.now();
    currentFileStartTimeRef.current = Date.now();

    // Update elapsed time every 100ms
    timingIntervalRef.current = setInterval(() => {
      const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
      setElapsedTime(elapsed + 's');

      const currentFileElapsed = ((Date.now() - currentFileStartTimeRef.current) / 1000).toFixed(1);
      setCurrentFileTime(currentFileElapsed + 's');
    }, 100);

    try {
      // Start the batch upload
      const response = await fetch('/ap/invoices/batch', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      const batchId = result.batch_id;

      // Set up Server-Sent Events for progress updates
      const eventSource = new EventSource(`/api/batch-progress/${batchId}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        const progressData: ProgressData = JSON.parse(event.data);

        if (progressData.status === 'not_found') {
          setProgressText('Upload not found');
          setProgressDetails(progressData.message || 'Upload session expired');
          eventSource.close();
          return;
        }

        if (progressData.status === 'waiting') {
          setProgressText('Preparing upload...');
          setProgressDetails(progressData.message || 'Starting upload...');
        } else if (progressData.status === 'processing') {
          setProgress(progressData.percentage || 0);
          setProgressText(`Processing ${progressData.current} of ${progressData.total} files`);
          setProgressDetails(progressData.message || '');

          // Reset file timing when processing a new file
          if (progressData.message && progressData.message.includes('Processing')) {
            currentFileStartTimeRef.current = Date.now();
            setShowFileTiming(true);
          }
        } else if (progressData.status === 'completed') {
          setProgress(100);
          setProgressStatus('completed');
          setProgressText('Upload completed successfully!');
          setProgressDetails(progressData.message || '');
          setResultSummary(progressData.summary || null);
          setShowResultActions(true);
          eventSource.close();

          if (timingIntervalRef.current) {
            clearInterval(timingIntervalRef.current);
          }
        } else if (progressData.status === 'error') {
          setProgress(100);
          setProgressStatus('error');
          setProgressText('Upload failed');
          setProgressDetails(progressData.message || '');
          eventSource.close();

          if (timingIntervalRef.current) {
            clearInterval(timingIntervalRef.current);
          }

          setIsUploading(false);
        }
      };

      eventSource.onerror = () => {
        setProgressText('Connection error');
        setProgressDetails('Lost connection to server');
        eventSource.close();

        if (timingIntervalRef.current) {
          clearInterval(timingIntervalRef.current);
        }

        setIsUploading(false);
      };

    } catch (error) {
      setProgressText('Upload failed');
      setProgressDetails(error instanceof Error ? error.message : 'Unknown error');
      setProgressStatus('error');

      if (timingIntervalRef.current) {
        clearInterval(timingIntervalRef.current);
      }

      setIsUploading(false);
    }
  };

  const duplicates = resultSummary?.failed_files?.filter(ff => ff && ff.type === 'duplicate') || [];
  const errors = resultSummary?.failed_files?.filter(ff => !ff || ff.type !== 'duplicate') || [];

  return (
    <AppLayout pageName="Batch Upload Invoices">
      <div className="">
        <h1 className="text-3xl font-bold mb-6">Batch Upload Invoices</h1>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6 mb-6">
          <div className="mb-6">
            <label className="flex items-start space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useOcr}
                onChange={(e) => setUseOcr(e.target.checked)}
                className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] mt-0.5"
              />
              <div>
                <span className="text-sm font-medium">Use OCR (image/PDF via AI)</span>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Automatically extract vendor and invoice details from uploaded files
                </div>
              </div>
            </label>
          </div>

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

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Select files (multiple) <span className="text-[var(--error)]">*</span>
            </label>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              required
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[var(--primary)] file:text-white hover:file:bg-[var(--primary-hover)] file:cursor-pointer"
            />
            <small className="text-xs text-[var(--muted-foreground)] mt-1 block">
              Images (JPG/PNG/WebP), PDFs, or demo .txt files
            </small>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Remark / Tag <span className="text-[var(--muted-foreground)]">(optional - applies to all invoices)</span>
            </label>
            <input
              type="text"
              value={batchRemark}
              onChange={(e) => setBatchRemark(e.target.value)}
              placeholder="e.g., Project A, Q1 2025, Supplier Review"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
            />
            <small className="text-xs text-[var(--muted-foreground)] mt-1 block">
              This remark will be applied to all invoices in this batch
            </small>
          </div>

          <button
            type="submit"
            disabled={isUploading}
            className="w-full px-4 py-3 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : 'Start Upload'}
          </button>
        </form>

        {/* Progress Bar */}
        {showProgress && (
          <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6 mb-6">
            <h3 className="text-lg font-semibold mb-3">Upload Progress</h3>

            <div className="w-full h-5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  progressStatus === 'error' ? 'bg-[var(--error)]' :
                  progressStatus === 'completed' ? 'bg-[var(--primary)]' : 'bg-green-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mb-2 text-sm">{progressText}</div>
            <div className="text-[var(--muted-foreground)] text-sm mb-4">{progressDetails}</div>

            {/* Result Summary */}
            {resultSummary && (
              <div className="mt-4">
                <div className="mb-2 text-sm">
                  Created: {resultSummary.created ?? 0} • Failed: {resultSummary.failed ?? 0}
                </div>

                {/* Duplicate Invoices */}
                {duplicates.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2 text-sm">Duplicate Invoices</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border border-[var(--border)]">
                        <thead className="bg-gray-100 dark:bg-gray-800">
                          <tr>
                            <th className="border border-[var(--border)] px-4 py-2 text-left text-xs font-medium">File</th>
                            <th className="border border-[var(--border)] px-4 py-2 text-left text-xs font-medium">Vendor</th>
                            <th className="border border-[var(--border)] px-4 py-2 text-left text-xs font-medium">Invoice No</th>
                            <th className="border border-[var(--border)] px-4 py-2 text-left text-xs font-medium">Date</th>
                            <th className="border border-[var(--border)] px-4 py-2 text-left text-xs font-medium">Total</th>
                            <th className="border border-[var(--border)] px-4 py-2 text-left text-xs font-medium">Existing</th>
                            <th className="border border-[var(--border)] px-4 py-2 text-left text-xs font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {duplicates.map((ff, idx) => {
                            const file = ff.file || '<unknown>';
                            const ex = ff.extracted || {};
                            const du = ff.duplicate_of || {};
                            const exVendor = ex.vendor_name || du.vendor_name || '-';
                            const exNo = ex.invoice_no || du.invoice_no || '-';
                            const exDate = ex.invoice_date || du.invoice_date || '-';
                            const exTotal = (ex.total != null ? ex.total : (du.total != null ? du.total : '-'));
                            const existingLabel = du.id ? `#${du.id} (${du.status || '-'})` : '-';

                            return (
                              <tr key={idx}>
                                <td className="border border-[var(--border)] px-4 py-2 text-xs">{file}</td>
                                <td className="border border-[var(--border)] px-4 py-2 text-xs">{exVendor}</td>
                                <td className="border border-[var(--border)] px-4 py-2 text-xs">{exNo}</td>
                                <td className="border border-[var(--border)] px-4 py-2 text-xs">{exDate}</td>
                                <td className="border border-[var(--border)] px-4 py-2 text-xs">
                                  {exTotal !== '-' ? Number(exTotal).toFixed(2) : '-'}
                                </td>
                                <td className="border border-[var(--border)] px-4 py-2 text-xs">{existingLabel}</td>
                                <td className="border border-[var(--border)] px-4 py-2 text-xs">
                                  {du.id && (
                                    <a
                                      href={`/ap/invoices/${du.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[var(--primary)] hover:underline"
                                    >
                                      Open
                                    </a>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Other Errors */}
                {errors.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2 text-sm">Other Errors</h4>
                    <div className="max-h-44 overflow-auto border border-[var(--border)] rounded-lg p-2 whitespace-pre-wrap text-xs text-[var(--muted-foreground)]">
                      {errors.map((ff, idx) => {
                        const name = ff && ff.file ? ff.file : '<unknown>';
                        const reason = ff && ff.reason ? ff.reason : 'unknown error';
                        return <div key={idx}>- {name}: {reason}</div>;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Result Actions */}
            {showResultActions && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => router.push('/ap/invoices')}
                  className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors font-medium text-sm"
                >
                  Go to Documents
                </button>
                <button
                  onClick={() => {}}
                  className="px-4 py-2 bg-[var(--hover-bg-lighter)] hover:bg-[var(--hover-bg-light)] dark:bg-[var(--hover-border)] dark:hover:bg-[var(--hover-bg-light)] rounded-md transition-colors font-medium text-sm"
                >
                  Stay Here
                </button>
              </div>
            )}

            {/* Timing Information */}
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <h4 className="font-semibold mb-2 text-sm">Processing Time</h4>
              <div className="text-sm">
                <div>Elapsed: <span className="font-mono font-bold">{elapsedTime}</span></div>
                {showFileTiming && (
                  <div>Current file: <span className="font-mono font-bold">{currentFileTime}</span></div>
                )}
              </div>
            </div>
          </div>
        )}

        <p className="mt-6 text-sm text-[var(--muted-foreground)]">
          <strong>Tips:</strong>
          <br />- With OCR enabled, vendor and invoice fields will be auto-extracted when possible.
          <br />- With auto-classify enabled, line items will be automatically assigned to chart of accounts.
          <br />- Without OCR, invoices will be created as draft with minimal details and source file stored.
        </p>
      </div>
    </AppLayout>
  );
};

export default BatchUpload;