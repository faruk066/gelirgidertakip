import { useMemo, useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import TransactionForm from '../components/TransactionForm';
import TransactionList from '../components/TransactionList';
import { formatMoney } from '../lib/format';
import { useStore } from '../store';
import type { Transaction, TransactionType } from '../types';

type TypeFilter = 'all' | TransactionType;

export default function TransactionsPage() {
  const { transactions, categories, settings, deleteTransaction } = useStore();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    const catById = new Map(categories.map((c) => [c.id, c]));
    return transactions.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
      if (start && t.date < start) return false;
      if (end && t.date > end) return false;
      if (q) {
        const catName = (catById.get(t.categoryId)?.name ?? '').toLocaleLowerCase('tr-TR');
        const note = (t.note ?? '').toLocaleLowerCase('tr-TR');
        if (!catName.includes(q) && !note.includes(q) && !t.amount.toString().includes(q)) return false;
      }
      return true;
    });
  }, [transactions, categories, typeFilter, categoryFilter, search, start, end]);

  const total = useMemo(
    () =>
      filtered.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0),
    [filtered],
  );

  const visibleCategories = categories.filter((c) => typeFilter === 'all' || c.type === typeFilter);

  return (
    <div className="space-y-3">
      {/* Tür filtresi */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-1.5 shadow-sm dark:bg-slate-900">
        {(['all', 'income', 'expense'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setTypeFilter(f);
              setCategoryFilter('all');
            }}
            className={`rounded-xl px-3 py-2 text-sm font-bold ${
              typeFilter === f
                ? 'bg-emerald-600 text-white'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {f === 'all' ? 'Tümü' : f === 'income' ? 'Gelir' : 'Gider'}
          </button>
        ))}
      </div>

      {/* Arama */}
      <input
        type="search"
        placeholder="Ara (kategori, not, tutar)…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      />

      {/* Tarih aralığı */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        <span className="text-slate-400">—</span>
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </div>

      {/* Kategori çipleri */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategoryFilter('all')}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold ${
            categoryFilter === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400'
          }`}
        >
          Tümü
        </button>
        {visibleCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === c.id ? 'all' : c.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold ${
              categoryFilter === c.id
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400'
            }`}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* Toplam + yeni butonu */}
      <div className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900">
        <div>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Seçili filtre toplamı</p>
          <p
            className={`text-lg font-extrabold tabular-nums ${
              total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatMoney(total, settings.currency)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"
        >
          + Yeni İşlem
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🔍" title="Kayıt bulunamadı" hint="Filtreleri değiştir veya yeni işlem ekle." />
      ) : (
        <TransactionList
          transactions={filtered}
          categories={categories}
          currency={settings.currency}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
      )}

      {showForm && <TransactionForm defaultType="expense" onClose={() => setShowForm(false)} />}
      {editing && (
        <TransactionForm
          defaultType={editing.type}
          initial={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="İşlem silinsin mi?"
          message="Bu işlem kalıcı olarak silinecek. Bu işlem geri alınamaz."
          confirmLabel="Sil"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            deleteTransaction(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
