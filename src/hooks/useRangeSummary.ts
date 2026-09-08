import { useMemo } from 'react';
import { inRange, type DateRange } from '../lib/dateUtils';
import { calcTotals, type ReportTotals } from '../lib/excel';
import type { Category, Transaction } from '../types';

export interface CategorySlice {
  category: Category;
  total: number;
  percent: number;
}

/** Seçili aralık + tür için toplamlar ve kategori dağılımı */
export function useRangeSummary(
  transactions: Transaction[],
  categories: Category[],
  range: DateRange,
  type: 'income' | 'expense',
): { totals: ReportTotals; inRangeTx: Transaction[]; slices: CategorySlice[]; totalForType: number } {
  return useMemo(() => {
    const inRangeTx = transactions.filter((t) => inRange(t.date, range));
    const totals = calcTotals(inRangeTx);
    const ofType = inRangeTx.filter((t) => t.type === type);
    const totalForType = ofType.reduce((s, t) => s + t.amount, 0);
    const byCat = new Map<string, number>();
    for (const t of ofType) byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount);
    const catById = new Map(categories.map((c) => [c.id, c]));
    const slices: CategorySlice[] = [...byCat.entries()]
      .map(([id, total]) => ({
        category: catById.get(id) ?? { id, name: 'Diğer', icon: '✨', type, color: '#64748b' },
        total,
        percent: totalForType > 0 ? (total / totalForType) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
    return { totals, inRangeTx, slices, totalForType };
  }, [transactions, categories, range, type]);
}
