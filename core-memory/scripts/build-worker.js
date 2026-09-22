#!/usr/bin/env node
// ============================================
// ADAPTIA BUILD-WORKER — rebuild worker dari HTML source
// Auto-bump versi: adaptia-vX.Y + title vX.Y.Z + SW cache name
// Usage: node build-worker.js <html> <template-worker> <output>
// ============================================
const fs = require('fs');

// Bump helper: versi "a.b" -> "a.(b+1)"
function bumpMinor(v) {
  const parts = v.split('.');
  if (parts.length >= 2) {
    parts[1] = String(parseInt(parts[1] || '0', 10) + 1);
  } else {
    parts.push('1');
  }
  return parts.join('.');
}

// Bump helper: versi "a.b.c" -> "a.b.(c+1)"
function bumpPatch(v) {
  const parts = v.split('.');
  parts[parts.length - 1] = String(parseInt(parts[parts.length - 1] || '0', 10) + 1);
  return parts.join('.');
}

function main() {
  const htmlPath = process.argv[2];
  const templatePath = process.argv[3];
  const outPath = process.argv[4];

  if (!htmlPath || !templatePath || !outPath) {
    console.error('Usage: node build-worker.js <html> <template-worker> <output>');
    process.exit(1);
  }

  let html = fs.readFileSync(htmlPath, 'utf8');
  let template = fs.readFileSync(templatePath, 'utf8');
  const changed = [];

  // 1. Bump adaptia-vX.Y (cache-bust auto-update token) — ALL occurrences
  const verRe = /adaptia-v(\d+\.\d+)/g;
  let didBump = false;
  html = html.replace(verRe, (full, v) => {
    changed.push('adaptia-v' + v + ' -> adaptia-v' + bumpMinor(v));
    didBump = true;
    return 'adaptia-v' + bumpMinor(v);
  });
  if (!didBump) {
    // Tidak ada token -> tambahkan default
    const marker = '// === AUTO-UPDATE: Check version on every load ===';
    if (html.includes(marker) && html.includes('var VER =')) {
      html = html.replace(/var VER = '[^']*'/, "var VER = 'adaptia-v1.0'");
      changed.push('adaptia-v (baru) -> adaptia-v1.0');
    }
  }

  // 2. Bump title ADAPTIA (vX.Y.Z) — cosmetic
  const titleRe = /<title>ADAPTIA \(v(\d+\.\d+\.\d+)\)<\/title>/;
  const tm = html.match(titleRe);
  if (tm) {
    html = html.replace(titleRe, '<title>ADAPTIA (v' + bumpPatch(tm[1]) + ')</title>');
    changed.push('title v' + tm[1] + ' -> v' + bumpPatch(tm[1]));
  }

  // 3. Bump SW cache name inside /sw.js asset
  const swRe = /'\/sw\.js':\s*'([^']+)'/;
  const swm = template.match(swRe);
  if (swm) {
    let sw = Buffer.from(swm[1], 'base64').toString('utf8');
    const cacheRe = /adaptia-s(\d+)/;
    const cm = sw.match(cacheRe);
    if (cm) {
      const next = 'adaptia-s' + (parseInt(cm[1], 10) + 1);
      sw = sw.replace(cacheRe, next).replace(/SW v\d+/, 'SW v' + (parseInt(cm[1], 10) + 1));
      changed.push('SW cache ' + cm[0] + ' -> ' + next);
      template = template.replace(swRe, "'/sw.js': '" + Buffer.from(sw, 'utf8').toString('base64') + "'");
    }
  }

  // 4. Ganti base64 /index.html di worker template
  const htmlRe = /'\/index\.html':\s*'[^']+'/;
  if (!htmlRe.test(template)) {
    console.error('ERROR: pattern /index.html tidak ditemukan di template');
    process.exit(1);
  }
  const b64 = Buffer.from(html, 'utf8').toString('base64');
  // Ganti SEMUA '/index.html'?? tidak — hanya yang pertama (utama)
  template = template.replace(htmlRe, "'/index.html': '" + b64 + "'");

  // 5. Verifikasi hasil
  const check = template.match(/'\/index\.html':\s*'([^']+)'/);
  const decoded = Buffer.from(check[1], 'base64').toString('utf8');
  if (decoded !== html) {
    console.error('ERROR: decoded HTML tidak sama dengan source!');
    process.exit(1);
  }
  if (!decoded.startsWith('<!DOCTYPE')) {
    console.error('ERROR: hasil decode bukan HTML!');
    process.exit(1);
  }

  fs.writeFileSync(outPath, template);

  console.log('=== BUILD WORKER SELESAI ===');
  console.log('Source  :', htmlPath, '(' + html.length, 'bytes)');
  console.log('Output  :', outPath, '(' + template.length, 'bytes)');
  console.log('Perubahan:');
  changed.forEach((c) => console.log('  - ' + c));
  console.log('JS size :', template.length);
}

main();
