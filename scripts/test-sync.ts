// Supabase canlı bağlantı + senkron testi (tsx ile çalıştırılır)
// Önce supabase/migration-001.sql Supabase SQL Editor'da çalıştırılmalı.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnv('C:/Users/UnknownBoy/Desktop/projelerim/gelirgidertakip/.env');
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
const WS = 'GGT-TEST01';
const TX = 'test-tx-001';
const CAT = 'test-cat-001';

const fail = (msg: string) => {
  console.error('TEST BAŞARISIZ:', msg);
  process.exit(1);
};

// temizlik (önceki kalıntı)
await sb.from('ggt_transactions').delete().eq('workspace', WS).eq('id', TX);
await sb.from('ggt_categories').delete().eq('workspace', WS).eq('id', CAT);

// yaz
const { error: e1 } = await sb.from('ggt_categories').upsert({
  id: CAT, workspace: WS, name: 'Test', icon: '🧪', type: 'expense', color: '#ff0000',
});
if (e1) fail(`kategori yazılamadı: ${e1.message} (migration çalıştı mı?)`);
const { error: e2 } = await sb.from('ggt_transactions').upsert({
  id: TX, workspace: WS, type: 'expense', amount: 123.45,
  category_id: CAT, date: '2026-09-08', note: 'senkron testi',
});
if (e2) fail(`işlem yazılamadı: ${e2.message}`);

// oku
const { data: txs, error: e3 } = await sb.from('ggt_transactions').select().eq('workspace', WS);
if (e3) fail(`okunamadı: ${e3.message}`);
const row = (txs ?? []).find((r) => r.id === TX) as { amount: number | string } | undefined;
if (!row || Number(row.amount) !== 123.45) fail('yazılan kayıt geri okunamadı');
console.log('yaz/oku tamam, amount =', row.amount);

// sil
await sb.from('ggt_transactions').delete().eq('workspace', WS).eq('id', TX);
await sb.from('ggt_categories').delete().eq('workspace', WS).eq('id', CAT);
const { data: left } = await sb.from('ggt_transactions').select('id').eq('workspace', WS).eq('id', TX);
if ((left ?? []).length > 0) fail('silme çalışmadı');
console.log('silme tamam');
console.log('SYNC TESTİ GEÇTİ');
