import { db } from './db';
import { supabase } from './supabase';
import type { Category, Transaction } from '../types';

const WS_KEY = 'ggt-workspace';
const LAST_SYNC_KEY = 'ggt-last-sync';
const TOMBSTONE_KEY = 'ggt-deleted';
/** Giriş yapan kullanıcının bulut workspace kimliği (auth tabanlı senkron) */
const WS_ID_KEY = 'ggt-workspace-id';

/* ---------- Senkron kodu (workspace) ---------- */

export function getWorkspace(): string | null {
  try {
    return localStorage.getItem(WS_KEY);
  } catch {
    return null;
  }
}

export function setWorkspace(code: string | null): void {
  try {
    if (code) localStorage.setItem(WS_KEY, code.trim().toLocaleUpperCase('tr-TR'));
    else {
      localStorage.removeItem(WS_KEY);
      localStorage.removeItem(LAST_SYNC_KEY);
    }
  } catch {
    /* yoksay */
  }
}

/** Tahmin edilemez senkron kodu, örn: GGT-7KQ2XA */
export function newWorkspaceCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const buf = new Uint32Array(6);
  crypto.getRandomValues(buf);
  for (const n of buf) s += chars[n % chars.length];
  return `GGT-${s}`;
}

export function getLastSync(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

function setLastSync(): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch {
    /* yoksay */
  }
}

/* ---------- Silme mezarlığı (tombstone) ----------
 * Yerelde silinen kayıtların buluta da silinmesi ve başka cihazdan
 * geri dirilmemesi için tutulur. Başarılı push sonrası temizlenir. */

interface Tombstones {
  transactions: Record<string, string>;
  categories: Record<string, string>;
}

function getTombstones(): Tombstones {
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Tombstones>;
      return { transactions: p.transactions ?? {}, categories: p.categories ?? {} };
    }
  } catch {
    /* yoksay */
  }
  return { transactions: {}, categories: {} };
}

function saveTombstones(t: Tombstones): void {
  try {
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(t));
  } catch {
    /* yoksay */
  }
}

export function addTombstone(kind: 'transactions' | 'categories', id: string): void {
  const t = getTombstones();
  t[kind][id] = new Date().toISOString();
  saveTombstones(t);
}

export function addTombstones(kind: 'transactions' | 'categories', ids: string[]): void {
  if (ids.length === 0) return;
  const t = getTombstones();
  const now = new Date().toISOString();
  for (const id of ids) t[kind][id] = now;
  saveTombstones(t);
}

/* ---------- Dönüşümler ---------- */

function newer(a: string | undefined, b: string | undefined): boolean {
  const ta = a ? Date.parse(a) : 0;
  const tb = b ? Date.parse(b) : 0;
  return ta > tb;
}

