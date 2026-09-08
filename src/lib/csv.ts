import Papa from 'papaparse';
import type { Category, Transaction, TransactionType } from '../types';
import { otherIdFor } from './defaultCategories';
import { isValidISODate } from './dateUtils';

export const CSV_COLUMNS = ['id', 'type', 'amount', 'category', 'date', 'note', 'createdAt'] as const;

function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Tüm işlemleri CSV olarak indirir (sütunlar: id,type,amount,category,date,note,createdAt) */
export function exportToCSV(transactions: Transaction[], categories: Category[]): void {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const rows = transactions.map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    category: catName.get(t.categoryId) ?? 'Diğer',
    date: t.date,
    note: t.note ?? '',
    createdAt: t.createdAt,
  }));
  const csv = Papa.unparse(rows, { columns: [...CSV_COLUMNS] });
  downloadBlob(`\uFEFF${csv}`, 'gelir-gider-verileri.csv', 'text/csv');
}

export interface CsvPreviewRow {
  valid: boolean;
  type: TransactionType | '';
  amount: number;
  categoryName: string;
  date: string;
  note: string;
  error?: string;
}

export interface CsvParseResult {
  rows: CsvPreviewRow[];
  fileError?: string;
}

const norm = (s: string): string => s.trim().toLocaleLowerCase('tr-TR');

/** "50.00" ve "1.234,56" (TR) dahil tutar formatlarını sayıya çevirir */
function parseAmount(s: string): number {
  let v = s.trim().replace(/\s/g, '');
  if (v.includes(',') && v.includes('.')) {
    // Son ayraç ondalık ayracıdır: TR "1.234,56" ya da US "1,234.56"
    if (v.lastIndexOf(',') > v.lastIndexOf('.')) v = v.replace(/\./g, '').replace(',', '.');
    else v = v.replace(/,/g, '');
  } else if (v.includes(',')) {
    v = v.replace(',', '.');
  }
  return Number(v);
}

/** "YYYY-MM-DD" veya "GG.AA.YYYY" tarihini ISO'ya çevirir, geçersizse null */
export function toISODateLoose(s: string): string | null {
  const v = s.trim();
  if (isValidISODate(v)) return v;
  const m = v.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (isValidISODate(iso)) return iso;
  }
  return null;
}

/** CSV dosyasını okur, satır satır doğrular, önizleme için sonuç döndürür.
 *  İki format desteklenir: yeni format (id,type,amount,category,date,note,createdAt)
 *  ve eski gider uygulaması formatı (Tarih,Kategori,Tutar (₺),Not — tamamı gider sayılır). */
export function parseCSVFile(file: File): Promise<CsvParseResult> {
  return file
    .text()
    .then((text) => parseCSVText(text))
    .catch((err) => ({ rows: [], fileError: `Dosya okunamadı: ${err instanceof Error ? err.message : String(err)}` }));
}

/** CSV metnini ayrıştırır (parseCSVFile ile aynı kurallar) */
export function parseCSVText(text: string): Promise<CsvParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^\uFEFF/, '').trim().toLowerCase(),
      complete: (res) => {
        const fields = (res.meta.fields ?? []).map((f) => f.trim().toLowerCase());
        // Eski format: type sütunu yok, tarih/kategori/tutar var
        const legacy =
          !fields.includes('type') &&
          (fields.includes('tarih') || fields.includes('kategori') || fields.some((f) => f.startsWith('tutar')));
        const rows: CsvPreviewRow[] = (res.data ?? []).map((raw) => {
          const typeRaw = (raw['type'] ?? '').trim().toLowerCase();
          const type: TransactionType | '' = legacy
            ? 'expense'
            : typeRaw === 'income' || typeRaw === 'expense'
              ? typeRaw
              : '';
          const amount = parseAmount(String(raw['amount'] ?? raw['tutar (₺)'] ?? raw['tutar'] ?? ''));
          const categoryName = (raw['category'] ?? raw['kategori'] ?? '').trim();
          const dateRaw = (raw['date'] ?? raw['tarih'] ?? '').trim();
          const date = toISODateLoose(dateRaw);
          const note = (raw['note'] ?? raw['not'] ?? raw['açıklama'] ?? '').trim();
          if (!type) {
            return { valid: false, type: '', amount: 0, categoryName, date: dateRaw, note, error: 'Geçersiz tür (income/expense olmalı)' };
          }
          if (!Number.isFinite(amount) || amount <= 0) {
            return { valid: false, type, amount: 0, categoryName, date: dateRaw, note, error: 'Geçersiz tutar' };
          }
          if (!date) {
            return { valid: false, type, amount, categoryName, date: dateRaw, note, error: 'Geçersiz tarih (YYYY-MM-DD ya da GG.AA.YYYY olmalı)' };
          }
          return { valid: true, type, amount, categoryName, date, note };
        });
        const fileError =
          res.errors.length > 0 && rows.length === 0
            ? 'Dosya okunamadı. Beklenen sütunlar: id,type,amount,category,date,note,createdAt ya da eski format Tarih,Kategori,Tutar (₺),Not.'
            : undefined;
        resolve({ rows, fileError });
      },
      error: (err) => resolve({ rows: [], fileError: `Dosya okunamadı: ${err.message}` }),
    });
  });
}

/** Önizlemeden geçen satırları Transaction nesnelerine çevirir (bilinmeyen kategori → Diğer) */
export function previewToTransactions(rows: CsvPreviewRow[], categories: Category[]): Transaction[] {
  const now = new Date().toISOString();
  const byName = new Map(categories.map((c) => [norm(c.name) + '|' + c.type, c.id]));
  return rows
    .filter((r) => r.valid && r.type !== '')
    .map((r) => {
      const type = r.type as TransactionType;
      const categoryId = byName.get(norm(r.categoryName) + '|' + type) ?? otherIdFor(type);
      return {
        id: crypto.randomUUID(),
        type,
        amount: r.amount,
        categoryId,
        date: r.date,
        note: r.note || undefined,
        createdAt: now,
        updatedAt: now,
      };
    });
}
