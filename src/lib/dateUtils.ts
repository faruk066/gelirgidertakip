/** Tarih yardımcıları — hafta her zaman Pazartesi başlar. */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** "YYYY-MM-DD" -> yerel Date (UTC kayması yok) */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function addDaysISO(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Verilen günü içeren haftanın Pazartesi günü (YYYY-MM-DD) */
export function startOfWeekMondayISO(iso: string): string {
  const d = parseISODate(iso);
  const dow = (d.getDay() + 6) % 7; // Pazartesi=0 … Pazar=6
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

export interface DateRange {
  start: string;
  end: string;
}

export function weekRange(iso: string): DateRange {
  const s = startOfWeekMondayISO(iso);
  return { start: s, end: addDaysISO(s, 6) };
}

export function monthRange(iso: string): DateRange {
  const d = parseISODate(iso);
  return {
    start: toISODate(new Date(d.getFullYear(), d.getMonth(), 1)),
    end: toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

export function yearRange(iso: string): DateRange {
  const y = parseISODate(iso).getFullYear();
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

const trFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  weekday: 'long',
});

/** "9 Eylül 2026 Çarşamba" — göreceli etiket (Bugün/Dün) kullanılmaz */
export function formatDateTr(iso: string): string {
  try {
    const out = trFormatter.format(parseISODate(iso));
    // "9 Eylül 2026 Çarşamba" — Intl zaten bu sırayla üretir, ilk harfi büyüt
    return out.charAt(0).toLocaleUpperCase('tr-TR') + out.slice(1);
  } catch {
    return iso;
  }
}

export function inRange(iso: string, range: DateRange): boolean {
  return iso >= range.start && iso <= range.end;
}
