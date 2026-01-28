'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { FileUpload } from "@/components/FileUpload";
import { batchUploadSupportingDocuments, getDocumentBatchJobStatus, DocumentType, DocumentDirection } from "@/services";

interface FileMetadata {
  document_type: DocumentType;
  direction?: DocumentDirection;
}

interface JobProgress {
  jobId: string;
  filename: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  documentId: number | null;
  errorMessage: string | null;
}

interface ResultSummary {
  created: number;
  failed: number;
  failed_files: Array<{
    file: string;
    type: 'error';
    reason: string;
  }>;
}

const SupportingDocumentsBatchUpload = () => {
  const router = useRouter();
  const { t } = useLanguage();
  const [batchRemark, setBatchRemark] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [progressDetails, setProgressDetails] = useState("");
  const [elapsedTime, setElapsedTime] = useState("0.0s");
  const [currentFileTime, setCurrentFileTime] = useState("0.0s");
  const [showFileTiming, setShowFileTiming] = useState(false);
  const [progressStatus, setProgressStatus] = useState<'normal' | 'error' | 'completed'>('normal');
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(null);
  const [showResultActions, setShowResultActions] = useState(false);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileMetadata, setFileMetadata] = useState<FileMetadata[]>([]);
  const [defaultDocumentType, setDefaultDocumentType] = useState<DocumentType>('delivery_order');
  const [defaultDirection, setDefaultDirection] = useState<DocumentDirection | undefined>(undefined);
  const [jobProgresses, setJobProgresses] = useState<JobProgress[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const currentFileStartTimeRef = useRef<number>(0);
  const isCompletedRef = useRef<boolean>(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (timingIntervalRef.current) {
        clearInterval(timingIntervalRef.current);
      }
    };
  }, []);

  const handleFilesSelect = (files: File[]) => {
    setSelectedFiles(files);
    // Initialize metadata for each file with pre-selected default values
    setFileMetadata(
      files.map(() => ({
        document_type: defaultDocumentType,
        direction: defaultDirection,
      }))
    );
  };

  const applyDefaultsToAll = () => {
    if (selectedFiles.length === 0) return;
    setFileMetadata(
      selectedFiles.map(() => ({
        document_type: defaultDocumentType,
        direction: defaultDirection,
      }))
    );
  };

  const updateFileMetadata = (index: number, field: keyof FileMetadata, value: DocumentType | DocumentDirection | undefined) => {
    const newMetadata = [...fileMetadata];
    newMetadata[index] = {
      ...newMetadata[index],
      [field]: value,
    };
    setFileMetadata(newMetadata);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedFiles || selectedFiles.length === 0) {
      alert(t.documents.batchUploadPage.alerts.selectAtLeastOne);
      return;
    }

    // Validate that all files have document_type
    const invalidFiles = fileMetadata.filter((meta, idx) => !meta.document_type);
    if (invalidFiles.length > 0) {
      alert('Please select a document type for all files.');
      return;
    }

    setIsUploading(true);
    setShowProgress(true);
    setProgressStatus('normal');
    setResultSummary(null);
    setShowResultActions(false);
    setJobProgresses([]);

    // Start timing
    startTimeRef.current = Date.now();
    currentFileStartTimeRef.current = Date.now();

    // Reset completion flag
    isCompletedRef.current = false;

    // Update elapsed time every 100ms
    timingIntervalRef.current = setInterval(() => {
      // Don't update if already completed
      if (isCompletedRef.current) {
        return;
      }
      const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
      setElapsedTime(elapsed + 's');

      const currentFileElapsed = ((Date.now() - currentFileStartTimeRef.current) / 1000).toFixed(1);
      setCurrentFileTime(currentFileElapsed + 's');
    }, 100);

    try {
      // Upload files using supporting documents batch upload API
      setProgressText(t.documents.batchUploadPage.preparingUpload);
      setProgressDetails('Uploading supporting documents...');
      
      const uploadResponse = await batchUploadSupportingDocuments(
        selectedFiles,
        fileMetadata,
        {
          remark: batchRemark || undefined,
        }
      );
      
      if (!uploadResponse.success || !uploadResponse.data) {
        throw new Error('Upload failed');
      }

      // Handle both async (jobs) and sync (items) response formats
      const jobs = uploadResponse.data.jobs || [];
      const items = (uploadResponse.data as any).items || [];
      const failures = uploadResponse.data.failures || [];
      const totalFiles = uploadResponse.data.total_files ?? selectedFiles.length;
      
      // If we have items (sync response), mark them as SUCCESS immediately
      // If we have jobs (async response), mark them as PENDING for polling
      const localFailures: JobProgress[] = failures.map((f, idx) => ({
        jobId: `local-failure:${f.index ?? idx}`,
        filename: f.filename,
        status: 'FAILED',
        documentId: null,
        errorMessage: f.reason || 'Upload failed',
      }));

      const syncSuccesses: JobProgress[] = items.map((item: any, idx: number) => ({
        jobId: `sync-success:${item.document_id ?? idx}`,
        filename: item.filename,
        status: 'SUCCESS' as const,
        documentId: item.document_id ?? null,
        errorMessage: null,
      }));

      const asyncJobs: JobProgress[] = jobs.map(job => ({
        jobId: job.job_id,
        filename: job.filename,
        status: 'PENDING' as const,
        documentId: (job as any).document_id ?? null,
        errorMessage: null,
      }));

      const initialProgresses: JobProgress[] = [
        ...localFailures,
        ...syncSuccesses,
        ...asyncJobs,
      ];
      setJobProgresses(initialProgresses);

      // If we only have sync successes (no jobs to poll), mark as completed
      if (items.length > 0 && jobs.length === 0) {
        setProgress(100);
        setProgressStatus('completed');
        setProgressText(t.documents.batchUploadPage.uploadCompleted);
        setProgressDetails(`Successfully processed ${items.length} file(s)`);
        setResultSummary({
          created: items.length,
          failed: localFailures.length,
          failed_files: localFailures.map(f => ({
            file: f.filename,
            type: 'error' as const,
            reason: f.errorMessage || 'Upload failed',
          })),
        });
        setShowResultActions(true);
        
        // Mark as completed to stop timing updates
        isCompletedRef.current = true;
        
        // Stop timing interval
        if (timingIntervalRef.current) {
          clearInterval(timingIntervalRef.current);
          timingIntervalRef.current = null;
        }
        
        setIsUploading(false);
        return;
      }

      // Start polling for job statuses (only if we have async jobs)
      if (jobs.length === 0) {
        return; // Already handled sync responses above
      }

      const pollJobs = async () => {
        const updatedProgresses: JobProgress[] = [...localFailures, ...syncSuccesses];
        let allCompleted = true;
        let runningCount = 0;
        let successCount = syncSuccesses.length;
        let failedCount = localFailures.length;

        for (const job of jobs) {
          try {
            const statusResponse = await getDocumentBatchJobStatus(job.job_id);
            if (statusResponse.success && statusResponse.data?.data) {
              const jobData = statusResponse.data.data;
              updatedProgresses.push({
                jobId: job.job_id,
                filename: jobData.original_filename || job.filename,
                status: jobData.status,
                documentId: (jobData as any).document_id || jobData.invoice_id || null,
                errorMessage: jobData.error_message,
              });

              if (jobData.status === 'RUNNING') {
                allCompleted = false;
                runningCount++;
                currentFileStartTimeRef.current = Date.now();
                setShowFileTiming(true);
              } else if (jobData.status === 'SUCCESS') {
                successCount++;
              } else if (jobData.status === 'FAILED') {
                failedCount++;
              } else if (jobData.status === 'PENDING') {
                allCompleted = false;
              }
            }
          } catch (error) {
            console.error(`Error polling job ${job.job_id}:`, error);
            updatedProgresses.push({
              jobId: job.job_id,
              filename: job.filename,
              status: 'FAILED',
              documentId: null,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
            failedCount++;
          }
        }

        setJobProgresses(updatedProgresses);

        // Update progress percentage
        const total = totalFiles;
        const completed = successCount + failedCount;
        const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
        setProgress(progressPercent);

        // Update progress text
        if (runningCount > 0) {
          setProgressText(`${t.documents.batchUploadPage.processing} ${Math.min(completed + 1, total)} of ${total} files`);
          setProgressDetails(`Processing ${runningCount} file(s)...`);
        } else if (allCompleted) {
          setProgress(100);
          setProgressStatus('completed');
          setProgressText(t.documents.batchUploadPage.uploadCompleted);
          setProgressDetails(`Successfully processed ${successCount} file(s)${failedCount > 0 ? `, ${failedCount} failed` : ''}`);
          
          // Build result summary
          const failedFiles: ResultSummary['failed_files'] = updatedProgresses
            .filter(jp => jp.status === 'FAILED')
            .map(jp => ({
              file: jp.filename,
              type: 'error' as const,
              reason: jp.errorMessage || 'Processing failed',
            }));
          
          setResultSummary({
            created: successCount,
            failed: failedCount,
            failed_files: failedFiles,
          });
          setShowResultActions(true);

          // Mark as completed to stop timing updates
          isCompletedRef.current = true;

          // Stop polling and timing
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          if (timingIntervalRef.current) {
            clearInterval(timingIntervalRef.current);
            timingIntervalRef.current = null;
          }
          setIsUploading(false);
          return; // Exit early to prevent further polling
        }
      };

      // Poll immediately, then every 2 seconds
      await pollJobs();
      pollingIntervalRef.current = setInterval(pollJobs, 2000);

    } catch (error) {
      setProgressText(t.documents.batchUploadPage.uploadFailed);
      setProgressDetails(error instanceof Error ? error.message : 'Unknown error');
      setProgressStatus('error');

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (timingIntervalRef.current) {
        clearInterval(timingIntervalRef.current);
        timingIntervalRef.current = null;
      }

      setIsUploading(false);
    }
  };

  // Get failed jobs from jobProgresses for display
  const failedJobs = jobProgresses.filter(jp => jp.status === 'FAILED');
  const successfulJobs = jobProgresses.filter(jp => jp.status === 'SUCCESS');
  const errors = resultSummary?.failed_files?.filter(ff => !!ff) || [];

  const documentTypeOptions: { value: DocumentType; label: string }[] = [
    { value: 'delivery_order', label: 'Delivery Order (DO)' },
    { value: 'transfer_note', label: 'Transfer Note' },
    { value: 'purchase_order', label: 'Purchase Order (PO)' },
    { value: 'payment_voucher', label: 'Payment Voucher' },
  ];

  const directionOptions: { value: DocumentDirection; label: string }[] = [
    { value: 'AP', label: 'AP (Accounts Payable)' },
    { value: 'AR', label: 'AR (Accounts Receivable)' },
    { value: 'NEUTRAL', label: 'Neutral' },
  ];

  return (
    <AppLayout pageName="Batch Upload Supporting Documents">
      <div className="">
        <h1 className="text-3xl font-bold mb-6">Batch Upload Supporting Documents</h1>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6 mb-6">
          {/* Default Settings - Pre-select for all files */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3">
              Default Settings (Applied to All Files)
            </label>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium mb-2 text-[var(--muted-foreground)]">
                  Default Document Type
                </label>
                <select
                  value={defaultDocumentType}
                  onChange={(e) => {
                    setDefaultDocumentType(e.target.value as DocumentType);
                    // Auto-apply to existing files if any
                    if (selectedFiles.length > 0) {
                      setFileMetadata(
                        selectedFiles.map(() => ({
                          document_type: e.target.value as DocumentType,
                          direction: defaultDirection,
                        }))
                      );
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                >
                  {documentTypeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <small className="text-xs text-[var(--muted-foreground)] mt-2 block">
              This default will be applied to all files when you select them. You can customize individual files in the table below.
            </small>
          </div>

          <FileUpload
            onFilesSelect={handleFilesSelect}
            multiple={true}
            accept="image/*,.pdf"
            required={true}
            label={t.documents.batchUploadPage.selectFiles}
            requiredText={t.documents.batchUploadPage.selectFilesRequired}
            helpText={t.documents.batchUploadPage.selectFilesHelp}
          />

          {/* File Metadata Table */}
          {selectedFiles.length > 0 && (
            <div className="mb-6 mt-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">
                  Configure Document Types <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={applyDefaultsToAll}
                  className="text-xs px-3 py-1.5 border border-[var(--border)] rounded-md hover:bg-[var(--hover-bg)] transition-colors"
                >
                  Apply Defaults to All
                </button>
              </div>
              <div className="overflow-x-auto border border-[var(--border)] rounded-md">
                <table className="min-w-full">
                  <thead className="bg-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-[var(--foreground)] border-b border-[var(--border)]">File Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-[var(--foreground)] border-b border-[var(--border)]">Document Type <span className="text-red-500">*</span></th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-[var(--foreground)] border-b border-[var(--border)]">Direction (Optional)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedFiles.map((file, index) => (
                      <tr key={index} className="border-b border-[var(--border)] hover:bg-[var(--hover-bg)]">
                        <td className="px-4 py-2 text-sm">{file.name}</td>
                        <td className="px-4 py-2">
                          <select
                            value={fileMetadata[index]?.document_type || defaultDocumentType}
                            onChange={(e) => updateFileMetadata(index, 'document_type', e.target.value as DocumentType)}
                            className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                            required
                          >
                            {documentTypeOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={fileMetadata[index]?.direction || ''}
                            onChange={(e) => updateFileMetadata(index, 'direction', e.target.value ? (e.target.value as DocumentDirection) : undefined)}
                            className="w-full px-3 py-1.5 text-sm border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
                          >
                            <option value="">-- Not specified --</option>
                            {directionOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <small className="text-xs text-[var(--muted-foreground)] mt-1 block">
                Select the document type for each file. Direction is optional and helps categorize the document. Use "Apply Defaults to All" to reset all files to the default settings.
              </small>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              {t.documents.batchUploadPage.remarkTag} <span className="text-[var(--muted-foreground)]">{t.documents.batchUploadPage.remarkTagOptional}</span>
            </label>
            <input
              type="text"
              value={batchRemark}
              onChange={(e) => setBatchRemark(e.target.value)}
              placeholder={t.documents.batchUploadPage.remarkTagPlaceholder}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
            />
            <small className="text-xs text-[var(--muted-foreground)] mt-1 block">
              {t.documents.batchUploadPage.remarkTagHelp}
            </small>
          </div>

          <button
            type="submit"
            disabled={isUploading || selectedFiles.length === 0}
            className="w-full px-4 py-3 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? t.documents.batchUploadPage.uploading : t.documents.batchUploadPage.startUpload}
          </button>
        </form>

        {/* Progress Bar */}
        {showProgress && (
          <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)] p-6 mb-6">
            <h3 className="text-lg font-semibold mb-3">{t.documents.batchUploadPage.uploadProgress}</h3>

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

            {/* Individual Job Statuses */}
            {jobProgresses.length > 0 && (
              <div className="mt-4 mb-4">
                <h4 className="font-semibold mb-2 text-sm">File Status</h4>
                <div className="space-y-2">
                  {jobProgresses.map((job, idx) => (
                    <div
                      key={job.jobId}
                      className="flex items-center justify-between p-2 rounded border border-[var(--border)] text-xs"
                    >
                      <span className="truncate flex-1">{job.filename}</span>
                      <span className={`ml-2 px-2 py-1 rounded ${
                        job.status === 'SUCCESS' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                        job.status === 'FAILED' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
                        job.status === 'RUNNING' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Result Summary */}
            {resultSummary && (
              <div className="mt-4">
                <div className="mb-2 text-sm">
                  {t.documents.batchUploadPage.created}: {resultSummary.created ?? 0} • {t.documents.batchUploadPage.failed}: {resultSummary.failed ?? 0}
                </div>

                {/* Other Errors */}
                {errors.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2 text-sm">{t.documents.batchUploadPage.otherErrors}</h4>
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
                  onClick={() => router.push('/supporting-documents')}
                  className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors font-medium text-sm"
                >
                  Go to Supporting Documents
                </button>
                <button
                  onClick={() => {}}
                  className="px-4 py-2 bg-[var(--hover-bg-lighter)] hover:bg-[var(--hover-bg-light)] dark:bg-[var(--hover-border)] dark:hover:bg-[var(--hover-bg-light)] rounded-md transition-colors font-medium text-sm"
                >
                  {t.documents.batchUploadPage.stayHere}
                </button>
              </div>
            )}

            {/* Timing Information */}
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <h4 className="font-semibold mb-2 text-sm">{t.documents.batchUploadPage.processingTime}</h4>
              <div className="text-sm">
                <div>{t.documents.batchUploadPage.elapsed}: <span className="font-mono font-bold">{elapsedTime}</span></div>
                {showFileTiming && (
                  <div>{t.documents.batchUploadPage.currentFile}: <span className="font-mono font-bold">{currentFileTime}</span></div>
                )}
              </div>
            </div>
          </div>
        )}

        <p className="mt-6 text-sm text-[var(--muted-foreground)]">
          <strong>Tips:</strong>
          <br />- Select the appropriate document type for each file. This helps the system process documents correctly.
          <br />- Direction is optional and helps categorize documents (AP for accounts payable, AR for accounts receivable).
          <br />- Documents are stored as-is without creating invoice rows.
        </p>
      </div>
    </AppLayout>
  );
};

export default SupportingDocumentsBatchUpload;

