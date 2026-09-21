-- GGT migration-006: çift üyelik satırlarını temizle + tekrarı engelle.
-- Supabase Dashboard → SQL Editor → New Query → yapıştır → Run. İdempotenttir.

-- Aynı (workspace_id, user_id) çiftinden birden fazla varsa en eskisini tut
delete from public.ggt_workspace_members a
using public.ggt_workspace_members b
where a.id > b.id
  and a.workspace_id = b.workspace_id
  and a.user_id = b.user_id;

-- Tekrarı DB seviyesinde engelle
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ggt_workspace_members_ws_user_unique'
  ) then
    alter table public.ggt_workspace_members
      add constraint ggt_workspace_members_ws_user_unique unique (workspace_id, user_id);
  end if;
end $$;
