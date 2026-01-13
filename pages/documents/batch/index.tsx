'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { FileUpload } from "@/components/FileUpload";
import { batchUploadInvoices, batchUploadInvoicesMultipart, getBatchJobStatus } from "@/services";

interface JobProgress {
  jobId: string;
  filename: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  invoiceId: number | null;
  errorMessage: string | null;
}

interface ResultSummary {
  created: number;
  failed: number;
  failed_files: Array<{
    file: string;
    type: 'error' | 'duplicate';
    reason: string;
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
}

const BatchUpload = () => {
  const router = useRouter();
  const { t } = useLanguage();
  const [useOcr, setUseOcr] = useState(true);
  const [autoClassify, setAutoClassify] = useState(true);
  const [batchRemark, setBatchRemark] = useState("");
  const [uploadMode, setUploadMode] = useState<'s3' | 'multipart'>('multipart');
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
  const [jobProgresses, setJobProgresses] = useState<JobProgress[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const currentFileStartTimeRef = useRef<number>(0);

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
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedFiles || selectedFiles.length === 0) {
      alert(t.documents.batchUploadPage.alerts.selectAtLeastOne);
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

    // Update elapsed time every 100ms
    timingIntervalRef.current = setInterval(() => {
      const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
      setElapsedTime(elapsed + 's');

      const currentFileElapsed = ((Date.now() - currentFileStartTimeRef.current) / 1000).toFixed(1);
      setCurrentFileTime(currentFileElapsed + 's');
    }, 100);

    try {
      // Upload files using batch upload API
      setProgressText(t.documents.batchUploadPage.preparingUpload);
      setProgressDetails(
        uploadMode === 'multipart'
          ? 'Uploading files to backend...'
          : 'Requesting presigned URLs → uploading to S3 → confirming...'
      );
      
      const uploadResponse = uploadMode === 'multipart'
        ? await batchUploadInvoicesMultipart(selectedFiles, {
            auto_classify: autoClassify,
            remark: batchRemark || undefined,
          })
        : await batchUploadInvoices(selectedFiles, {
            auto_classify: autoClassify,
            remark: batchRemark || undefined,
          });
      
      if (!uploadResponse.success || !uploadResponse.data) {
        throw new Error('Upload failed');
      }

      const jobs = uploadResponse.data.jobs;
      const failures = uploadResponse.data.failures || [];
      const totalFiles = uploadResponse.data.total_files ?? selectedFiles.length;
      
      // Initialize job progresses
      const localFailures: JobProgress[] = failures.map((f, idx) => ({
        jobId: `local-failure:${f.index ?? idx}`,
        filename: f.filename,
        status: 'FAILED',
        invoiceId: null,
        errorMessage: f.reason || 'S3 upload failed',
      }));

      const initialProgresses: JobProgress[] = [
        ...localFailures,
        ...jobs.map(job => ({
          jobId: job.job_id,
          filename: job.filename,
          status: 'PENDING' as const,
          invoiceId: (job as any).invoice_id ?? null,
          errorMessage: null,
        })),
      ];
      setJobProgresses(initialProgresses);

      // Start polling for job statuses
      const pollJobs = async () => {
        const updatedProgresses: JobProgress[] = [...localFailures];
        let allCompleted = true;
        let runningCount = 0;
        let successCount = 0;
        let failedCount = localFailures.length;

        for (const job of jobs) {
          try {
            const statusResponse = await getBatchJobStatus(job.job_id);
            if (statusResponse.success && statusResponse.data) {
              const jobData = statusResponse.data;
              updatedProgresses.push({
                jobId: job.job_id,
                filename: jobData.original_filename,
                status: jobData.status,
                invoiceId: jobData.invoice_id,
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
              invoiceId: null,
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

  const duplicates = resultSummary?.failed_files?.filter(ff => ff && ff.type === 'duplicate') || [];
  const errors = resultSummary?.failed_files?.filter(ff => !ff || ff.type !== 'duplicate') || [];
  
  // Get failed jobs from jobProgresses for display
  const failedJobs = jobProgresses.filter(jp => jp.status === 'FAILED');
  const successfulJobs = jobProgresses.filter(jp => jp.status === 'SUCCESS');

  return (
    <AppLayout pageName={t.documents.batchUploadPage.title}>
      <div className="">
        <h1 className="text-3xl font-bold mb-6">{t.documents.batchUploadPage.title}</h1>

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
                <span className="text-sm font-medium">{t.documents.batchUploadPage.useOCR}</span>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {t.documents.batchUploadPage.useOCRDescription}
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
                  {t.documents.batchUploadPage.autoClassify} <span className="text-[var(--muted-foreground)]">(AI)</span>
                </span>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {t.documents.batchUploadPage.autoClassifyDescription}
                </div>
              </div>
            </label>
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
            disabled={isUploading}
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
                      {job.invoiceId && (
                        <a
                          href={`/documents/${job.invoiceId}`}
                          className="ml-2 text-[var(--primary)] hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View
                        </a>
                      )}
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

                {/* Duplicate Invoices */}
                {duplicates.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2 text-sm">{t.documents.batchUploadPage.duplicateInvoices}</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border border-[var(--border)]">
                        <thead className="bg-gray-100 dark:bg-gray-800">
                          <tr>
                            <th className="border border-[var(--border)] px-4 py-2 text-left text-xs font-medium">{t.documents.batchUploadPage.file}</th>
                            <th className="border border-[var(--border)] px-4 py-2 text-left text-xs font-medium">{t.documents.batchUploadPage.vendor}</th>
                            <th className="border border-[var(--border)] px-4 py-2 text-left text-xs font-medium">{t.documents.batchUploadPage.invoiceNo}</th>
                            <th className="border border-[var(--border)] px-4 py-2 text-left text-xs font-medium">{t.documents.batchUploadPage.date}</th>
                            <th className="border border-[var(--border)] px-4 py-2 text-left text-xs font-medium">{t.documents.batchUploadPage.total}</th>
                            <th className="border border-[var(--border)] px-4 py-2 text-left text-xs font-medium">{t.documents.batchUploadPage.existing}</th>
                            <th className="border border-[var(--border)] px-4 py-2 text-left text-xs font-medium">{t.documents.batchUploadPage.action}</th>
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
                                      href={`/documents/${du.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[var(--primary)] hover:underline"
                                    >
                                      {t.documents.batchUploadPage.open}
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
                  onClick={() => router.push('/documents')}
                  className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors font-medium text-sm"
                >
                  {t.documents.batchUploadPage.goToDocuments}
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
          <strong>{t.documents.batchUploadPage.tips}</strong>
          <br />- {t.documents.batchUploadPage.tip1}
          <br />- {t.documents.batchUploadPage.tip2}
          <br />- {t.documents.batchUploadPage.tip3}
        </p>
      </div>
    </AppLayout>
  );
};

export default BatchUpload;