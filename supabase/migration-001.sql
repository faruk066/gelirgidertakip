-- Gelir Gider Takip — Supabase şeması (v1)
-- Supabase Dashboard → SQL Editor → New Query → yapıştır → Run
--
-- NOT: Tablolar anon (publishable) anahtarına açık. Satırlar "workspace"
-- (senkron kodu) ile ayrılır; kodu bilen yazıp okuyabilir. Tahmin edilemez
-- kodlar kullanılır (uygulama GGT-XXXXXX formatında üretir).

create table if not exists public.ggt_transactions (
  id text primary key,
  workspace text not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric not null,
  category_id text not null,
  date text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ggt_tx_ws on public.ggt_transactions (workspace);

create table if not exists public.ggt_categories (
  id text primary key,
  workspace text not null,
  name text not null,
  icon text not null default '✨',
  type text not null check (type in ('income', 'expense')),
  color text not null default '#64748b',
  updated_at timestamptz not null default now()
);
create index if not exists idx_ggt_cat_ws on public.ggt_categories (workspace);

alter table public.ggt_transactions enable row level security;
alter table public.ggt_categories enable row level security;

drop policy if exists "anon_all" on public.ggt_transactions;
create policy "anon_all" on public.ggt_transactions
  for all to anon using (true) with check (true);

drop policy if exists "anon_all" on public.ggt_categories;
create policy "anon_all" on public.ggt_categories
  for all to anon using (true) with check (true);
