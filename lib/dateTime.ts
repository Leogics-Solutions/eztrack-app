export const SMARTDOK_TIME_ZONE = 'Asia/Kuala_Lumpur';

type DateTimeInput = string | number | Date | null | undefined;

/**
 * API datetimes are stored in UTC, but older responses may omit a trailing Z.
 * Treat only zone-less datetime strings as UTC; preserve explicit offsets.
 */
export function parseApiDateTime(value: DateTimeInput): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const raw = value.trim();
  if (!raw) return null;
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const isDateTime = /[T\s]\d{2}:\d{2}/.test(raw);
  const normalizedFraction = raw.replace(/(\.\d{3})\d+/, '$1');
  const normalized = !hasExplicitZone && isDateTime
    ? `${normalizedFraction.replace(' ', 'T')}Z`
    : normalizedFraction;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatMalaysiaDateTime(
  value: DateTimeInput,
  options: { seconds?: boolean; timeZoneLabel?: boolean } = {},
): string {
  const date = parseApiDateTime(value);
  if (!date) return '—';
  const formatted = new Intl.DateTimeFormat('en-MY', {
    timeZone: SMARTDOK_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: options.seconds === false ? undefined : '2-digit',
    hour12: true,
  }).format(date);
  return options.timeZoneLabel === false ? formatted : `${formatted} GMT+8`;
}

export function formatMalaysiaTime(value: DateTimeInput): string {
  const date = parseApiDateTime(value);
  if (!date) return '—';
  return `${new Intl.DateTimeFormat('en-MY', {
    timeZone: SMARTDOK_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date)} GMT+8`;
}
