import { create } from 'zustand';
import { db } from './lib/db';
import { DEFAULT_CATEGORIES, OTHER_EXPENSE_ID, OTHER_INCOME_ID } from './lib/defaultCategories';
import { addTombstone, addTombstones, backgroundPush, getWorkspace, syncNow } from './lib/sync';
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

interface Store {
  transactions: Transaction[];
  categories: Category[];
  settings: Settings;
  ready: boolean;
  init: () => Promise<void>;
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
