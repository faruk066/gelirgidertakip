import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import type { TransactionType } from '../types';
import TransactionForm from './TransactionForm';
import UpdatePrompt from './UpdatePrompt';

const TABS = [
  { to: '/', label: 'Ana Sayfa', icon: '🏠', end: true },
  { to: '/islemler', label: 'İşlemler', icon: '🧾', end: false },
  { to: '/raporlar', label: 'Raporlar', icon: '📊', end: false },
  { to: '/ayarlar', label: 'Ayarlar', icon: '⚙️', end: false },
];

export default function Layout() {
  const [fabOpen, setFabOpen] = useState(false);
  const [formType, setFormType] = useState<TransactionType | null>(null);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-slate-100 dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="px-4 py-3">
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            💰 Gelir Gider Takip
          </h1>
          <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">FarukN Tech</p>
        </div>
      </header>

      <main className="flex-1 px-4 pb-32 pt-4">
        <Outlet />
      </main>

      {/* Hızlı ekle (FAB) */}
      <button
        type="button"
        aria-label="Hızlı ekle"
        onClick={() => setFabOpen(true)}
        className="fixed bottom-24 right-[max(1rem,calc(50%-14rem))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-3xl font-bold text-white shadow-lg transition active:scale-95"
      >
        +
      </button>

      {/* Gelir/Gider seçim modalı */}
      {fabOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setFabOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-center text-lg font-bold text-slate-900 dark:text-white">Ne ekliyorsun?</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setFabOpen(false);
                  setFormType('income');
                }}
                className="rounded-2xl bg-green-600 px-4 py-5 text-lg font-bold text-white"
              >
                💰
                <span className="block">Gelir</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFabOpen(false);
                  setFormType('expense');
                }}
                className="rounded-2xl bg-red-600 px-4 py-5 text-lg font-bold text-white"
              >
                💸
                <span className="block">Gider</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {formType && <TransactionForm defaultType={formType} onClose={() => setFormType(null)} />}

      <UpdatePrompt />

      {/* Alt navigasyon */}
      <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-xl -translate-x-1/2 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-4">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
                  isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                }`
              }
            >
              <span className="text-xl">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
