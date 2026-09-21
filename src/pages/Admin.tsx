import { useEffect, useMemo, useState } from 'react';
import { useProfile } from '../components/AuthWidgets';
import type { Profile } from '../components/AuthWidgets';
import { supabase } from '../lib/supabase';

type RoleFilter = 'all' | 'user' | 'passive';

interface MemberRow {
  id: string;
  user_id: string;
  workspace_id: string;
  role: string;
  email: string | null;
}

export default function AdminPage() {
  const { profile, loading: pl, loaded: plLoaded, isAdmin } = useProfile();
  const [users, setUsers] = useState<Profile[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  void loading;
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      if (!supabase) throw new Error('Veritabani baglantisi yok.');
      const { data: pData, error: pErr } = await supabase
        .from('profiles')
        .select('id,email,full_name,role,is_admin,created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (pErr) throw pErr;
      setUsers((pData as Profile[]) ?? []);
      const emailMap = new Map<string, string | null>();
      ((pData as Profile[]) ?? []).forEach((u) => emailMap.set(u.id, u.email ?? null));
      const { data: mData, error: mErr } = await supabase
        .from('ggt_workspace_members')
        .select('id,user_id,workspace_id,role')
        .limit(500);
      if (mErr) throw mErr;
      const rows: MemberRow[] = (
        (mData as { id: string; user_id: string; workspace_id: string; role: string }[]) ?? []
      ).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        workspace_id: m.workspace_id,
        role: m.role,
        email: emailMap.get(m.user_id) ?? null,
      }));
      // Aynı (workspace, kullanıcı) çiftini tekille; SAHİPLİK öncelikli:
      // owner satırı varsa member tekrarı atılır. Farklı workspace'ler korunur.
      const byKey = new Map<string, MemberRow>();
      for (const m of rows) {
        const k = `${m.workspace_id}::${m.user_id}`;
        const cur = byKey.get(k);
        if (!cur || (cur.role !== 'owner' && m.role === 'owner')) byKey.set(k, m);
      }
      setMembers([...byKey.values()]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Yukleme hatasi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!pl && plLoaded && isAdmin) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pl, plLoaded, isAdmin]);
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return users.filter((u) => {
      if (roleFilter === 'user' && u.role === 'passive') return false;
      if (roleFilter === 'passive' && u.role !== 'passive') return false;
      if (!q) return true;
      const e = (u.email ?? '').toLocaleLowerCase('tr-TR');
      const n = (u.full_name ?? '').toLocaleLowerCase('tr-TR');
      return e.includes(q) || n.includes(q);
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const passive = users.filter((u) => u.role === 'passive').length;
    const active = total - passive;
    const admins = users.filter((u) => u.is_admin || u.role === 'admin').length;
    return { total, active, passive, admins };
  }, [users]);

  async function updateUser(u: Profile, patch: { role?: string; is_admin?: boolean }, msg: string) {
    if (profile && u.id === profile.id) return;
    if (!supabase) { setError('Veritabani baglantisi yok.'); return; }
    try {
      setBusyId(u.id);
      setError(null);
      setNotice(null);
      const { error: upErr } = await supabase.from('profiles').update(patch).eq('id', u.id);
      if (upErr) throw upErr;
      setNotice(msg);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Guncelleme hatasi.');
    } finally {
      setBusyId(null);
    }
  }
  /** Kullanıcıyı sizin workspace'inize üye olarak ekle (tek tık) */
  async function quickAdd(u: Profile) {
    if (!supabase) { setError('Veritabani baglantisi yok.'); return; }
    if (profile && u.id === profile.id) return;
    setBusyId(u.id);
    setError(null);
    setNotice(null);
    try {
      // 1) Benim workspace'im (sahiplik öncelikli, sonra üyelik)
      let wsId: string | null = null;
      const me = profile?.id;
      if (me) {
        const { data: owned } = await supabase.from('ggt_workspaces').select('id').eq('owner_id', me).limit(1);
        wsId = (owned as { id: string }[] | null)?.[0]?.id ?? null;
        if (!wsId) {
          const { data: mem } = await supabase.from('ggt_workspace_members').select('workspace_id').eq('user_id', me).limit(1);
          wsId = (mem as { workspace_id: string }[] | null)?.[0]?.workspace_id ?? null;
        }
      }
      // 2) Hiç workspace'im yoksa aç (ilk kurulum)
      if (!wsId && me) {
        const { data: created, error: cErr } = await supabase.from('ggt_workspaces').insert({ owner_id: me, name: 'Varsayilan' }).select('id').single();
        if (cErr || !created) throw new Error(`Calisma alani acilamadi: ${cErr?.message ?? 'hata'}`);
        wsId = (created as { id: string }).id;
        await supabase.from('ggt_workspace_members').insert({ workspace_id: wsId, user_id: me, role: 'owner' });
      }
      if (!wsId) throw new Error('Workspace bulunamadi.');
      // 3) Zaten üye mi?
      if (members.some((m) => m.user_id === u.id && m.workspace_id === wsId)) {
        setNotice(`${u.email ?? 'Kullanici'} zaten uye.`);
        return;
      }
      const { error: insErr } = await supabase.from('ggt_workspace_members').insert({ workspace_id: wsId, user_id: u.id, role: 'member' });
      if (insErr) throw insErr;
      setNotice(`${u.email ?? 'Kullanici'} uyelige eklendi.`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ekleme hatasi.');
    } finally {
      setBusyId(null);
    }
  }

  async function removeMember(wsId: string, userId: string) {
    if (!supabase) { setError('Veritabani baglantisi yok.'); return; }
    try {
      setBusyId(userId + wsId);
      setError(null);
      const { error: delErr } = await supabase
        .from('ggt_workspace_members')
        .delete()
        .eq('workspace_id', wsId)
        .eq('user_id', userId);
      if (delErr) throw delErr;
      setNotice('Uyelik silindi.');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Silme hatasi.');
    } finally {
      setBusyId(null);
    }
  }

  // Profil doğrulanmadan "yetkisiz" kararı verme — RequireAdmin zaten kapıda bekletiyor,
  // bu da çift güvence (sayfa tek başına render edilirse anasayfaya savrulmayı engeller).
  if (pl || !plLoaded) {
    return <div className="p-6 text-slate-600 dark:text-slate-300">Yetki kontrol ediliyor...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-red-200">
          <p className="font-semibold text-red-600">Yetkisiz alan</p>
          <p className="text-sm text-slate-500">Bu sayfayi gormek icin yonetici olmalisiniz.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Admin Paneli</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm"><p className="text-xs text-slate-500">Toplam</p><p className="text-xl font-bold">{stats.total}</p></div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm"><p className="text-xs text-slate-500">Aktif</p><p className="text-xl font-bold">{stats.active}</p></div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm"><p className="text-xs text-slate-500">Pasif</p><p className="text-xl font-bold">{stats.passive}</p></div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm"><p className="text-xs text-slate-500">Yonetici</p><p className="text-xl font-bold">{stats.admins}</p></div>
      </div>
      {error && <div className="bg-red-50 text-red-700 rounded-2xl p-3 text-sm">{error}</div>}
      {notice && <div className="bg-emerald-50 text-emerald-700 rounded-2xl p-3 text-sm">{notice}</div>}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm">
        <h2 className="font-semibold mb-3">Kullanicilar</h2>
        <div className="flex flex-col md:flex-row gap-2 mb-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="E-posta veya ad ara..." className="flex-1 rounded-xl border px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700" />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)} className="rounded-xl border px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700">
            <option value="all">Tumu</option>
            <option value="user">Aktif</option>
            <option value="passive">Pasif</option>
          </select>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.map((u) => {
            const self = profile && u.id === profile.id;
            return (
              <li key={u.id} className="py-2 flex flex-col md:flex-row md:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.email ?? '-'}
                    {(u.is_admin || u.role === 'admin') && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">ADMIN</span>}
                    {u.role === 'passive' && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">PASIF</span>}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{u.full_name ?? ''}</p>
                </div>
                {self ? <span className="text-xs text-slate-400">Bu sizsiniz</span> : (
                  <div className="flex flex-wrap gap-1">
                    {u.role === 'passive'
                      ? <button disabled={busyId === u.id} onClick={() => void updateUser(u, { role: 'user' }, 'Kullanici aktive edildi.')} className="text-xs px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">Aktive Et</button>
                      : <button disabled={busyId === u.id} onClick={() => void updateUser(u, { role: 'passive' }, 'Kullanici pasife alindi.')} className="text-xs px-2 py-1 rounded-lg bg-slate-200 text-slate-600">Pasife Al</button>}
                    <button disabled={busyId === u.id} onClick={() => void quickAdd(u)} className="text-xs px-2 py-1 rounded-lg bg-sky-100 text-sky-700">+ Uyeye Ekle</button>
                    {u.is_admin
                      ? <button disabled={busyId === u.id} onClick={() => void updateUser(u, { is_admin: false }, 'Adminlik alindi.')} className="text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-700">Adminligi Al</button>
                      : <button disabled={busyId === u.id} onClick={() => void updateUser(u, { is_admin: true }, 'Admin yapildi.')} className="text-xs px-2 py-1 rounded-lg bg-violet-100 text-violet-700">Admin Yap</button>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm">
        <h2 className="font-semibold mb-1">Uyelikler</h2>
        <p className="text-xs text-slate-400 mb-3">Kullanicilar listesindeki “+ Uyeye Ekle” ile kisi dogrudan sizin calisma alaniniza eklenir.</p>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {members.map((m) => (
            <li key={m.id} className="py-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{m.email ?? m.user_id}</p>
                <p className="text-xs text-slate-500 truncate">{m.workspace_id} - {m.role}</p>
              </div>
              <button disabled={busyId === m.user_id + m.workspace_id} onClick={() => void removeMember(m.workspace_id, m.user_id)} className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-700">Cikar</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


