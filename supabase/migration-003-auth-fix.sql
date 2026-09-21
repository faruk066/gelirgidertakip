-- GGT migration-003: giriş yapan kullanıcının kendi verisini çekebilmesi için
-- eksik RLS politikaları (migration-002'yi tamamlar).
-- Supabase Dashboard → SQL Editor → New Query → yapıştır → Run. İdempotenttir.

-- 1) profiles: kullanıcı kendi satırını oluşturabilsin (ilk giriş bootstrap)
drop policy if exists "user can insert own profile" on public.profiles;
create policy "user can insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- 2) ggt_workspaces: sahip + üyeler okuyabilsin, giriş yapan workspace açabilsin
drop policy if exists "owner reads own workspaces" on public.ggt_workspaces;
create policy "owner reads own workspaces" on public.ggt_workspaces
  for select to authenticated using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_workspaces.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "user creates own workspace" on public.ggt_workspaces;
create policy "user creates own workspace" on public.ggt_workspaces
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "owner updates own workspace" on public.ggt_workspaces;
create policy "owner updates own workspace" on public.ggt_workspaces
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 3) ggt_workspace_members: kullanıcı kendi üyeliklerini görebilsin + ekleyebilsin
drop policy if exists "user reads own memberships" on public.ggt_workspace_members;
create policy "user reads own memberships" on public.ggt_workspace_members
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "user adds own membership" on public.ggt_workspace_members;
create policy "user adds own membership" on public.ggt_workspace_members
  for insert to authenticated with check (user_id = auth.uid());
