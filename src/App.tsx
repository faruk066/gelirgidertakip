import { Suspense, lazy, useEffect, useRef } from 'react';
import { BrowserRouter, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider, useAuth, useProfile } from './components/AuthWidgets';
import Home from './pages/Home';
import Settings from './pages/Settings';
import AdminPage from './pages/Admin';
import TransactionsPage from './pages/TransactionsPage';
import AuthPage from './pages/Auth';
import { useStore } from './store';

const Reports = lazy(() => import('./pages/Reports'));

function Loading({ message = 'Yükleniyor…' }: { message?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 dark:bg-slate-950">
      <p className="font-semibold text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}

function RequireAuth() {
  const { session, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/auth" replace />;
  return <Outlet />;
}

function RequireAdmin() {
  const { session, loading } = useAuth();
  const { isAdmin, loading: pLoading, loaded } = useProfile();
  // Profil henüz yüklenmediyse karar verme: bekle (anasayfaya atma!)
  if (loading || pLoading || !loaded) return <Loading message="Yetki kontrol ediliyor…" />;
  if (!session) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}

function RequireGuest() {
  const { session, loading } = useAuth();
  if (loading) return <Loading />;
  // Zaten girişli kullanıcı /auth'a gelirse ana ekrana gönder
  if (session) return <Navigate to="/" replace />;
  return <AuthPage />;
}

/** Giriş yapan kullanıcının bulut verisini hemen çek; çıkışta yereli temizle */
function UserDataSync() {
  const { user, loading } = useAuth();
  const syncUserData = useStore((s) => s.syncUserData);
  const clearLocalData = useStore((s) => s.clearLocalData);
  const syncStatus = useStore((s) => s.syncState.status);
  const syncMessage = useStore((s) => s.syncState.message);
  const prevUser = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;
    const id = user?.id ?? null;
    if (id && id !== prevUser.current) {
      prevUser.current = id;
      void syncUserData(id);
    } else if (!id && prevUser.current) {
      prevUser.current = null;
      void clearLocalData();
    }
  }, [user?.id, loading, syncUserData, clearLocalData]);

  if (syncStatus === 'syncing') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <p className="font-semibold text-slate-500 dark:text-slate-400">
          ☁️ {syncMessage || 'Buluttaki verileriniz yükleniyor…'}
        </p>
      </div>
    );
  }
  if (syncStatus === 'error' && user) {
    return (
      <div className="fixed bottom-20 left-1/2 z-50 w-max max-w-[90vw] -translate-x-1/2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg">
        ⚠️ {syncMessage}
      </div>
    );
  }
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
      <AuthProvider>
        <UserDataSync />
        <Routes>
          <Route path="/auth" element={<RequireGuest />} />
          <Route element={<RequireAuth />}>
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
              <Route element={<RequireAdmin />}>
                <Route path="admin" element={<AdminPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
