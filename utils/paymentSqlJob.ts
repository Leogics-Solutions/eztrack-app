import { sqlQueueNotice } from './sqlQueueNotice.ts';

export type PaymentSqlJob = {
  id?: string;
  status: string;
  queue_position?: number | null; dispatch_mode?: 'IMMEDIATE' | 'BATCH'; scheduled_for?: string;
  error_message?: string;
  result?: { sql_status?: string; detail?: string };
};

export function paymentSqlJobRunning(jobId: string, observed: { id: string; status: string }): boolean {
  return Boolean(jobId) && (observed.id !== jobId || ['PENDING', 'RUNNING'].includes(observed.status));
}

export function paymentSqlJobNotice(job: PaymentSqlJob): string {
  if (job.status === 'PENDING' && job.scheduled_for) return sqlQueueNotice(job) + ' You can leave this page and return.';
  if (['PENDING', 'RUNNING'].includes(job.status)) return 'Checking SQL in the background. You can leave this page and return.';
  if (job.result?.sql_status === 'needs_customer') return 'SQL check completed: customer confirmation needed. ' + (job.result.detail || job.error_message || 'Select the correct SQL customer before continuing.');
  if (job.status === 'SUCCESS') return 'SQL check completed. Review the refreshed payment details.';
  if (job.status === 'NONE') return 'No SQL check is recorded. Retry the check.';
  return job.error_message || 'SQL check could not complete. Retry the check.';
}

// A failed status fetch is not evidence that a posting/check is still running.
// Keep a terminal job result even if the separate review refresh fails.
export async function readPaymentSqlProgress<T extends { output_refs?: Record<string, unknown> | null }>(
  expectedId: string,
  getStatus: () => Promise<PaymentSqlJob>,
  getReview: () => Promise<T>,
): Promise<{ job: PaymentSqlJob; updated?: T; follow?: boolean; retry?: boolean; notice: string }> {
  let job: PaymentSqlJob;
  try {
    job = await getStatus();
  } catch {
    job = { id: expectedId, status: 'UNAVAILABLE' };
    return { job, retry: true, notice: 'Cannot read SQL check progress. Reconnecting; the job status is unknown.' };
  }
  if (job.id && job.id !== expectedId) {
    try {
      const updated = await getReview();
      const currentId = String(updated.output_refs?.payment_sql_job_id || '');
      if (currentId && currentId !== expectedId) return { job, updated, follow: true, notice: '' };
    } catch { /* Display the mismatch instead of leaving an endless spinner. */ }
    return { job: { id: expectedId, status: 'UNAVAILABLE' }, retry: true,
      notice: 'SQL check progress does not match this review. Reload the page or retry the read-only check.' };
  }
  const notice = paymentSqlJobNotice(job);
  if (['PENDING', 'RUNNING'].includes(job.status)) return { job, retry: true, notice };
  try {
    return { job, updated: await getReview(), notice };
  } catch {
    return { job, notice: notice + ' Could not reload the review. Refresh the page to see the latest details.' };
  }
}
