import Dexie, { type EntityTable } from 'dexie';
import type { Category, Transaction } from '../types';

export const db = new Dexie('ggt-db') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>;
  categories: EntityTable<Category, 'id'>;
};

db.version(1).stores({
  transactions: 'id, type, categoryId, date',
  categories: 'id, type',
});
