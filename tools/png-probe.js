/* Minimal PNG inspector: reports size, colour type, and where the visible
   (non-transparent) content actually sits inside the canvas.
   Run: node tools/png-probe.js assets/logo-white.png */
const fs = require('fs');
const zlib = require('zlib');

const file = process.argv[2];
const buf = fs.readFileSync(file);
if (buf.readUInt32BE(0) !== 0x89504e47) { console.error('not a png'); process.exit(1); }

let pos = 8, ihdr = null, idat = [];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.toString('ascii', pos + 4, pos + 8);
  const data = buf.slice(pos + 8, pos + 8 + len);
  if (type === 'IHDR') {
    ihdr = {
      width: data.readUInt32BE(0), height: data.readUInt32BE(4),
      depth: data[8], colorType: data[9], interlace: data[12]
    };
  } else if (type === 'IDAT') idat.push(data);
  else if (type === 'IEND') break;
  pos += 12 + len;
}

const CT = { 0: 'grayscale', 2: 'rgb', 3: 'palette', 4: 'gray+alpha', 6: 'rgba' };
console.log(`file        : ${file}`);
console.log(`size        : ${ihdr.width} x ${ihdr.height}`);
console.log(`bit depth   : ${ihdr.depth}`);
console.log(`colour type : ${ihdr.colorType} (${CT[ihdr.colorType]})`);
console.log(`interlaced  : ${ihdr.interlace ? 'yes' : 'no'}`);

if (ihdr.colorType !== 6 || ihdr.depth !== 8 || ihdr.interlace) {
  console.log('\n(pixel scan only supports non-interlaced 8-bit RGBA)');
  process.exit(0);
}

const raw = zlib.inflateSync(Buffer.concat(idat));
const W = ihdr.width, H = ihdr.height, BPP = 4, stride = W * BPP;
const px = Buffer.alloc(H * stride);

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
}
let rp = 0;
for (let y = 0; y < H; y++) {
  const ft = raw[rp++];
  for (let x = 0; x < stride; x++) {
    const v = raw[rp++];
    const a = x >= BPP ? px[y * stride + x - BPP] : 0;
    const b = y > 0 ? px[(y - 1) * stride + x] : 0;
    const c = (x >= BPP && y > 0) ? px[(y - 1) * stride + x - BPP] : 0;
    let out;
    switch (ft) {
      case 0: out = v; break;
      case 1: out = v + a; break;
      case 2: out = v + b; break;
      case 3: out = v + ((a + b) >> 1); break;
      case 4: out = v + paeth(a, b, c); break;
      default: throw new Error('bad filter ' + ft);
    }
    px[y * stride + x] = out & 0xff;
  }
}

// bounding box of anything meaningfully opaque
let minX = W, minY = H, maxX = -1, maxY = -1, opaque = 0;
let rs = 0, gs = 0, bs = 0, n = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * stride + x * BPP;
    const alpha = px[i + 3];
    if (alpha > 24) {
      opaque++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (alpha > 200) { rs += px[i]; gs += px[i + 1]; bs += px[i + 2]; n++; }
    }
  }
}

const pct = v => ((v / W) * 100).toFixed(1) + '%';
console.log(`\nopaque pixels        : ${((opaque / (W * H)) * 100).toFixed(1)}% of the canvas`);
console.log(`content bounding box : x ${minX}..${maxX}, y ${minY}..${maxY}`);
console.log(`  -> left pad ${pct(minX)}, right pad ${pct(W - 1 - maxX)}, top pad ${pct(minY)}, bottom pad ${pct(H - 1 - maxY)}`);
console.log(`  -> content is ${(((maxX - minX) / W) * 100).toFixed(1)}% wide, ${(((maxY - minY) / H) * 100).toFixed(1)}% tall`);
if (n) {
  const avg = [Math.round(rs / n), Math.round(gs / n), Math.round(bs / n)];
  console.log(`avg colour of solid ink : rgb(${avg.join(', ')})  ${avg[0] > 200 && avg[1] > 200 && avg[2] > 200 ? '= white artwork' : '= dark/coloured artwork'}`);
}
