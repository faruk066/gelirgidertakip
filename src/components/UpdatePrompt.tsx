import { useRegisterSW } from 'virtual:pwa-register/react';
import { APP_VERSION } from '../lib/version';

/** Yeni PWA sürümü yayınlandığında altta beliren güncelleme bildirimi */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // Uygulama açıkken periyodik olarak güncelleme denetle (saatte bir)
      if (r) {
        setInterval(() => {
          r.update().catch(() => undefined);
        }, 60 * 60 * 1000);
      }
      // eslint-disable-next-line no-console
      console.log(`SW kayıtlı: ${swUrl}`);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl bg-slate-900 p-4 shadow-2xl dark:bg-white">
      <p className="text-sm font-bold text-white dark:text-slate-900">🎉 Yeni sürüm mevcut!</p>
      <p className="mt-0.5 text-xs text-slate-300 dark:text-slate-500">
        Güncellemeyi yüklemek için uygulamayı yenileyin.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="flex-1 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-bold text-slate-200 dark:bg-slate-200 dark:text-slate-700"
        >
          Daha Sonra
        </button>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"
        >
          Güncelle {APP_VERSION}
        </button>
      </div>
    </div>
  );
}
