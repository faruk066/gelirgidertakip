import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { useAuth } from './components/AuthWidgets';
import Home from './pages/Home';
import Settings from './pages/Settings';
import TransactionsPage from './pages/TransactionsPage';
import AuthPage from './pages/Auth';
import { useStore } from './store';

const Reports = lazy(() => import('./pages/Reports'));

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 dark:bg-slate-950">
      <p className="font-semibold text-slate-500 dark:text-slate-400">Yükleniyor…</p>
    </div>
  );
}

function RequireAuth() {
  const { session, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/auth" replace />;
  return null;
}

export default function App() {
  const { init, ready } = useStore();

  useEffect(() => {
    init();
  }, []);

  if (!ready) {
    return <Loading />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          element={
            <>
              <RequireAuth />
              <Layout />
            </>
          }
        >
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
