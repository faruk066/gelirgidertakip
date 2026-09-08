import * as XLSX from 'xlsx';
import type { Category, Transaction } from '../types';
import { formatDateTr } from './dateUtils';
import { formatMoney } from './format';

export interface ReportTotals {
  income: number;
  expense: number;
  net: number;
}

export function calcTotals(transactions: Transaction[]): ReportTotals {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

/**
 * Seçili tarih aralığındaki işlemleri gerçek .xlsx dosyası olarak indirir.
 * (Tarayıcı print dialog'u değil, SheetJS ile üretilmiş dosya.)
 */
export function downloadExcelReport(
  transactions: Transaction[],
  categories: Category[],
  start: string,
  end: string,
  currency: string,
): void {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const totals = calcTotals(sorted);

  const header = ['Tarih', 'Tür', 'Kategori', 'Tutar', 'Not'];
  const body = sorted.map((t) => [
    formatDateTr(t.date),
    t.type === 'income' ? 'Gelir' : 'Gider',
    catName.get(t.categoryId) ?? 'Diğer',
    t.amount,
    t.note ?? '',
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([
    header,
    ...body,
    [],
    [`Rapor Aralığı: ${formatDateTr(start)} — ${formatDateTr(end)}`],
    ['Toplam Gelir', formatMoney(totals.income, currency)],
    ['Toplam Gider', formatMoney(totals.expense, currency)],
    ['Net Bakiye', formatMoney(totals.net, currency)],
  ]);
  sheet['!cols'] = [{ wch: 26 }, { wch: 10 }, { wch: 20 }, { wch: 16 }, { wch: 32 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Rapor');
  XLSX.writeFile(wb, `gelir-gider-raporu_${start}_${end}.xlsx`);
}
