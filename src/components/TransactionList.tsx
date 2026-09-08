import { useState } from 'react';
import { formatDateTr } from '../lib/dateUtils';
import { formatMoney } from '../lib/format';
import type { Category, Transaction } from '../types';

function groupByDate(transactions: Transaction[]): [string, Transaction[]][] {
  const map = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const list = map.get(t.date) ?? [];
    list.push(t);
    map.set(t.date, list);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

export default function TransactionList({
  transactions,
  categories,
  currency,
  onEdit,
  onDelete,
}: {
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const groups = groupByDate(transactions);

  return (
    <div className="space-y-4">
      {groups.map(([date, items]) => (
        <section key={date}>
          <h3 className="mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {formatDateTr(date)}
          </h3>
          <ul className="space-y-2">
            {items.map((t) => {
              const cat = catById.get(t.categoryId);
              const income = t.type === 'income';
              return (
                <li
                  key={t.id}
                  className={`flex items-center gap-3 rounded-2xl border-l-4 bg-white p-3 shadow-sm dark:bg-slate-900 ${
                    income ? 'border-l-green-500' : 'border-l-red-500'
                  }`}
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                    style={{ backgroundColor: `${cat?.color ?? '#64748b'}22` }}
                  >
                    {cat?.icon ?? '✨'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                      {cat?.name ?? 'Diğer'}
                    </p>
                    {t.note && (
                      <p className="truncate text-sm text-slate-500 dark:text-slate-400">{t.note}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 font-bold tabular-nums ${
                      income ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {income ? '+' : '−'}
                    {formatMoney(t.amount, currency)}
                  </span>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      aria-label="İşlem menüsü"
                      onClick={() => setOpenMenuId(openMenuId === t.id ? null : t.id)}
                      className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      ⋮
                    </button>
                    {openMenuId === t.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 z-20 w-32 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onEdit(t);
                            }}
                            className="block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            ✏️ Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onDelete(t);
                            }}
                            className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                          >
                            🗑️ Sil
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