export interface RemoteTx {
  id: string;
  workspace: string;
  workspace_id: string | null;
  type: 'income' | 'expense';
  amount: number | string;
  category_id: string;
  date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface RemoteCat {
  id: string;
  workspace: string;
  workspace_id: string | null;
  name: string;
  icon: string;
  type: 'income' | 'expense';
  color: string;
  updated_at: string;
}

function remoteToTx(r: RemoteTx): Transaction {
  return {
    id: r.id,
    type: r.type,
    amount: Number(r.amount),
    categoryId: r.category_id,
    date: r.date,
    note: r.note ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function remoteToCat(r: RemoteCat): Category {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    type: r.type,
    color: r.color,
    updatedAt: r.updated_at,
  };
}

/* ---------- Senkron ---------- */

export interface SyncStats {
  pushedTx: number;
  pushedCat: number;
  pulledTx: number;
  pulledCat: number;
  deletedRemote: number;
}

function requireClient() {
  if (!supabase) throw new Error('Supabase yapılandırılmamış (.env eksik).');
  const ws = getWorkspace();
  if (!ws) throw new Error('Önce bir senkron kodu oluşturun ya da katılın.');
  return { client: supabase, ws };
}

/** Buluttan çek + yerelle birleştir (kayıt bazında last-write-wins) */
export async function pullAll(): Promise<{ pulledTx: number; pulledCat: number }> {
  const { client, ws } = requireClient();
  const tombs = getTombstones();
  let pulledTx = 0;
  let pulledCat = 0;

  const { data: rtx, error: e1 } = await client.from('ggt_transactions').select().eq('workspace', ws);
  if (e1) throw new Error(`Buluttan okunamadı: ${e1.message}`);
  for (const r of (rtx ?? []) as RemoteTx[]) {
    const tombTs = tombs.transactions[r.id];
    if (tombTs && !newer(r.updated_at, tombTs)) continue; // yerelde daha yeni silinmiş
    const local = await db.transactions.get(r.id);
    if (!local || newer(r.updated_at, local.updatedAt)) {
      await db.transactions.put(remoteToTx(r));
      pulledTx++;
    }
  }

  const { data: rcat, error: e2 } = await client.from('ggt_categories').select().eq('workspace', ws);
  if (e2) throw new Error(`Buluttan okunamadı: ${e2.message}`);
  for (const r of (rcat ?? []) as RemoteCat[]) {
    const tombTs = tombs.categories[r.id];
    if (tombTs && !newer(r.updated_at, tombTs)) continue;
    const local = await db.categories.get(r.id);
    if (!local || newer(r.updated_at, local.updatedAt)) {
      await db.categories.put(remoteToCat(r));
      pulledCat++;
    }
  }
  return { pulledTx, pulledCat };
}

/** Yereli buluta gönder + silinenleri buluttan kaldır */
export async function pushAll(): Promise<{ pushedTx: number; pushedCat: number; deletedRemote: number }> {
  const { client, ws } = requireClient();
  const tombs = getTombstones();
  let deletedRemote = 0;

  const txs = await db.transactions.toArray();
  if (txs.length > 0) {
    const { error } = await client.from('ggt_transactions').upsert(
      txs.map((t) => ({
        id: t.id,
        workspace: ws,
        type: t.type,
        amount: t.amount,
        category_id: t.categoryId,
        date: t.date,
        note: t.note ?? null,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
      })),
      { onConflict: 'id' },
    );
    if (error) throw new Error(`Buluta yazılamadı: ${error.message}`);
  }

  const cats = await db.categories.toArray();
  if (cats.length > 0) {
    const { error } = await client.from('ggt_categories').upsert(
      cats.map((c) => ({
        id: c.id,
        workspace: ws,
        name: c.name,
        icon: c.icon,
        type: c.type,
        color: c.color,
        updated_at: c.updatedAt ?? new Date().toISOString(),
      })),
      { onConflict: 'id' },
    );
    if (error) throw new Error(`Buluta yazılamadı: ${error.message}`);
  }

  // Mezarlıktakileri buluttan sil, başarılıları temizle
  for (const id of Object.keys(tombs.transactions)) {
    const { error } = await client.from('ggt_transactions').delete().eq('workspace', ws).eq('id', id);
    if (!error) {
      delete tombs.transactions[id];
      deletedRemote++;
    }
  }
  for (const id of Object.keys(tombs.categories)) {
    const { error } = await client.from('ggt_categories').delete().eq('workspace', ws).eq('id', id);
    if (!error) {
      delete tombs.categories[id];
      deletedRemote++;
    }
  }
  saveTombstones(tombs);

  return { pushedTx: txs.length, pushedCat: cats.length, deletedRemote };
}

/** Tam senkron: çek → gönder. Hata mesajı Türkçe fırlatır. */
export async function syncNow(): Promise<SyncStats> {
  const pulled = await pullAll();
  const pushed = await pushAll();
  setLastSync();
  return { ...pushed, ...pulled };
}

/* ---------- Kullanıcı bazlı bulut (auth) ---------- *
 * Giriş yapan her kullanıcı kendi workspace'ine bağlanır ve girişten
 * hemen sonra veritabanındaki kendi verilerini (işlem + kategori) çeker. */

export function getUserWorkspaceId(): string | null {
  try {
    return localStorage.getItem(WS_ID_KEY);
  } catch {
    return null;
  }
}

function saveUserWorkspaceId(id: string): void {
  try {
    localStorage.setItem(WS_ID_KEY, id);
  } catch {
    /* yoksay */
  }
}

async function requireUser() {
  if (!supabase) throw new Error('Supabase yapılandırılmamış (.env eksik).');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Oturum bulunamadı, tekrar giriş yapın.');
  return { client: supabase, user };
}

/** Kullanıcının KENDİ workspace'ini bulur; yoksa ilk girişte oluşturur. UUID döner.
 *  ÖNEMLİ: Sahiplik (owner_id) esastır — üye olunan başkasının workspace'i
 *  asla veri kaynağı yapılmaz; yoksa yeni üye admin verilerini görür (sızıntı). */
export async function ensureUserWorkspace(): Promise<string> {
  const { client, user } = await requireUser();
  // 1) Kayıtlı workspace kimliği varsa önce onu doğrula (hızlı yol, sorgusuz)
  const cached = getUserWorkspaceId();
  if (cached) {
    const { data: ok } = await client
      .from('ggt_workspaces')
      .select('id')
      .eq('id', cached)
      .eq('owner_id', user.id)
      .limit(1);
    if ((ok ?? []).length > 0) return cached;
    // Önbellek başkasının/bozuk — devam edip gerçeğini bul
  }
  const { data: owned } = await client
    .from('ggt_workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1);
  const own = (owned ?? [])[0] as { id: string } | undefined;
  if (own?.id) {
    // Üyelik var mı önce bak — yoksa ekle (kör insert 23505 logu üretmesin)
    const { data: has } = await client
      .from('ggt_workspace_members')
      .select('id')
      .eq('workspace_id', own.id)
      .eq('user_id', user.id)
      .limit(1);
    if (!has || has.length === 0) {
      await client
        .from('ggt_workspace_members')
        .insert({ workspace_id: own.id, user_id: user.id, role: 'owner' })
        .then(() => undefined, () => undefined);
    }
    saveUserWorkspaceId(own.id);
    return own.id;
  }

  const { data: created, error: cErr } = await client
    .from('ggt_workspaces')
    .insert({ owner_id: user.id, name: 'Varsayılan' })
    .select('id')
    .single();
  if (cErr || !created) throw new Error(`Çalışma alanı açılamadı: ${cErr?.message ?? 'bilinmeyen hata'}`);
  const wsId = (created as { id: string }).id;
  // NOT: owner üyeliği DB trigger/policy ile açılıyorsa ayrıca insert yok —
  // kör insert migration-006 unique'ine takılıp 23505 logu üretiyordu.
  saveUserWorkspaceId(wsId);
  return wsId;
}

/** Buluttaki kullanıcı verisini çekip yerelle birleştir (kayıt bazında son yazan kazanır).
 *  SADECE üyesi olunan workspace çekilir — workspace_id'siz (NULL) eski satırlar
 *  çekilmez; yoksa yeni kullanıcılar başkasının verisini görür (sızıntı). */
export async function pullUserData(): Promise<{ pulledTx: number; pulledCat: number }> {
  const { client } = await requireUser();
  const wsId = await ensureUserWorkspace();
  let pulledTx = 0;
  let pulledCat = 0;

  const { data: rtx, error: e1 } = await client
    .from('ggt_transactions')
    .select()
    .eq('workspace_id', wsId);
  if (e1) throw new Error(`Buluttan okunamadı: ${e1.message}`);
  for (const r of (rtx ?? []) as RemoteTx[]) {
    const local = await db.transactions.get(r.id);
    if (!local || newer(r.updated_at, local.updatedAt)) {
      await db.transactions.put(remoteToTx(r));
      pulledTx++;
    }
  }

  const { data: rcat, error: e2 } = await client
    .from('ggt_categories')
    .select()
    .eq('workspace_id', wsId);
  if (e2) throw new Error(`Buluttan okunamadı: ${e2.message}`);
  for (const r of (rcat ?? []) as RemoteCat[]) {
    const local = await db.categories.get(r.id);
    if (!local || newer(r.updated_at, local.updatedAt)) {
      await db.categories.put(remoteToCat(r));
      pulledCat++;
    }
  }
  return { pulledTx, pulledCat };
}

/** Yerel veriyi kullanıcının bulut workspace'ine gönder.
 *  Kategori kısmı toplu-diff ile, işlemler de aynı mantıkla:
 *  önce buluttaki id'ler öğrenilir, sadece eksik/yeni olanlar yazılır.
 *  Sebep: kör update+insert döngüsü RLS USING'e takılıyordu. */
export async function pushUserData(): Promise<void> {
  const { client, user } = await requireUser();
  const wsId = await ensureUserWorkspace();

  const txs = await db.transactions.toArray();
  if (txs.length > 0) {
    const { data: existingTx } = await client
      .from('ggt_transactions')
      .select('id, updated_at')
      .eq('workspace_id', wsId);
    const remoteTx = new Map(
      ((existingTx ?? []) as { id: string; updated_at: string }[]).map((r) => [r.id, r.updated_at]),
    );
    const newTx = txs.filter((t) => !remoteTx.has(t.id));
    if (newTx.length > 0) {
      const { error: iErr } = await client.from('ggt_transactions').insert(
        newTx.map((t) => ({
          id: t.id,
          workspace: `user:${user.id}`,
          workspace_id: wsId,
          type: t.type,
          amount: t.amount,
          category_id: t.categoryId,
          date: t.date,
          note: t.note ?? null,
          created_at: t.createdAt,
          updated_at: t.updatedAt,
        })),
      );
      if (iErr && !/duplicate|conflict|already|unique|409/i.test(iErr.message)) {
        throw new Error(`Buluta yazılamadı: ${iErr.message}`);
      }
    }
    for (const t of txs) {
      const rTs = remoteTx.get(t.id);
      if (!rTs || Date.parse(t.updatedAt) <= Date.parse(rTs)) continue;
      const { error: uErr } = await client
        .from('ggt_transactions')
        .update({
          workspace: `user:${user.id}`,
          workspace_id: wsId,
          type: t.type,
          amount: t.amount,
          category_id: t.categoryId,
          date: t.date,
          note: t.note ?? null,
          updated_at: t.updatedAt,
        })
        .eq('id', t.id)
        .eq('workspace_id', wsId);
      if (uErr) throw new Error(`Buluta yazılamadı: ${uErr.message}`);
    }
  }

  await pushUserCategories();
}

/** SADECE kategorileri kullanıcının kendi workspace'ine yazar (işlemlere dokunmaz).
 *  Döngüsel update denemesi YOK — doğrudan insert, 409/duplicate ise atlanır.
 *  Sebep: update+insert döngüsü RLS USING + unique çakışmalarında senkronu
 *  kilitliyordu (konsoldaki ggt_categories 409 + takılan "Senkronize ediliyor"). */
export async function pushUserCategories(): Promise<void> {
  const { client, user } = await requireUser();
  const wsId = getUserWorkspaceId() ?? (await ensureUserWorkspace());
  const cats = await db.categories.toArray();
  if (cats.length === 0) return;

  // Bulutta bu workspace'te hangi id'ler var? Tek sorguda öğren.
  const { data: existing } = await client
    .from('ggt_categories')
    .select('id, updated_at')
    .eq('workspace_id', wsId);
  const remote = new Map(((existing ?? []) as { id: string; updated_at: string }[]).map((r) => [r.id, r.updated_at]));

  const toInsert = cats
    .filter((c) => !remote.has(c.id))
    .map((c) => ({
      id: c.id,
      workspace: `user:${user.id}`,
      workspace_id: wsId,
      name: c.name,
      icon: c.icon,
      type: c.type,
      color: c.color,
      updated_at: c.updatedAt ?? new Date().toISOString(),
    }));
  if (toInsert.length > 0) {
    const { error: iErr } = await client.from('ggt_categories').insert(toInsert);
    // 409/duplicate: başka cihaz aynı anda eklemiş — kritik değil, yut
    if (iErr && !/duplicate|conflict|already|unique|409/i.test(iErr.message)) {
      throw new Error(`Buluta yazılamadı: ${iErr.message}`);
    }
  }

  // Sadece buluttakinden YENİ olan yereller güncellenir (last-write-wins)
  for (const c of cats) {
    const rTs = remote.get(c.id);
    if (!rTs) continue;
    const lTs = c.updatedAt ?? '';
    if (Date.parse(lTs) > Date.parse(rTs)) {
      const { error: uErr } = await client
        .from('ggt_categories')
        .update({
          workspace: `user:${user.id}`,
          workspace_id: wsId,
          name: c.name,
          icon: c.icon,
          type: c.type,
          color: c.color,
          updated_at: lTs,
        })
        .eq('id', c.id)
        .eq('workspace_id', wsId);
      if (uErr) throw new Error(`Buluta yazılamadı: ${uErr.message}`);
    }
  }
}

/** Değişiklik sonrası otomatik bulut gönderimi.
 *  Eski "senkron kodu" kontrolü kaldırıldı — giriş yapan hesabın kendi
 *  workspace'ine (update-yoksa-insert) sessizce yazar. Hata yutulur;
 *  manuel senkron ekranında görünür. */
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushRunning = false;

async function runAutoPush(): Promise<void> {
  if (pushRunning) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  pushRunning = true;
  try {
    await pushUserData();
  } catch {
    /* sessiz: manuel senkron ekranında hata görünür */
  } finally {
    pushRunning = false;
  }
}

/** Her yazma işleminden sonra çağrılır — 800ms debounce ile toplu gönderir. */
export function backgroundPush(): void {
  try {
    if (!supabase) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      void runAutoPush();
    }, 800);
  } catch {
    /* yoksay */
  }
}
