export type SqlQueueDetails = {
  status: string;
  queue_position?: number | null;
  dispatch_mode?: 'IMMEDIATE' | 'BATCH';
  scheduled_for?: string;
};

export function sqlQueueNotice(job: SqlQueueDetails, now = Date.now()): string {
  if (job.status !== 'PENDING') return '';
  const due = job.scheduled_for ? Date.parse(job.scheduled_for) : NaN;
  if (Number.isFinite(due) && due > now) {
    const time = new Date(due).toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur',
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    return `Scheduled for the SQL batch at ${time} (Malaysia time). This is the earliest start; current SQL work may delay it.`;
  }
  if (job.queue_position != null) return `SQL queue position: ${job.queue_position}. Orders, ORs and payment checks share this queue. Waiting time depends on current SQL work.`;
  return 'Queued for SQL processing. Waiting for the next progress update.';
}
