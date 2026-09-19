/* Crop the transparent padding off the society logo and resample it down to
   a sensible display size, so the stall laptop isn't decoding a 2048x2048
   image to draw a 36px mark.

   Run: node tools/make-logo.js
   Reads  assets/logo-white.png
   Writes assets/logo.png        (trimmed, 640px wide)
          assets/logo-mark.png   (trimmed, 128px wide — topbar/favicon)
*/
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const SRC = path.join(root, 'assets', 'logo-white.png');

/* ---------- decode ---------- */
function decode(buf) {
  let pos = 8, ihdr = null, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], ct: data[9], il: data[12] };
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (ihdr.ct !== 6 || ihdr.depth !== 8 || ihdr.il) throw new Error('need non-interlaced 8-bit RGBA');

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const { w: W, h: H } = ihdr, BPP = 4, stride = W * BPP;
  const px = Buffer.alloc(H * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
  };
  let rp = 0;
  for (let y = 0; y < H; y++) {
    const ft = raw[rp++];
    for (let x = 0; x < stride; x++) {
      const v = raw[rp++];
      const a = x >= BPP ? px[y * stride + x - BPP] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = (x >= BPP && y > 0) ? px[(y - 1) * stride + x - BPP] : 0;
      let out;
      if (ft === 0) out = v;
      else if (ft === 1) out = v + a;
      else if (ft === 2) out = v + b;
      else if (ft === 3) out = v + ((a + b) >> 1);
      else out = v + paeth(a, b, c);
      px[y * stride + x] = out & 0xff;
    }
  }
  return { W, H, px };
}

/* ---------- encode ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encode(W, H, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = W * 4;
  const raw = Buffer.alloc(H * (stride + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (stride + 1)] = 0;                                  // filter: none
    px.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- trim + resample ---------- */
function bbox(W, H, px, threshold = 8) {
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (px[(y * W + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Area-average resample. Premultiplies alpha so edges don't pick up
    colour from fully transparent pixels. */
function resample(src, SW, SH, box, DW, DH) {
  const out = Buffer.alloc(DW * DH * 4);
  const sx = box.w / DW, sy = box.h / DH;
  for (let dy = 0; dy < DH; dy++) {
    const y0 = box.y + dy * sy, y1 = box.y + (dy + 1) * sy;
    const iy0 = Math.floor(y0), iy1 = Math.min(SH, Math.ceil(y1));
    for (let dx = 0; dx < DW; dx++) {
      const x0 = box.x + dx * sx, x1 = box.x + (dx + 1) * sx;
      const ix0 = Math.floor(x0), ix1 = Math.min(SW, Math.ceil(x1));
      let r = 0, g = 0, b = 0, a = 0, wsum = 0;
      for (let y = iy0; y < iy1; y++) {
        const cy = Math.min(y + 1, y1) - Math.max(y, y0);
        if (cy <= 0) continue;
        for (let x = ix0; x < ix1; x++) {
          const cx = Math.min(x + 1, x1) - Math.max(x, x0);
          if (cx <= 0) continue;
          const w = cx * cy, i = (y * SW + x) * 4, al = src[i + 3] / 255;
          r += src[i] * al * w; g += src[i + 1] * al * w; b += src[i + 2] * al * w;
          a += src[i + 3] * w; wsum += w;
        }
      }
      const o = (dy * DW + dx) * 4;
      if (wsum > 0) {
        const alpha = a / wsum;
        const un = alpha > 0.5 ? (255 / alpha) : 0;
        out[o]     = Math.min(255, Math.round((r / wsum) * un));
        out[o + 1] = Math.min(255, Math.round((g / wsum) * un));
        out[o + 2] = Math.min(255, Math.round((b / wsum) * un));
        out[o + 3] = Math.round(alpha);
      }
    }
  }
  return out;
}

/* ---------- run ---------- */
const src = decode(fs.readFileSync(SRC));
const box = bbox(src.W, src.H, src.px);
console.log(`source      : ${src.W}x${src.H}`);
console.log(`trimmed box : ${box.w}x${box.h} at (${box.x}, ${box.y})`);

[['logo.png', 640], ['logo-mark.png', 128]].forEach(([name, width]) => {
  const h = Math.max(1, Math.round(width * box.h / box.w));
  const px = resample(src.px, src.W, src.H, box, width, h);
  const out = encode(width, h, px);
  const dest = path.join(root, 'assets', name);
  fs.writeFileSync(dest, out);
  console.log(`wrote       : assets/${name}  ${width}x${h}  ${(out.length / 1024).toFixed(0)} KB`);
});
