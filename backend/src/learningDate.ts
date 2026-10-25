export const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 100) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0)); return true; }
  catch { return false; }
}

/** Return the account-local calendar date for a server timestamp. */
export function getLearningDate(timeZone: string, at: Date = new Date()): string {
  if (!isValidTimeZone(timeZone)) throw new RangeError('Invalid IANA time zone.');
  if (Number.isNaN(at.getTime())) throw new RangeError('Invalid activity timestamp.');
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
