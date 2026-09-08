import { useRef, useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import { exportToCSV, parseCSVFile, previewToTransactions, type CsvParseResult } from '../lib/csv';
import { OTHER_EXPENSE_ID, OTHER_INCOME_ID } from '../lib/defaultCategories';
import { CURRENCIES } from '../lib/format';
import { APP_VERSION } from '../lib/version';
import { useStore } from '../store';
import type { TransactionType } from '../types';

const ICON_CHOICES = ['🍔', '🚗', '🛍️', '🎬', '🏥', '💡', '📚', '💰', '💵', '📈', '🎁', '🏠', '🐾', '✨'];
const COLOR_CHOICES = ['#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#eab308', '#14b8a6', '#22c55e', '#64748b'];

export default function Settings() {
  const {
    transactions,
    categories,
    settings,
    setTheme,
    setCurrency,
    addCategory,
    deleteCategory,
    clearAll,
    importTransactions,
  } = useStore();

  const [csvResult, setCsvResult] = useState<CsvParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('✨');
  const [catType, setCatType] = useState<TransactionType>('expense');
  const [catColor, setCatColor] = useState(COLOR_CHOICES[0]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file) return;
    setCsvResult(await parseCSVFile(file));
  }

  async function confirmImport(): Promise<void> {
    if (!csvResult) return;
    setImporting(true);
    try {
      await importTransactions(previewToTransactions(csvResult.rows, categories));
      setCsvResult(null);
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      setImporting(false);
    }
  }

  const validCount = csvResult?.rows.filter((r) => r.valid).length ?? 0;
  const invalidCount = csvResult?.rows.filter((r) => !r.valid).length ?? 0;
  const firstErrors = (csvResult?.rows.filter((r) => !r.valid).slice(0, 3) ?? []).map((r) => r.error ?? 'Hatalı satır');

  async function handleAddCategory(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!catName.trim()) return;
    await addCategory({ name: catName.trim(), icon: catIcon, type: catType, color: catColor ?? '#64748b' });
    setCatName('');
  }

  return (
    <div className="space-y-4">
      {/* Görünüm */}
      <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <h3 className="font-bold text-slate-800 dark:text-slate-100">🎨 Görünüm</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold ${
                settings.theme === t
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {t === 'dark' ? '🌙 Koyu' : '☀️ Açık'}
            </button>
          ))}
        </div>
        <label className="mt-3 block">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Para birimi</span>
          <select
            value={settings.currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* Kategoriler */}
      <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <h3 className="font-bold text-slate-800 dark:text-slate-100">🏷️ Kategoriler</h3>
        {(['expense', 'income'] as const).map((t) => (
          <div key={t} className="mt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              {t === 'income' ? 'Gelir' : 'Gider'}
            </p>
            <div className="mt-1 space-y-1.5">
              {categories
                .filter((c) => c.type === t)
                .map((c) => {
                  const locked = c.id === OTHER_EXPENSE_ID || c.id === OTHER_INCOME_ID;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800"
                    >
                      <span className="text-lg">{c.icon}</span>
                      <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                        {c.name}
                      </span>
                      <span className="h-4 w-4 rounded-full" style={{ backgroundColor: c.color }} />
                      {!locked && (
                        <button
                          type="button"
                          aria-label={`${c.name} kategorisini sil`}
                          onClick={() => {
                            if (
                              window.confirm(
                                `"${c.name}" silinsin mi? Bu kategorideki işlemler "Diğer" kategorisine taşınacak.`,
                              )
                            ) {
                              deleteCategory(c.id);
                            }
                          }}
                          className="rounded-lg px-2 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}

        <form onSubmit={handleAddCategory} className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">+ Yeni kategori</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Kategori adı"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              maxLength={24}
              className="col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <select
              value={catType}
              onChange={(e) => setCatType(e.target.value as TransactionType)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="expense">Gider</option>
              <option value="income">Gelir</option>
            </select>
            <select
              value={catColor}
              onChange={(e) => setCatColor(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {COLOR_CHOICES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ICON_CHOICES.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => setCatIcon(icon)}
                className={`rounded-lg px-2 py-1 text-xl ${
                  catIcon === icon ? 'bg-emerald-100 ring-2 ring-emerald-500 dark:bg-emerald-950' : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={!catName.trim()}
            className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            Kategoriyi Ekle
          </button>
        </form>
      </section>

      {/* Veri yönetimi */}
      <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <h3 className="font-bold text-slate-800 dark:text-slate-100">💾 Veri Yönetimi</h3>
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={() => exportToCSV(transactions, categories)}
            disabled={transactions.length === 0}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-40 dark:bg-slate-700"
          >
            📤 Verileri Dışa Aktar (CSV)
          </button>
          <label className="block w-full cursor-pointer rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-bold text-white dark:bg-slate-700">
            📥 Verileri İçe Aktar (CSV)
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>

          {csvResult?.fileError && (
            <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600 dark:bg-red-950 dark:text-red-400">
              {csvResult.fileError}
            </p>
          )}

          {csvResult && !csvResult.fileError && (
            <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <p className="font-bold text-slate-700 dark:text-slate-200">Önizleme</p>
              <p className="mt-1 text-slate-600 dark:text-slate-300">
                ✅ {validCount} kayıt eklenecek • ❌ {invalidCount} satır atlanacak
              </p>
              {firstErrors.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-xs text-red-500">
                  {firstErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCsvResult(null);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                  className="flex-1 rounded-xl bg-slate-200 px-3 py-2 font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={validCount === 0 || importing}
                  className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 font-bold text-white disabled:opacity-50"
                >
                  {importing ? 'Aktarılıyor…' : `${validCount} Kaydı İçe Aktar`}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white"
          >
            🗑️ Tüm Verileri Sil
          </button>
        </div>
      </section>

      {/* Hakkında */}
      <section className="rounded-2xl bg-white p-4 text-center shadow-sm dark:bg-slate-900">
        <p className="font-bold text-slate-800 dark:text-slate-100">Gelir Gider Takip {APP_VERSION}</p>
        <p className="mt-1 text-xs text-slate-400">FarukN Tech • Verileriniz yalnızca bu cihazda saklanır</p>
      </section>

      {confirmClear && (
        <ConfirmModal
          title="Tüm veriler silinsin mi?"
          message="Tüm gelir ve gider kayıtları kalıcı olarak silinecek. Bu işlem geri alınamaz!"
          confirmLabel="Evet, Sil"
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            clearAll();
            setConfirmClear(false);
          }}
        />
      )}
    </div>
  );
}
