-- GGT migration-004: giriş sonrası veri çekme + yazma 403'lerini düzeltir.
-- Sorunlar:
--  1) migration-002'deki "workspace members see own ..." politikalarında WITH CHECK
--     yoktu → upsert/insert 403 (Forbidden) veriyordu. Ekran görüntüsündeki
--     ggt_categories 403 hatası buydu.
--  2) Eski verilerde workspace_id NULL olabilir → yeni kod workspace_id ile
--     çekince admin verileri gelmiyordu. Bu migration admin verilerini sahiplendirir.
-- Supabase Dashboard → SQL Editor → New Query → yapıştır → Run. İdempotenttir.
--
-- ADIM 0: admin e-postasını buraya yazın
-- ↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓
-- Örn: 'faruk66@gmail.com'
-- ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑

-- 1) İşlem + kategori tablolarında üye yazma politikaları (WITH CHECK'li)
drop policy if exists "workspace members write own items" on public.ggt_transactions;
create policy "workspace members write own items" on public.ggt_transactions
  for insert to authenticated with check (
    exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_transactions.workspace_id
      and m.user_id = auth.uid()
    )
  );

drop policy if exists "workspace members update own items" on public.ggt_transactions;
create policy "workspace members update own items" on public.ggt_transactions
  for update to authenticated
  using (
    exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_transactions.workspace_id
      and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_transactions.workspace_id
      and m.user_id = auth.uid()
    )
  );

drop policy if exists "workspace members write own categories" on public.ggt_categories;
create policy "workspace members write own categories" on public.ggt_categories
  for insert to authenticated with check (
    exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_categories.workspace_id
      and m.user_id = auth.uid()
    )
  );

drop policy if exists "workspace members update own categories" on public.ggt_categories;
create policy "workspace members update own categories" on public.ggt_categories
  for update to authenticated
  using (
    exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_categories.workspace_id
      and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_categories.workspace_id
      and m.user_id = auth.uid()
    )
  );

-- 2) ESKİ VERİLERİ ADMİN'E SAHİPLENDİR (service_role ile çalışır — Dashboard SQL Editor uygundur)
-- 2a. Admin kullanıcısının workspace'i yoksa aç
do $$
declare
  admin_uid uuid;
  ws_id uuid;
  admin_email text := 'faruk66@gmail.com'; -- ← kendi admin e-postanız
begin
  select id into admin_uid from auth.users where email = admin_email limit 1;
  if admin_uid is null then
    raise notice 'admin bulunamadı: %', admin_email;
    return;
  end if;

  select workspace_id into ws_id
  from public.ggt_workspace_members where user_id = admin_uid limit 1;

  if ws_id is null then
    select id into ws_id from public.ggt_workspaces where owner_id = admin_uid limit 1;
  end if;

  if ws_id is null then
    insert into public.ggt_workspaces (owner_id, name)
    values (admin_uid, 'Varsayılan')
    returning id into ws_id;
  end if;

  insert into public.ggt_workspace_members (workspace_id, user_id, role)
  values (ws_id, admin_uid, 'owner')
  on conflict do nothing;

  -- workspace_id'si boş eski satırları admin workspace'ine bağla
  update public.ggt_transactions set workspace_id = ws_id where workspace_id is null;
  update public.ggt_categories set workspace_id = ws_id where workspace_id is null;

  raise notice 'admin workspace: % (% satır sahiplendirildi)', ws_id, admin_email;
end $$;
