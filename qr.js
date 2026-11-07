/* Minimal QR code encoder (byte mode, error correction level M, versions 1-10).
   Self-contained, no dependencies. Usage: QR.svg(text, {size: 320, margin: 4}) -> SVG string. */
const QR = (() => {
  // ---- GF(256) arithmetic (primitive polynomial 0x11D)
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];
  function rsGenerator(n) { let g = [1]; for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); } g = ng; } return g; }
  function rsEncode(data, n) { const g = rsGenerator(n); const res = new Array(n).fill(0); for (const b of data) { const f = b ^ res.shift(); res.push(0); if (f) for (let j = 0; j < n; j++) res[j] ^= mul(g[j + 1], f); } return res; }

  // ---- level M tables (index = version)
  const EC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  const NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  function rawModules(v) { let r = (16 * v + 128) * v + 64; if (v >= 2) { const a = Math.floor(v / 7) + 2; r -= (25 * a - 10) * a - 55; if (v >= 7) r -= 36; } return r; }
  const totalCW = v => Math.floor(rawModules(v) / 8);
  const dataCW = v => totalCW(v) - EC_PER_BLOCK[v] * NUM_BLOCKS[v];

  function utf8(str) { return Array.from(new TextEncoder().encode(str)); }

  function encode(text) {
    const bytes = utf8(text);
    let ver = 0;
    for (let v = 1; v <= 10; v++) { const cap = dataCW(v) * 8 - 4 - (v >= 10 ? 16 : 8); if (bytes.length * 8 <= cap) { ver = v; break; } }
    if (!ver) throw new Error("Text too long for this QR encoder (max ~213 bytes)");
    const size = 4 * ver + 17;
    // bit stream
    const bits = [];
    const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4); push(bytes.length, ver >= 10 ? 16 : 8); for (const b of bytes) push(b, 8);
    const capBits = dataCW(ver) * 8;
    push(0, Math.min(4, capBits - bits.length));
    while (bits.length % 8) bits.push(0);
    for (let pad = 0xEC; bits.length < capBits; pad ^= 0xEC ^ 0x11) push(pad, 8);
    const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
    // error correction + interleave
    const nb = NUM_BLOCKS[ver], ec = EC_PER_BLOCK[ver], tot = totalCW(ver);
    const numShort = nb - tot % nb, shortLen = Math.floor(tot / nb);
    const blocks = []; let k = 0;
    for (let i = 0; i < nb; i++) { const len = shortLen - ec + (i < numShort ? 0 : 1); const dat = data.slice(k, k + len); k += len; const ecc = rsEncode(dat, ec); if (i < numShort) dat.push(0); blocks.push(dat.concat(ecc)); }
    const out = [];
    for (let i = 0; i < blocks[0].length; i++) for (let j = 0; j < nb; j++) if (!(i === shortLen - ec && j < numShort)) out.push(blocks[j][i]);
    // modules
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, d) => { mod[y][x] = d; fn[y][x] = true; };
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= size || y >= size) continue; const d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    for (let i = 0; i < size; i++) { if (!fn[6][i]) set(i, 6, i % 2 === 0); if (!fn[i][6]) set(6, i, i % 2 === 0); }
    if (ver >= 2) {
      const na = Math.floor(ver / 7) + 2, step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
      const pos = [6]; for (let p = size - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
      for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
    // reserve format / version areas
    for (let i = 0; i < 9; i++) { if (!fn[8][i]) set(i, 8, false); if (!fn[i][8]) set(8, i, false); }
    for (let i = 0; i < 8; i++) { if (!fn[8][size - 1 - i]) set(size - 1 - i, 8, false); if (!fn[size - 1 - i][8]) set(8, size - 1 - i, false); }
    if (ver >= 7) for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, b = Math.floor(i / 3); set(a, b, false); set(b, a, false); }
    // place data
    let bi = 0; const totalBits = out.length * 8;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && bi < totalBits) { mod[y][x] = ((out[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++; }
      }
    }
    // version info
    if (ver >= 7) { let rem = ver; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25); const vb = ver << 12 | rem; for (let i = 0; i < 18; i++) { const bit = ((vb >>> i) & 1) === 1, a = size - 11 + i % 3, b = Math.floor(i / 3); mod[b][a] = bit; mod[a][b] = bit; } }
    // masks
    const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
    const applyMask = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x]; };
    const drawFormat = m => {
      const d = (0 << 3) | m; let rem = d; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const b = ((d << 10) | rem) ^ 0x5412; const g = i => ((b >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) mod[i][8] = g(i);
      mod[7][8] = g(6); mod[8][8] = g(7); mod[8][7] = g(8);
      for (let i = 9; i < 15; i++) mod[8][14 - i] = g(i);
      for (let i = 0; i < 8; i++) mod[8][size - 1 - i] = g(i);
      for (let i = 8; i < 15; i++) mod[size - 15 + i][8] = g(i);
      mod[size - 8][8] = true;
    };
    const penalty = () => {
      let p = 0;
      for (let y = 0; y < size; y++) { let run = 1; for (let x = 1; x < size; x++) { if (mod[y][x] === mod[y][x - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (let x = 0; x < size; x++) { let run = 1; for (let y = 1; y < size; y++) { if (mod[y][x] === mod[y - 1][x]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = mod[y][x]; if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3; }
      const pat = [true, false, true, true, true, false, true];
      const check = (get) => { for (let i = 0; i + 7 <= size; i++) { let ok = true; for (let j = 0; j < 7; j++) if (get(i + j) !== pat[j]) { ok = false; break; } if (!ok) continue; const before = i >= 4 && [1, 2, 3, 4].every(k => !get(i - k)); const after = i + 10 < size + 0 && [7, 8, 9, 10].every(k => i + k < size && !get(i + k)); if (before || after) p += 40; } };
      for (let y = 0; y < size; y++) check(x => mod[y][x]);
      for (let x = 0; x < size; x++) check(y => mod[y][x]);
      let dark = 0; for (const row of mod) for (const c of row) if (c) dark++;
      p += Math.max(0, Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1) * 10;
      return p;
    };
    let best = 0, bestScore = Infinity;
    for (let m = 0; m < 8; m++) { applyMask(m); drawFormat(m); const s = penalty(); if (s < bestScore) { bestScore = s; best = m; } applyMask(m); }
    applyMask(best); drawFormat(best);
    return { size, modules: mod, version: ver, mask: best };
  }

  function svg(text, opt) {
    opt = opt || {}; const q = encode(text); const m = opt.margin == null ? 4 : opt.margin; const n = q.size + 2 * m;
    let d = "";
    for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.modules[y][x]) d += `M${x + m} ${y + m}h1v1h-1z`;
    const px = opt.size || 320;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="${opt.color || '#000'}"/></svg>`;
  }
  return { encode, svg };
})();
if (typeof module !== "undefined") module.exports = QR;
