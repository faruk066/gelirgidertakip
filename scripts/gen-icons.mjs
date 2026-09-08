// PWA ikonları üretir: koyu zeminde zümrüt "coin" + ₺ çizgisi. (Bağımlılıksız: ham PNG yazıcı)
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const BG = hex('#0f172a');
const COIN = hex('#10b981');
const MARK = hex('#ffffff');

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const coinR = size * 0.34;
  const ringR = size * 0.27;
  const barT = size * 0.028; // çizgi kalınlığı
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy(x, size);
      const d = Math.sqrt(dx * dx + dy * dy);
      let col = BG;
      if (d <= coinR) {
        col = COIN;
        // iç halka (koyu) — coin konturu
        if (Math.abs(d - ringR) < barT * 0.8) col = BG;
        // ₺ işareti: dikey gövde + üstte çift yatay çizgi
        const inStem = Math.abs(x - cx) < barT * 0.9 && y > cy(x, size) - ringR * 0.95 && y < cy(x, size) + ringR * 0.95;
        const barY1 = cy(x, size) - ringR * 0.62;
        const barY2 = cy(x, size) - ringR * 0.34;
        const inBar =
          y > barY1 - barT && y < barY1 + barT && x > cx - ringR * 1.05 && x < cx + ringR * 1.05;
        const inBar2 =
          y > barY2 - barT && y < barY2 + barT && x > cx - ringR * 1.05 && x < cx + ringR * 1.05;
        if (d < ringR - barT && (inStem || inBar || inBar2)) col = MARK;
      }
      const o = (y * size + x) * 4;
      px[o] = col[0];
      px[o + 1] = col[1];
      px[o + 2] = col[2];
      px[o + 3] = 255;
    }
  }
  function cy(_x, s) {
    return s / 2;
  }
  const raw = Buffer.alloc(px.length + size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

for (const s of [192, 512]) {
  const p = join(outDir, `icon-${s}.png`);
  writeFileSync(p, makeIcon(s));
  console.log('ok', p, createHash('sha256').update(makeIcon(s)).digest('hex').slice(0, 8));
}
