import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

function trError(message: string): string {
  if (/email not confirmed/i.test(message)) {
    return 'E-posta onaylanmamış. Supabase → Authentication → Sign In / Up → "Confirm email" kapalı olmalı; ya da SQL ile e-postayı onaylayın (aşağıya bakın).';
  }
  if (/invalid login credentials|invalid.*password/i.test(message)) {
    return 'E-posta veya şifre hatalı.';
  }
  if (/user already registered|already exists/i.test(message)) {
    return 'Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.';
  }
  if (/email.*invalid|invalid.*email/i.test(message)) {
    return 'E-posta adresi geçersiz görünüyor. Gerçek bir adres yazın (örn. ad@mail.com).';
  }
  return message;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!supabase) {
      setError('Supabase yapılandırılmamış (.env eksik).');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) {
          setError(trError(err.message));
          return;
        }
        // onAuthStateChange RequireGuest'i tetikler; garanti olması için
        // manuel yönlendirme de yap (replace: geri tuşu /auth'a dönmesin).
        navigate('/', { replace: true });
      }

      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (err) {
          setError(trError(err.message));
        } else {
          setSuccess('Kayıt oluşturuldu. E-posta onayı kapalıysa doğrudan giriş yapabilirsiniz.');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <h2 className="text-center text-xl font-bold text-slate-900 dark:text-white">
          {mode === 'signin' ? '🚪 Giriş Yap' : '📝 Kayıt Ol'}
        </h2>

        <form onSubmit={handle} className="mt-4 space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Adınız Soyadınız
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              E-posta
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Şifre
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600 dark:bg-red-950 dark:text-red-400">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              {success}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-60"
          >
            {busy ? 'Bekleyin…' : mode === 'signin' ? 'Giriş Yap' : 'Kaydol'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-emerald-600 dark:text-emerald-400"
          >
            {mode === 'signin'
              ? 'Hesabın yok mu? Kaydol'
              : 'Zaten hesabın var mı? Giriş yap'}
          </button>
        </div>
      </div>
    </div>
  );
}
