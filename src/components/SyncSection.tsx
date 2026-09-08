import { useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  getLastSync,
  getWorkspace,
  newWorkspaceCode,
  setWorkspace,
  syncNow,
} from '../lib/sync';
import { useStore } from '../store';

function formatLastSync(iso: string | null): string {
  if (!iso) return 'henüz yapılmadı';
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Ayarlar → Bulut Senkron bölümü (girişsiz, senkron kodlu) */
export default function SyncSection() {
  const { reload } = useStore();
  const [code, setCode] = useState(getWorkspace() ?? '');
  const [active, setActive] = useState<string | null>(getWorkspace());
  const [lastSync, setLastSync] = useState<string | null>(getLastSync());
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  function show(msg: string, err = false): void {
    setMessage(msg);
    setIsError(err);
  }

  function join(): void {
    const c = code.trim().toLocaleUpperCase('tr-TR');
    if (!c) {
      show('Bir senkron kodu yazın ya da yeni kod oluşturun.', true);
      return;
    }
    setWorkspace(c);
    setActive(c);
    setCode(c);
    show(`"${c}" koduna bağlanıldı. Şimdi senkronize edin.`);
  }

  function create(): void {
    const c = newWorkspaceCode();
    setWorkspace(c);
    setActive(c);
    setCode(c);
    show(`Yeni kod oluşturuldu: ${c} — bu kodu diğer cihazda da girin.`);
  }

  function disconnect(): void {
    setWorkspace(null);
    setActive(null);
    setLastSync(null);
    show('Bulut bağlantısı kesildi. Yerel verileriniz duruyor.');
  }

  async function runSync(): Promise<void> {
    setSyncing(true);
    show('Senkronize ediliyor…');
    try {
      const s = await syncNow();
      await reload();
      setLastSync(getLastSync());
      show(
        `Tamamlandı ↑${s.pushedTx} işlem ↑${s.pushedCat} kategori ↓${s.pulledTx} işlem ↓${s.pulledCat} kategori` +
          (s.deletedRemote > 0 ? ` 🗑️${s.deletedRemote} silindi` : ''),
      );
    } catch (e) {
      show(e instanceof Error ? e.message : 'Senkron başarısız.', true);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <h3 className="font-bold text-slate-800 dark:text-slate-100">☁️ Bulut Senkron</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Aynı senkron kodunu giren cihazlar aynı veriyi görür. Kayıt bazında son yazan kazanır.
      </p>

      {!isSupabaseConfigured && (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          Supabase yapılandırılmamış (.env eksik).
        </p>
      )}

      {active ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950">
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              🔗 {active}
            </span>
            <button
              type="button"
              onClick={disconnect}
              className="text-xs font-bold text-red-500"
            >
              Bağlantıyı Kes
            </button>
          </div>
          <button
            type="button"
            onClick={runSync}
            disabled={syncing}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {syncing ? 'Senkronize ediliyor…' : '🔄 Şimdi Senkronize Et'}
          </button>
          <p className="text-center text-xs text-slate-400">
            Son senkron: {formatLastSync(lastSync)}
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            placeholder="Senkron kodu (örn. GGT-7KQ2XA)"
            value={code}
            onChange={(e) => setCode(e.target.value.toLocaleUpperCase('tr-TR'))}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold tracking-wider text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={join}
              className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white dark:bg-slate-700"
            >
              Koda Katıl
            </button>
            <button
              type="button"
              onClick={create}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              + Yeni Kod
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          className={`mt-2 rounded-xl p-3 text-sm font-medium ${
            isError
              ? 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
              : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {message}
        </p>
      )}
    </section>
  );
}
