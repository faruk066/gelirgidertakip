import { useMemo, useState } from 'react';
import { todayISO } from '../lib/dateUtils';
import { useStore, type NewTransaction } from '../store';
import type { Transaction, TransactionType } from '../types';

export default function TransactionForm({
  defaultType,
  initial,
  onClose,
}: {
  defaultType: TransactionType;
  initial?: Transaction;
  onClose: () => void;
}) {
  const { categories, addTransaction, updateTransaction } = useStore();
  const [type, setType] = useState<TransactionType>(initial?.type ?? defaultType);
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const typeCategories = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);
  const activeCategoryId = categoryId && typeCategories.some((c) => c.id === categoryId)
    ? categoryId
    : (typeCategories[0]?.id ?? '');

  function switchType(next: TransactionType): void {
    setType(next);
    setCategoryId('');
    setError('');
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const parsed = Number(amount.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Geçerli bir tutar girin (0’dan büyük olmalı).');
      return;
    }
    if (!activeCategoryId) {
      setError('Bir kategori seçin.');
      return;
    }
    if (!date) {
      setError('Bir tarih seçin.');
      return;
    }
    setSaving(true);
    try {
      const payload: NewTransaction = {
        type,
        amount: Math.round(parsed * 100) / 100,
        categoryId: activeCategoryId,
        date,
        note,
      };
      if (initial) await updateTransaction(initial.id, payload);
      else await addTransaction(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl dark:bg-slate-900"
      >
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {initial ? 'İşlemi Düzenle' : 'Yeni İşlem'}
        </h3>

        {/* Tür seçimi */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchType(t)}
              className={`rounded-xl px-4 py-2.5 font-bold transition ${
                type === t
                  ? t === 'income'
                    ? 'bg-green-600 text-white'
                    : 'bg-red-600 text-white'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t === 'income' ? '💰 Gelir' : '💸 Gider'}
            </button>
          ))}
        </div>

        {/* Tutar */}
        <label className="mt-4 block">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Tutar</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-2xl font-bold tabular-nums text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </label>

        {/* Kategori */}
        <span className="mt-4 block text-sm font-semibold text-slate-600 dark:text-slate-300">Kategori</span>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {typeCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-xs font-medium transition ${
                activeCategoryId === c.id
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                  : 'border-transparent bg-slate-100 dark:bg-slate-800'
              } text-slate-700 dark:text-slate-200`}
            >
              <span className="text-2xl">{c.icon}</span>
              <span className="truncate text-center leading-tight">{c.name}</span>
            </button>
          ))}
        </div>

        {/* Tarih */}
        <label className="mt-4 block">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Tarih</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </label>

        {/* Not */}
        <label className="mt-4 block">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Not (opsiyonel)</span>
          <input
            type="text"
            placeholder="Açıklama ekle…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={120}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </label>

        {error && <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-5 flex gap-2 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-slate-100 px-4 py-3 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Kaydediliyor…' : initial ? 'Güncelle' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  );
}
