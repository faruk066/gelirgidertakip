import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Settings from './pages/Settings';
import TransactionsPage from './pages/TransactionsPage';
import { useStore } from './store';

// Recharts + SheetJS yalnız raporlarda gerekir — ayrı chunk olarak bölünür
const Reports = lazy(() => import('./pages/Reports'));

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 dark:bg-slate-950">
      <p className="font-semibold text-slate-500 dark:text-slate-400">Yükleniyor…</p>
    </div>
  );
}

export default function App() {
  const { init, ready } = useStore();

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return <Loading />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="islemler" element={<TransactionsPage />} />
          <Route
            path="raporlar"
            element={
              <Suspense fallback={<Loading />}>
                <Reports />
              </Suspense>
            }
          />
          <Route path="ayarlar" element={<Settings />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
