// Gerçek eski-format CSV ile içe aktarma testi (tsx ile çalıştırılır)
import { readFileSync } from 'node:fs';
import { parseCSVText, previewToTransactions } from '../src/lib/csv';
import { DEFAULT_CATEGORIES } from '../src/lib/defaultCategories';

const path = 'C:/Users/UnknownBoy/Downloads/Telegram Desktop/gider-takip-2026-09-08.csv';
const text = readFileSync(path, 'utf-8');

const { rows, fileError } = await parseCSVText(text);
if (fileError) {
  console.error('FILE ERROR:', fileError);
  process.exit(1);
}
const valid = rows.filter((r) => r.valid);
const invalid = rows.filter((r) => !r.valid);
console.log(`toplam=${rows.length} geçerli=${valid.length} geçersiz=${invalid.length}`);
for (const r of invalid.slice(0, 5)) console.log('  HATA:', r.error, JSON.stringify({ t: r.type, a: r.amount, d: r.date }));

const txs = previewToTransactions(rows, DEFAULT_CATEGORIES);
const cats = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c.name]));
const dist = new Map<string, number>();
for (const t of txs) dist.set(cats.get(t.categoryId) ?? t.categoryId, (dist.get(cats.get(t.categoryId) ?? t.categoryId) ?? 0) + 1);
console.log('kategori dağılımı:', JSON.stringify([...dist]));
console.log('örnek:', JSON.stringify(txs[0]));
console.log('tarih aralığı:', txs.reduce((a, t) => (t.date < a ? t.date : a), '9999'), '→', txs.reduce((a, t) => (t.date > a ? t.date : a), '0000'));

if (valid.length < 250 || txs.length !== valid.length) {
  console.error('TEST BAŞARISIZ');
  process.exit(1);
}
console.log('TEST GEÇTİ');
