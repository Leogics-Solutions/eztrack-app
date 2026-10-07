/** API timestamps without an offset represent UTC, as do aware timestamps. */
export function formatMalaysiaDateTime(value?: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  const utc = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(raw)
    ? `${raw.replace(' ', 'T')}Z` : raw;
  const date = new Date(utc);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date);
}
