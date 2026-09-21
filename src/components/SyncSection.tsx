import { useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthWidgets';
import {
  getLastSync,
  pullUserData,
  pushUserData,
  getUserWorkspaceId,
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

/** Ayarlar → Bulut Senkron bölümü (giriş yapan kullanıcının kendi workspace'i).
 *  Eski "senkron kodu" sistemi kaldırıldı: migration-008 sonrası RLS,
 *  workspace metin koduyla yazmayı reddediyor (ekrandaki RLS hatası buydu). */
export default function SyncSection() {
  const { reload } = useStore();
  const { user } = useAuth();
  const [lastSync, setLastSync] = useState<string | null>(getLastSync());
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const wsShort = (getUserWorkspaceId() ?? '').slice(0, 8);

  function show(msg: string, err = false): void {
    setMessage(msg);
    setIsError(err);
  }

  async function runSync(): Promise<void> {
    setSyncing(true);
    show('Senkronize ediliyor…');
    try {
      if (!supabase) throw new Error('Supabase yapılandırılmamış (.env eksik).');
      if (!user) throw new Error('Önce giriş yapın.');
      const pulled = await pullUserData();
      await pushUserData();
      try {
        localStorage.setItem('ggt-last-sync', new Date().toISOString());
      } catch {
        /* yoksay */
      }
      await reload();
      setLastSync(getLastSync());
      show(
        `Tamamlandı ↑ işlem/kategori gönderildi ↓${pulled.pulledTx} işlem ↓${pulled.pulledCat} kategori`,
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
        Giriş yapan hesabın verisi otomatik eşitlenir. Buton, o anki hesabın
        bulut verisini indirip yereli buluta gönderir.
      </p>

      {!isSupabaseConfigured && (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          Supabase yapılandırılmamış (.env eksik).
        </p>
      )}

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950">
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
            🔗 {user?.email ?? 'giriş yok'}{wsShort ? ` • ${wsShort}` : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={runSync}
          disabled={syncing || !user}
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {syncing ? 'Senkronize ediliyor…' : '🔄 Şimdi Senkronize Et'}
        </button>
        <p className="text-center text-xs text-slate-400">
          Son senkron: {formatLastSync(lastSync)}
        </p>
      </div>

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
