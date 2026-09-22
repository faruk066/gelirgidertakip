# 💰 Gelir Gider Takip — FarukN Tech

Kisisel gelir ve giderlerinizi takip edebileceginiz, **offline-first** calisan modern bir **PWA** uygulamasidir. Internetsiz ortamda bile tum verileriniz aninda acilir; baglanti geri geldiginde bulut ile sessizce esitlenir.

## Ozellikler

- **Offline-First:** Veriler once Dexie (IndexedDB) yereline yazilir, ekrana aninda yansir. Bulut senkronu arka planda calisir, ekrani asla kilitlemez.
- **Bulut Senkron:** Supabase tabanli kullanici bazli workspace. Kayit bazinda last-write-wins birlestirme + silme mezarligi (tombstone).
- **Raporlar:** Gunluk / haftalik / aylik ozetler, grafikler (Recharts).
- **Islem Yonetimi:** Gelir/gider ekleme, duzenleme, silme, kategori yonetimi, hizli ekle (FAB).
- **Ice/Disa Aktar:** CSV ve Excel (XLSX) ice aktarma + disa aktarma.
- **Auth + Admin:** Supabase Auth ile giris, admin paneli ve rol yonetimi.
- **PWA:** Telefona kurulabilir, cevrimdisi acilir, yeni surumde guncelleme bildirimi gosterir.
- **Tema + Para Birimi:** Acik/koyu tema, coklu para birimi destegi.

## Mimari (Offline-First)

Kullanici islemi -> Zustand store -> Dexie (IndexedDB) -> ekran aninda guncellenir.
Ayni anda backgroundPush() (800ms debounce) cevrimiciyse Supabase'e sessizce gonderir.

- **Acilis:** init() yereli okuyup ready yapar, ekran hemen gelir.
- **Giris:** syncUserData() once yerel veriyi gosterir, bulutu arka planda ceker (kor clear yok).
- **Cevrimdisi:** navigator.onLine false ise ag hic denenmez; online eventi gelince senkron otomatik tekrar denenir.
- **Cikis:** bekleyen veri (cevrimiciyse) once buluta gonderilir, sonra yerel temizlenir.
- **PWA:** navigateFallback index.html ile uygulama kabugu cevrimdisi da acilir. Supabase API asla cachelenmez.

## Teknolojiler

- Frontend: React 19 + TypeScript + Vite + React Router 7 + Tailwind CSS 4
- State / Yerel DB: Zustand 5 + Dexie 4 (IndexedDB)
- Bulut: Supabase Auth, Postgres, RLS
- PWA: vite-plugin-pwa (Workbox, generateSW)
- Grafik / Dosya: Recharts, xlsx, PapaParse

## Kurulum

```bash
npm install
cp .env.example .env
# .env icine Supabase proje bilgilerini yazin:
#   VITE_SUPABASE_URL=https://xxx.supabase.co
#   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
npm run dev
npm run build
npm run preview
npm run lint
```

## Supabase Kurulumu (Migrations)

supabase/ klasorundeki migration'lari Supabase SQL Editor'de sirayla calistirin:
- migration-001.sql: ggt_transactions, ggt_categories tablolari
- migration-002-auth.sql: Auth + workspace uyelikleri
- migration-003-auth-fix.sql: Auth duzeltmeleri
- migration-004-fix-403-and-adopt.sql: 403/RLS duzeltmeleri
- migration-005-admin-panel.sql: profiles + admin paneli
- migration-006-dedupe-members.sql: Uyelik tekillestirme (23505 korumasi)
- migration-007-disable-email-confirm.sql: E-posta onayi kapatma
- migration-008-close-leak.sql: RLS sizinti kapatma (workspace metin koduyla yazma yasagi)

> NOT: migration-008 sonrasi yazmalar workspace_id (UUID) ile yapilir (src/lib/sync.ts: pushUserData / pushUserCategories).

Seed ilk admin:

```bash
npx tsx scripts/seed-admin.ts <e-posta>
```

## Proje Yapisi

```
src/
  App.tsx              # Router + Auth guard + UserDataSync (banner, offline-first)
  main.tsx
  store.ts             # Zustand store (Dexie okuma/yazma, syncUserData, backgroundPush)
  components/          # AuthWidgets, Layout, SyncSection, TransactionForm, TransactionList, UpdatePrompt...
  hooks/useRangeSummary.ts
  lib/                 # db.ts (Dexie semasi), sync.ts, supabase.ts, csv.ts, excel.ts, dateUtils.ts, format.ts, version.ts
  pages/               # Home, TransactionsPage, Reports, Settings, Auth, Admin
  types/index.ts
supabase/              # SQL migration'lari (001-008)
scripts/               # gen-icons, seed-admin, test-csv-import, test-sync
public/icons/          # PWA ikonlari (192 / 512)
```

## Senkron Mantigi (Ozet)

- pullUserData(): sadece kendi workspace_id'sine ait satirlari ceker, kayit bazinda yenisi kazanir.
- pushUserData() / pushUserCategories(): toplu-diff; once buluttaki id+updated_at ogrenilir, sadece eksik/yeni olanlar insert edilir, sadece yerelde daha yeni olanlar update edilir.
- Silinenler localStorage mezarliginda (ggt-deleted) tutulur, basarili push sonrasi buluttan da silinir.
- Her yazmadan sonra backgroundPush() 800ms debounce ile sessiz gonderim yapar.

## Deploy (Vercel)

vercel.json SPA rewrite icerir (/(.*) -> /index.html). Vercel'de repo'yu import edin (framework: Vite), env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY. PWA service worker otomatik uretilir (dist/sw.js).

## Surumleme

Surum src/lib/version.ts icindeki APP_VERSION ile takip edilir (su an v1.2.0). Yeni surumde burayi artirin; UpdatePrompt kullaniciya gosterir.

## Lisans

Bu proje ozel bir projedir (FarukN Tech).

