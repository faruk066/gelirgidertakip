export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  /** ISO 8601 tarih (YYYY-MM-DD) */
  date: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  /** emoji ikon */
  icon: string;
  type: TransactionType;
  /** hex renk */
  color: string;
}

export type ThemeMode = 'dark' | 'light';

export interface Settings {
  theme: ThemeMode;
  currency: string;
}
