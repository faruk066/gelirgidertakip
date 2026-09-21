import { create } from 'zustand';
import { db } from './lib/db';
import { DEFAULT_CATEGORIES, OTHER_EXPENSE_ID, OTHER_INCOME_ID } from './lib/defaultCategories';
import { addTombstone, addTombstones, backgroundPush, getWorkspace, pullUserData, pushUserData, pushUserCategories, syncNow } from './lib/sync';
import type { Category, Settings, ThemeMode, Transaction, TransactionType } from './types';

const THEME_KEY = 'ggt-theme';
const CURRENCY_KEY = 'ggt-currency';

function loadSettings(): Settings {
  let theme: ThemeMode = 'dark';
  let currency = 'TRY';
  try {
    if (localStorage.getItem(THEME_KEY) === 'light') theme = 'light';
    currency = localStorage.getItem(CURRENCY_KEY) || 'TRY';
  } catch {
    /* yoksay */
  }
  return { theme, currency };
}

function applyTheme(theme: ThemeMode): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* yoksay */
  }
}

export interface NewTransaction {
  type: TransactionType;
  amount: number;
  categoryId: string;
  date: string;
  note?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'ready' | 'error';

export interface SyncState {
  status: SyncStatus;
  message: string;
  lastUserId: string | null;
}

interface Store {
  transactions: Transaction[];
  categories: Category[];
  settings: Settings;
  ready: boolean;
  syncState: SyncState;
  init: () => Promise<void>;
  /** Giriş yapan kullanıcının bulut verisini çek + ekrana yansıt */
  syncUserData: (userId: string) => Promise<void>;
  /** Çıkışta yerel kullanıcı verisini temizle (hesap karışmasın) */
  clearLocalData: () => Promise<void>;
  addTransaction: (input: NewTransaction) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<NewTransaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (input: { name: string; icon: string; type: TransactionType; color: string }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
  setCurrency: (currency: string) => void;
  importTransactions: (txs: Transaction[]) => Promise<void>;
  reload: () => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useStore = create<Store>()((set, get) => ({
  transactions: [],
  categories: [],
  settings: loadSettings(),
  ready: false,
  syncState: { status: 'idle', message: '', lastUserId: null },

  init: async () => {
    if (get().ready) return;
    const settings = get().settings;
    applyTheme(settings.theme);

    const existing = await db.categories.toArray();
    if (existing.length === 0) {
      const now = new Date().toISOString();
      await db.categories.bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ ...c, updatedAt: now })));
    }
    const [transactions, categories] = await Promise.all([
      db.transactions.orderBy('date').reverse().toArray(),
      db.categories.toArray(),
    ]);
    set({ transactions, categories, ready: true });

    // Bağlı senkron kodu varsa açılışta sessizce eşitle (çevrimiçiyse)
    if (getWorkspace()) {
      try {
        await syncNow();
        const [t2, c2] = await Promise.all([
          db.transactions.orderBy('date').reverse().toArray(),
          db.categories.toArray(),
        ]);
        set({ transactions: t2, categories: c2 });
      } catch {
        /* çevrimdışı ya da bulut hatası — yerel veriyle devam */
      }
    }
  },

  reload: async () => {
    const [transactions, categories] = await Promise.all([
      db.transactions.orderBy('date').reverse().toArray(),
      db.categories.toArray(),
    ]);
    set({ transactions, categories });
  },

  syncUserData: async (userId) => {
    const st = get().syncState;
    // Aynı kullanıcı için tekrar çekme (StrictMode çift effect koruması dahil)
    if (st.lastUserId === userId && (st.status === 'ready' || st.status === 'syncing')) return;
    set({ syncState: { status: 'syncing', message: 'Buluttaki verileriniz yükleniyor…', lastUserId: userId } });
    try {
      // Önce yereli temizle: önceki hesabın verisi yeni hesaba karışmasın!
      await db.transactions.clear();
      await db.categories.clear();
      set({ transactions: [], categories: [] });
      const { pulledTx, pulledCat } = await pullUserData();
      // Kategori onarımı: işlemin categoryId'si yerelde yoksa ad+tip ile eşleştir
      // (farklı cihazda aynı varsayılan kategori farklı id ile olabilir;
      //  eşleşmezse liste "Diğer" gösterir — ekran görüntüsündeki bug buydu)
      let categories = await db.categories.toArray();
      const byId = new Map(categories.map((c) => [c.id, c]));
      const byKey = new Map(categories.map((c) => [`${c.name}::${c.type}`, c]));
      const localTxs = await db.transactions.toArray();
      let fixed = 0;
      for (const t of localTxs) {
        if (byId.has(t.categoryId)) continue;
        const fallback = DEFAULT_CATEGORIES.find((c) => c.id === t.categoryId);
        if (!fallback) continue;
        const match = byKey.get(`${fallback.name}::${fallback.type}`);
        if (match) {
          await db.transactions.update(t.id, { categoryId: match.id });
          fixed++;
        } else {
          const now2 = new Date().toISOString();
          await db.categories.put({ ...fallback, updatedAt: now2 });
          const fresh = { ...fallback, updatedAt: now2 };
          byId.set(fresh.id, fresh);
          byKey.set(`${fresh.name}::${fresh.type}`, fresh);
          fixed++;
        }
      }
      if (fixed > 0) {
        categories = await db.categories.toArray();
        try { await pushUserCategories(); } catch { /* yoksay */ }
      }
      // Yeni kullanıcı: bulutta kategori yoksa varsayılanları kur (bulkPut: çakışma güvenli)
      if (categories.length === 0) {
        const now = new Date().toISOString();
        await db.categories.bulkPut(DEFAULT_CATEGORIES.map((c) => ({ ...c, updatedAt: now })));
        categories = await db.categories.toArray();
      }
      // Sadece gerçekten çekilen veri varsa buluta yaz; boşken push = başkasının verisini ezme!
      if (pulledTx > 0 || pulledCat > 0) {
        try {
          await pushUserData();
        } catch {
          /* push hatası veri çekmeyi engellemesin */
        }
      // Yeni/boş kullanıcı: SADECE kategorileri kendi workspace'ine yaz (işlem push'u yok).
      } else {
        try {
          await pushUserCategories();
        } catch {
          /* yoksay */
        }
      }
      const transactions = await db.transactions.orderBy('date').reverse().toArray();
      set({
        transactions,
        categories,
        syncState: { status: 'ready', message: '', lastUserId: userId },
      });
    } catch (e) {
      set({
        syncState: {
          status: 'error',
          message: e instanceof Error ? e.message : 'Bulut verisi alınamadı.',
          lastUserId: null,
        },
      });
    }
  },

