// preview.js — render icons to a PNG contact sheet (no external deps, no Inkscape).
// Usage:
//   node tools/preview.js out.png 8 6 all            # all icons, 8 cols, scale 6
//   node tools/preview.js out.png 4 10 axe hammer    # named icons, big
import { writeFileSync } from 'node:fs';
import zlib from 'node:zlib';
import { draw, SIZE } from './pcanvas.js';
import { PART1 } from './pixel_art_1.js';
import { PART2 } from './pixel_art_2.js';
import { PART3 } from './pixel_art_3.js';

const PAL = {
  k: '#1a1c2c', p: '#5d275d', r: '#b13e53', o: '#ef7d57', y: '#ffcd75',
  g: '#a7f070', G: '#38b764', t: '#257179', b: '#3b5dc9', B: '#41a6f6',
  c: '#73eff7', w: '#f4f4f4', x: '#94b0c2', s: '#566c86', d: '#333c57', n: '#29366f',
};
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// 3x5 bitmap font for labels
const FONT = {
  a:'010101111101101',b:'110101110101110',c:'011100100100011',d:'110101101101110',e:'111100110100111',
  f:'111100110100100',g:'011100101101011',h:'101101111101101',i:'111010010010111',j:'001001001101010',
  k:'101101110101101',l:'100100100100111',m:'101111111101101',n:'110101101101101',o:'010101101101010',
  p:'110101110100100',q:'010101101111011',r:'110101110101101',s:'011100010001110',t:'111010010010010',
  u:'101101101101011',v:'101101101010010',w:'101101111111101',x:'101101010101101',y:'101101011001110',
  z:'111001010100111','_':'000000000000111','0':'111101101101111','1':'010110010010111','2':'110001010100111',
  '3':'110001010001110','4':'101101111001001','5':'111100110001110','6':'011100110101010','7':'111001010010010',
  '8':'010101010101010','9':'010101011001110',' ':'000000000000000','.':'000000000000010','-':'000000111000000',
};

export function png(w, h, buf) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    buf.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const crcT = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function renderSheet(names, file, cols = 8, scale = 6, defs = null) {
  const src = defs || { ...PART1, ...PART2, ...PART3 };
  const pad = 6, label = 12;
  const cw = SIZE * scale + pad * 2, ch = SIZE * scale + pad * 2 + label;
  const rows = Math.ceil(names.length / cols);
  const W = cols * cw, H = rows * ch;
  const buf = Buffer.alloc(W * H * 3);
  const set = (x, y, [r, g, b]) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; };
  // background: alternating cells so edges are visible
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const cx = Math.floor(x / cw), cy = Math.floor(y / ch);
    set(x, y, (cx + cy) % 2 ? [214, 218, 226] : [232, 235, 240]);
  }
  names.forEach((name, i) => {
    const ox = (i % cols) * cw + pad, oy = Math.floor(i / cols) * ch + pad;
    const val = src[name];
    if (!val) { for (let d = 0; d < SIZE * scale; d++) set(ox + d, oy + d, [200, 40, 40]); return; }
    const grid = typeof val === 'function' ? draw(val) : val;
    grid.forEach((row, gy) => { for (let gx = 0; gx < SIZE; gx++) {
      const c = row[gx]; if (c === '.') continue;
      const col = rgb(PAL[c]);
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) set(ox + gx * scale + sx, oy + gy * scale + sy, col);
    } });
    // label
    let lx = ox, ly = oy + SIZE * scale + 3;
    for (const chr of name.slice(0, Math.floor((cw - 4) / 4))) {
      const bits = FONT[chr] || FONT[' '];
      for (let by = 0; by < 5; by++) for (let bx = 0; bx < 3; bx++) if (bits[by * 3 + bx] === '1')
        for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) set(lx + bx * 2 + sx, ly + by * 2 + sy, [30, 32, 44]);
      lx += 8;
    }
  });
  writeFileSync(file, png(W, H, buf));
  return { W, H };
}

const [, , out, colsA, scaleA, ...rest] = process.argv;
// only act as a CLI when run directly, not when imported
if (out && process.argv[1] && process.argv[1].replace(/\\/g,'/').split('/').pop() === 'preview.js') {
  const src = { ...PART1, ...PART2, ...PART3 };
  const names = !rest.length || rest[0] === 'all' ? Object.keys(src) : rest;
  const r = renderSheet(names, out, Number(colsA) || 8, Number(scaleA) || 6);
  console.log(`${out} ${r.W}x${r.H} (${names.length} icons)`);
}
