-- GGT migration-007: e-posta onayı gereksinimini kaldır (test / sahte adresler için).
-- "Gerçek email zorunluluğu olmasın" isteği için.
-- Supabase Dashboard → SQL Editor → New Query → yapıştır → Run.
-- NOT: Bu, mevcut onaylanmamış kullanıcıları da onaylar (a@baa.com dahil).

-- 1) Tüm mevcut kullanıcıları onaylanmış say
update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now());

-- 2) Bundan sonra signUp ile gelenler handle_new_user trigger'ıyla yine
--    profiles satırı alır; onay gerekmez. (Supabase Auth ayarında
--    "Confirm email" kapalıyken signUp direkt session döner.)
--
-- Kalıcı ayar (Dashboard'da da kapatın):
--   Authentication → Sign In / Up → Email → "Confirm email" = OFF
