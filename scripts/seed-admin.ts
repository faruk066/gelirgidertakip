// Admin kullanıcısını yaratır — profiles.role='admin' atar.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

function loadEnv(p: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of readFileSync(p, 'utf-8').split('\n')) {
    const m = l.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnv('C:\\Users\\UnknownBoy\\Desktop\\projelerim\\gelirgidertakip\\.env');
const url = env.VITE_SUPABASE_URL || '';
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_hnsoC6H03cjMGvyYRhHIOA_bysSEyyc';

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

const ADMIN_EMAIL = 'faruk66@gmail.com';
const ADMIN_PASS = 'Admin123!';

// admin zaten varsa kontrol et
const { data: existing, error: findErr } = await sb
  .from('profiles')
  .select('id,email,role')
  .eq('email', ADMIN_EMAIL)
  .maybeSingle();

if (existing && existing.role === 'admin') {
  console.log('admin zaten var, guncellenmedi:', existing.id);
  console.log('Giris:', ADMIN_EMAIL, '/', ADMIN_PASS);
  process.exit(0);
}

// yoksa auth.users.insert (anon keyle signUp çalışır)
const { data: suData, error: suErr } = await sb.auth.signUp({
  email: ADMIN_EMAIL,
  password: ADMIN_PASS,
  options: { data: { full_name: 'Faruk (admin)' } },
});

if (suErr || !suData.user?.id) {
  console.error('SIGNUP HATASI:', suErr?.message);
  process.exit(1);
}

const uid = suData.user.id;
console.log('kullanici yaratildi uid:', uid);

// profiles tablosuna — FK yoksa doğrudan ekle; varsa auth.users.id'ye referansla çalışır
const { error: profileErr } = await sb.from('profiles').upsert({
  id: uid,
  email: ADMIN_EMAIL,
  full_name: 'Faruk (admin)',
  role: 'admin',
});

if (profileErr)
  console.error('PROFILE HATASI:', profileErr.message);
else
  console.log('admin rolü atandi:', ADMIN_EMAIL, 'uid:', uid);

console.log('ADMIN KULLANICI TAMAM');
console.log(`Giris: ${ADMIN_EMAIL} / ${ADMIN_PASS}`);