  clearLocalData: async () => {
    await db.transactions.clear();
    await db.categories.clear();
    const now = new Date().toISOString();
    await db.categories.bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ ...c, updatedAt: now })));
    const categories = await db.categories.toArray();
    set({ transactions: [], categories, syncState: { status: 'idle', message: '', lastUserId: null } });
  },

  addTransaction: async (input) => {
    const now = new Date().toISOString();
    const tx: Transaction = {
      id: crypto.randomUUID(),
      ...input,
      note: input.note?.trim() ? input.note.trim() : undefined,
      createdAt: now,
      updatedAt: now,
    };
    await db.transactions.add(tx);
    set({ transactions: [tx, ...get().transactions] });
    backgroundPush();
  },

  updateTransaction: async (id, patch) => {
    const note = patch.note !== undefined ? (patch.note.trim() ? patch.note.trim() : undefined) : undefined;
    const changes = { ...patch, ...(patch.note !== undefined ? { note } : {}), updatedAt: new Date().toISOString() };
    await db.transactions.update(id, changes);
    set({
      transactions: get().transactions.map((t) => (t.id === id ? { ...t, ...changes } : t)),
    });
    backgroundPush();
  },

  deleteTransaction: async (id) => {
    await db.transactions.delete(id);
    addTombstone('transactions', id);
    set({ transactions: get().transactions.filter((t) => t.id !== id) });
    backgroundPush();
  },

  addCategory: async (input) => {
    const cat: Category = { id: crypto.randomUUID(), ...input, name: input.name.trim(), updatedAt: new Date().toISOString() };
    await db.categories.add(cat);
    set({ categories: [...get().categories, cat] });
    backgroundPush();
  },

  deleteCategory: async (id) => {
    // "Diğer" kategorileri silinemez (fallback hedefi)
    if (id === OTHER_EXPENSE_ID || id === OTHER_INCOME_ID) return;
    const cat = get().categories.find((c) => c.id === id);
    if (!cat) return;
    const fallbackId = cat.type === 'income' ? OTHER_INCOME_ID : OTHER_EXPENSE_ID;
    const affected = get().transactions.filter((t) => t.categoryId === id);
    await db.transaction('rw', db.transactions, db.categories, async () => {
      for (const t of affected) {
        await db.transactions.update(t.id, { categoryId: fallbackId, updatedAt: new Date().toISOString() });
      }
      await db.categories.delete(id);
    });
    set({
      transactions: get().transactions.map((t) =>
        t.categoryId === id ? { ...t, categoryId: fallbackId } : t,
      ),
      categories: get().categories.filter((c) => c.id !== id),
    });
    addTombstone('categories', id);
    backgroundPush();
  },

  setTheme: (theme) => {
    applyTheme(theme);
    set({ settings: { ...get().settings, theme } });
  },

  setCurrency: (currency) => {
    try {
      localStorage.setItem(CURRENCY_KEY, currency);
    } catch {
      /* yoksay */
    }
    set({ settings: { ...get().settings, currency } });
  },

  clearAll: async () => {
    const ids = get().transactions.map((t) => t.id);
    await db.transactions.clear();
    addTombstones('transactions', ids);
    set({ transactions: [] });
    backgroundPush();
  },

  importTransactions: async (txs) => {
    if (txs.length === 0) return;
    await db.transactions.bulkAdd(txs);
    const transactions = await db.transactions.orderBy('date').reverse().toArray();
    set({ transactions });
    backgroundPush();
  },
}));
