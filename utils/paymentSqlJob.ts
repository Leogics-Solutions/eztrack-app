export type PaymentSqlJob = {
  id?: string;
  status: string;
  error_message?: string;
  result?: { sql_status?: string; detail?: string };
};

export function paymentSqlJobRunning(jobId: string, observed: { id: string; status: string }): boolean {
  return Boolean(jobId) && (observed.id !== jobId || ['PENDING', 'RUNNING'].includes(observed.status));
}

export function paymentSqlJobNotice(job: PaymentSqlJob): string {
  if (['PENDING', 'RUNNING'].includes(job.status)) return 'Checking SQL in the background. You can leave this page and return.';
  if (job.result?.sql_status === 'needs_customer') return 'SQL check completed: customer confirmation needed. ' + (job.result.detail || job.error_message || 'Select the correct SQL customer before continuing.');
  if (job.status === 'SUCCESS') return 'SQL check completed. Review the refreshed payment details.';
  if (job.status === 'NONE') return 'No SQL check is recorded. Retry the check.';
  return job.error_message || 'SQL check could not complete. Retry the check.';
}
