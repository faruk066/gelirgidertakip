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

/** CSV dosyasını okur, satır satır doğrular, önizleme için sonuç döndürür */
export function parseCSVFile(file: File): Promise<CsvParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const rows: CsvPreviewRow[] = (res.data ?? []).map((raw) => {
          const type = (raw['type'] ?? '').trim().toLowerCase();
          const amount = Number(String(raw['amount'] ?? '').replace(',', '.'));
          const categoryName = (raw['category'] ?? '').trim();
          const date = (raw['date'] ?? '').trim();
          const note = (raw['note'] ?? '').trim();
          if (type !== 'income' && type !== 'expense') {
            return { valid: false, type: '', amount: 0, categoryName, date, note, error: 'Geçersiz tür (income/expense olmalı)' };
          }
          if (!Number.isFinite(amount) || amount <= 0) {
            return { valid: false, type: type as TransactionType, amount: 0, categoryName, date, note, error: 'Geçersiz tutar' };
          }
          if (!isValidISODate(date)) {
            return { valid: false, type: type as TransactionType, amount, categoryName, date, note, error: 'Geçersiz tarih (YYYY-MM-DD olmalı)' };
          }
          return { valid: true, type: type as TransactionType, amount, categoryName, date, note };
        });
        const fileError =
          res.errors.length > 0 && rows.length === 0
            ? 'Dosya okunamadı. Sütun başlıkları id,type,amount,category,date,note,createdAt olmalı.'
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
