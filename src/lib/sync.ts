import { db } from './db';
import { supabase } from './supabase';
import type { Category, Transaction } from '../types';

const WS_KEY = 'ggt-workspace';
const LAST_SYNC_KEY = 'ggt-last-sync';
const TOMBSTONE_KEY = 'ggt-deleted';

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

interface RemoteTx {
  id: string;
  workspace: string;
  type: 'income' | 'expense';
  amount: number | string;
  category_id: string;
  date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface RemoteCat {
  id: string;
  workspace: string;
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

/** Değişiklik sonrası sessiz arka plan gönderimi (hata yutulur) */
export function backgroundPush(): void {
  try {
    if (!getWorkspace() || !supabase) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    pushAll().catch(() => undefined);
  } catch {
    /* yoksay */
  }
}
