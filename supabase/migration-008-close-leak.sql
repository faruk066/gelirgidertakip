-- GGT migration-008: veri sızıntısını kapat.
-- Sorun: migration-002'deki "FOR ALL ... USING (üye mi?)" politikası
-- workspace_id IS NULL satırlar için USING koşulunu NULL yapıyor, ama
-- Supabase/PostgREST NULL workspace satırları admin dahil herkese
-- döndürebiliyordu + uygulama NULL satırları da çekiyordu.
-- Bu migration:
--  1) Eski FOR ALL politikalarını kaldırır (USING + WITH CHECK ayrık yazılır).
--  2) Okuma: SADECE üyesi olunan workspace (workspace_id eşleşmeli, NULL hariç).
--  3) Yazma: SADECE üyesi olunan workspace + workspace_id NOT NULL zorunlu.
--  4) NULL kalan satırları admin workspace'ine sahiplendirir (tek seferlik).
-- Supabase Dashboard → SQL Editor → New Query → yapıştır → Run.

-- 1) Eski geniş politikaları kaldır (migration-008'in kendisi dahil — tekrar çalıştırılabilir)
drop policy if exists "workspace members see own items" on public.ggt_transactions;
drop policy if exists "workspace members see own categories" on public.ggt_categories;
drop policy if exists "workspace members write own items" on public.ggt_transactions;
drop policy if exists "workspace members update own items" on public.ggt_transactions;
drop policy if exists "workspace members write own categories" on public.ggt_categories;
drop policy if exists "workspace members update own categories" on public.ggt_categories;
drop policy if exists "member reads own workspace items" on public.ggt_transactions;
drop policy if exists "member reads own workspace categories" on public.ggt_categories;
drop policy if exists "member inserts own workspace items" on public.ggt_transactions;
drop policy if exists "member updates own workspace items" on public.ggt_transactions;
drop policy if exists "member deletes own workspace items" on public.ggt_transactions;
drop policy if exists "member inserts own workspace categories" on public.ggt_categories;
drop policy if exists "member updates own workspace categories" on public.ggt_categories;
drop policy if exists "member deletes own workspace categories" on public.ggt_categories;

-- 2) OKUMA: üye olunan workspace, NULL hariç
create policy "member reads own workspace items" on public.ggt_transactions
  for select to authenticated using (
    workspace_id is not null and exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_transactions.workspace_id
      and m.user_id = auth.uid()
    )
  );

create policy "member reads own workspace categories" on public.ggt_categories
  for select to authenticated using (
    workspace_id is not null and exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_categories.workspace_id
      and m.user_id = auth.uid()
    )
  );

-- 3) YAZMA: üye olunan workspace + workspace_id zorunlu
create policy "member inserts own workspace items" on public.ggt_transactions
  for insert to authenticated with check (
    workspace_id is not null and exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_transactions.workspace_id
      and m.user_id = auth.uid()
    )
  );

create policy "member updates own workspace items" on public.ggt_transactions
  for update to authenticated
  using (
    workspace_id is not null and exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_transactions.workspace_id
      and m.user_id = auth.uid()
    )
  )
  with check (
    workspace_id is not null and exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_transactions.workspace_id
      and m.user_id = auth.uid()
    )
  );

create policy "member deletes own workspace items" on public.ggt_transactions
  for delete to authenticated using (
    workspace_id is not null and exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_transactions.workspace_id
      and m.user_id = auth.uid()
    )
  );

create policy "member inserts own workspace categories" on public.ggt_categories
  for insert to authenticated with check (
    workspace_id is not null and exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_categories.workspace_id
      and m.user_id = auth.uid()
    )
  );

create policy "member updates own workspace categories" on public.ggt_categories
  for update to authenticated
  using (
    workspace_id is not null and exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_categories.workspace_id
      and m.user_id = auth.uid()
    )
  )
  with check (
    workspace_id is not null and exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_categories.workspace_id
      and m.user_id = auth.uid()
    )
  );

create policy "member deletes own workspace categories" on public.ggt_categories
  for delete to authenticated using (
    workspace_id is not null and exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_categories.workspace_id
      and m.user_id = auth.uid()
    )
  );

-- 4) NULL kalan eski satırları ilk workspace'e sahiplendir (tek seferlik temizlik)
do $$
declare
  ws_id uuid;
begin
  select id into ws_id from public.ggt_workspaces order by created_at limit 1;
  if ws_id is not null then
    update public.ggt_transactions set workspace_id = ws_id where workspace_id is null;
    update public.ggt_categories set workspace_id = ws_id where workspace_id is null;
  end if;
end $$;
