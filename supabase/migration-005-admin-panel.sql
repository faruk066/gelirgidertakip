-- GGT migration-005: admin yönetim paneli için RLS.
-- Supabase Dashboard → SQL Editor → New Query → yapıştır → Run. İdempotenttir.

-- 0) profiles tablosunda roller + admin bayrağı
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'user', 'passive'));

-- Eski "admin" rollü satırları bayrağa taşı (uygulama is_admin'e bakar)
update public.profiles set is_admin = true where role = 'admin';

-- Yardımcı: giriş yapan kullanıcı admin mi?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- 1) Admin tüm profilleri görebilsin (kullanıcı listesi)
drop policy if exists "admin reads all profiles" on public.profiles;
create policy "admin reads all profiles" on public.profiles
  for select to authenticated using (public.is_admin());

-- 2) Admin rol/değer düzenleyebilsin (kullanıcı ekleme-pasife alma dahil değil;
--    kullanıcı oluşturma Supabase Auth üzerinden yapılır, profil satırı tetiklenir)
drop policy if exists "admin updates profiles" on public.profiles;
create policy "admin updates profiles" on public.profiles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 3) Yeni kayıt (signUp) profil satırını otomatik açsın
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'user',
    false
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) Admin tüm workspace'leri ve üyelikleri görebilsin (denetim)
drop policy if exists "admin reads all workspaces" on public.ggt_workspaces;
create policy "admin reads all workspaces" on public.ggt_workspaces
  for select to authenticated using (public.is_admin());

drop policy if exists "admin reads all memberships" on public.ggt_workspace_members;
create policy "admin reads all memberships" on public.ggt_workspace_members
  for select to authenticated using (public.is_admin());

-- 5) Admin üye ekleyebilsin/çıkarabilsin (workspace'e kullanıcı bağlama)
drop policy if exists "admin manages memberships" on public.ggt_workspace_members;
create policy "admin manages memberships" on public.ggt_workspace_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 6) Admin işlem/kategorileri denetim için okuyabilsin
drop policy if exists "admin reads all transactions" on public.ggt_transactions;
create policy "admin reads all transactions" on public.ggt_transactions
  for select to authenticated using (public.is_admin());

drop policy if exists "admin reads all categories" on public.ggt_categories;
create policy "admin reads all categories" on public.ggt_categories
  for select to authenticated using (public.is_admin());
