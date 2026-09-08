import type { Category } from '../types';

/** "Diğer" kategorilerinin sabit id'leri (silinemez, fallback hedefi) */
export const OTHER_EXPENSE_ID = 'exp-other';
export const OTHER_INCOME_ID = 'inc-other';

export const DEFAULT_CATEGORIES: Category[] = [
  // Gider
  { id: 'exp-food', name: 'Yemek & İçecek', icon: '🍔', type: 'expense', color: '#f59e0b' },
  { id: 'exp-transport', name: 'Ulaşım', icon: '🚗', type: 'expense', color: '#3b82f6' },
  { id: 'exp-shopping', name: 'Alışveriş', icon: '🛍️', type: 'expense', color: '#ec4899' },
  { id: 'exp-fun', name: 'Eğlence', icon: '🎬', type: 'expense', color: '#8b5cf6' },
  { id: 'exp-health', name: 'Sağlık', icon: '🏥', type: 'expense', color: '#ef4444' },
  { id: 'exp-bills', name: 'Faturalar', icon: '💡', type: 'expense', color: '#eab308' },
  { id: 'exp-edu', name: 'Eğitim', icon: '📚', type: 'expense', color: '#14b8a6' },
  { id: OTHER_EXPENSE_ID, name: 'Diğer', icon: '✨', type: 'expense', color: '#64748b' },
  // Gelir
  { id: 'inc-salary', name: 'Maaş', icon: '💰', type: 'income', color: '#22c55e' },
  { id: 'inc-extra', name: 'Ek Gelir', icon: '💵', type: 'income', color: '#4ade80' },
  { id: 'inc-invest', name: 'Yatırım', icon: '📈', type: 'income', color: '#2dd4bf' },
  { id: 'inc-gift', name: 'Hediye', icon: '🎁', type: 'income', color: '#f472b6' },
  { id: OTHER_INCOME_ID, name: 'Diğer', icon: '✨', type: 'income', color: '#64748b' },
];

export function otherIdFor(type: Category['type']): string {
  return type === 'income' ? OTHER_INCOME_ID : OTHER_EXPENSE_ID;
}
