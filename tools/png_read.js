// png_read.js — minimal PNG decoder (8-bit, non-interlaced) so the tile sheets
// can be inspected without pulling in an image library.
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export function readPng(file) {
  const b = readFileSync(file);
  const width = b.readUInt32BE(16), height = b.readUInt32BE(20);
  const depth = b[24], colorType = b[25], interlace = b[28];
  if (depth !== 8) throw new Error(`${file}: ${depth}-bit not supported`);
  if (interlace) throw new Error(`${file}: interlaced not supported`);

  let off = 8, idat = [], palette = null, trns = null;
  while (off < b.length - 8) {
    const len = b.readUInt32BE(off), type = b.toString('ascii', off + 4, off + 8);
    const data = b.subarray(off + 8, off + 8 + len);
    if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = CHANNELS[colorType];
  const bpp = ch;                       // bytes per pixel at 8-bit
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, bb = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += bb;
      else if (filter === 3) v += (a + bb) >> 1;
      else if (filter === 4) {
        const p = a + bb - c, pa = Math.abs(p - a), pb = Math.abs(p - bb), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c);
      }
      cur[i] = v & 0xff;
    }
  }

  // normalise everything to RGBA
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    let r, g, bl, al = 255;
    if (colorType === 6) { r = out[i * 4]; g = out[i * 4 + 1]; bl = out[i * 4 + 2]; al = out[i * 4 + 3]; }
    else if (colorType === 2) { r = out[i * 3]; g = out[i * 3 + 1]; bl = out[i * 3 + 2]; }
    else if (colorType === 0) { r = g = bl = out[i]; }
    else if (colorType === 4) { r = g = bl = out[i * 2]; al = out[i * 2 + 1]; }
    else if (colorType === 3) {
      const p = out[i]; r = palette[p * 3]; g = palette[p * 3 + 1]; bl = palette[p * 3 + 2];
      if (trns && p < trns.length) al = trns[p];
    }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = bl; rgba[i * 4 + 3] = al;
  }
  return { width, height, data: rgba };
}
