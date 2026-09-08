-- 1. Kullanıcı profili (auth.uid'ye bağlanır)
create table if not exists public.profiles (
  id uuid primary key,
  email text unique,
  full_name text,
  role text check (role in ('admin', 'user')) default 'user',
  created_at timestamptz default now()
);

-- 2. Etkin workspace
create table if not exists public.ggt_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users not null,
  name text,
  created_at timestamptz default now()
);

-- 3. Workspace üyelikleri
create table if not exists public.ggt_workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.ggt_workspaces on delete cascade,
  user_id uuid references auth.users not null,
  role text check (role in ('owner', 'admin', 'member')) default 'member'
);

-- Eski anonim workspace sütununu migration et
alter table public.ggt_transactions add column if not exists workspace_id uuid references public.ggt_workspaces;
alter table public.ggt_categories add column if not exists workspace_id uuid references public.ggt_workspaces;

-- RLS
alter table public.ggt_transactions enable row level security;
alter table public.ggt_categories enable row level security;
alter table public.ggt_workspaces enable row level security;
alter table public.ggt_workspace_members enable row level security;
alter table public.profiles enable row level security;

-- Policy: kullanıcı sadece workspace'indeki kayıtları görebilir
create policy "workspace members see own items"
  on public.ggt_transactions
  for all using (
    exists (
      select 1 from public.ggt_workspace_members m
      join public.ggt_workspaces w on m.workspace_id = w.id
      where m.user_id = auth.uid()
      and (w.id = ggt_transactions.workspace_id)
    )
  );

create policy "workspace members see own categories"
  on public.ggt_categories
  for all using (
    exists (
      select 1 from public.ggt_workspace_members m
      where m.workspace_id = ggt_categories.workspace_id
      and m.user_id = auth.uid()
    )
  );

create policy "user can read own profile"
  on public.profiles
  for select using (auth.uid() = id);

create policy "users can update own profile"
  on public.profiles
  for update using (auth.uid() = id);

-- Etkin workspace sorgusu için fonksiyon (isteğe bağlı)
create or replace function public.current_user_workspace()
returns table (id uuid) language sql as $$
  select m.workspace_id
  from public.ggt_workspace_members m
  where m.user_id = auth.uid()
  limit 1;
$$;
