export interface CurrencyOption {
  code: string;
  label: string;
}

/** Genişletilebilir para birimi listesi (varsayılan TRY) */
export const CURRENCIES: CurrencyOption[] = [
  { code: 'TRY', label: '₺ Türk Lirası (TRY)' },
  { code: 'USD', label: '$ ABD Doları (USD)' },
  { code: 'EUR', label: '€ Euro (EUR)' },
  { code: 'GBP', label: '£ Sterlin (GBP)' },
];

/** Tutarlı Türkçe para formatı, örn: ₺1.234,56 */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString('tr-TR')} ${currency}`;
  }
}
