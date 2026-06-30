const MS_PER_DAY = 24 * 60 * 60 * 1000;
const GOOGLE_SHEETS_EPOCH = Date.UTC(1899, 11, 30);

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function isoDateFromDate(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function isoDateFromSerial(value: number): string | null {
  if (!Number.isFinite(value) || value < 1) return null;
  return isoDateFromDate(new Date(GOOGLE_SHEETS_EPOCH + Math.floor(value) * MS_PER_DAY));
}

export function normalizeDateValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';

  if (typeof value === 'number') return isoDateFromSerial(value) ?? '';

  const raw = String(value).trim();
  if (!raw) return '';

  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const serialDate = isoDateFromSerial(Number(raw));
    if (serialDate) return serialDate;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${pad2(Number(isoMatch[2]))}-${pad2(Number(isoMatch[3]))}`;
  }

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const year = Number(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]);
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  const parsed = new Date(raw);
  return isoDateFromDate(parsed) ?? raw.slice(0, 10);
}
