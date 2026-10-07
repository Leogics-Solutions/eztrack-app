export interface SqlRequestLogFilters {
  date_from?: string;
  date_to?: string;
  company?: string;
  state?: string;
  job_type?: string;
}

export function sqlRequestLogQuery(filters: SqlRequestLogFilters, offset?: number): string {
  const query = new URLSearchParams();
  for (const key of ['date_from', 'date_to', 'company', 'state', 'job_type'] as const) {
    if (filters[key]) query.set(key, filters[key]);
  }
  if (offset !== undefined) { query.set('offset', String(offset)); query.set('limit', '50'); }
  return query.toString();
}

export function sqlRequestLogTime(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric',
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value));
}

export function malaysiaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
