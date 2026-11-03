#!/usr/bin/env node
// ============================================
// ADAPTIA BUILD-WORKER — rebuild worker dari HTML source
// Auto-bump versi: adaptia-vX.Y + title vX.Y.Z + SW cache name
// Usage: node build-worker.js <html> <template-worker> <output>
// ============================================
const fs = require('fs');
const path = require('path');

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
  const extensionPath = path.resolve(__dirname, '../../scripts/worker-backend-extension.js');
  const extension = fs.readFileSync(extensionPath, 'utf8').trim();
  const changed = [];

  // Keep backend additions in a small editable source file and inject a
  // marked block into the generated Worker. Replacing the marked block makes
  // repeated builds idempotent even when the template is already generated.
  const extStart = '/* ADAPTIA_BACKEND_EXTENSION_START */';
  const extEnd = '/* ADAPTIA_BACKEND_EXTENSION_END */';
  const extBlock = `${extStart}\n${extension}\n${extEnd}`;
  const existingExtension = new RegExp(`${extStart}[\\s\\S]*?${extEnd}`);
  if (existingExtension.test(template)) {
    template = template.replace(existingExtension, extBlock);
  } else {
    const handlerMarker = 'async function handleRequest(event) {';
    if (!template.includes(handlerMarker)) {
      console.error('ERROR: handleRequest tidak ditemukan untuk injeksi backend extension');
      process.exit(1);
    }
    template = template.replace(handlerMarker, `${extBlock}\n\n${handlerMarker}`);
  }
  const dispatchStart = '  /* ADAPTIA_BACKEND_EXTENSION_DISPATCH_START */';
  const dispatchEnd = '  /* ADAPTIA_BACKEND_EXTENSION_DISPATCH_END */';
  const dispatchBlock = `${dispatchStart}\n  const extensionResponse = await adaptiaBackendExtension(request, path, method, CORS);\n  if (extensionResponse) return extensionResponse;\n${dispatchEnd}`;
  const existingDispatch = new RegExp(`${dispatchStart}[\\s\\S]*?${dispatchEnd}`);
  if (existingDispatch.test(template)) {
    template = template.replace(existingDispatch, dispatchBlock);
  } else {
    const notFoundMarker = "return new Response('Adaptia - Not Found'";
    if (!template.includes(notFoundMarker)) {
      console.error('ERROR: response 404 Worker tidak ditemukan untuk dispatch extension');
      process.exit(1);
    }
    template = template.replace(notFoundMarker, `${dispatchBlock}\n  ${notFoundMarker}`);
  }
  changed.push('backend extension source injected');

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
  let newTitleVer = null;
  if (tm) {
    newTitleVer = bumpPatch(tm[1]);
    html = html.replace(titleRe, '<title>ADAPTIA (v' + newTitleVer + ')</title>');
    changed.push('title v' + tm[1] + ' -> v' + newTitleVer);
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

  // 4b. Inject BUILD_VERSION ke worker (samakan dgn title UI)
  if (newTitleVer) {
    const buildRe = /const BUILD_VERSION = '[^']*';/;
    if (!buildRe.test(template)) {
      console.error('ERROR: const BUILD_VERSION tidak ditemukan di template');
      process.exit(1);
    }
    template = template.replace(buildRe, "const BUILD_VERSION = 'v" + newTitleVer + "';");
    changed.push('BUILD_VERSION -> v' + newTitleVer);
  }

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

  // 5b. VALIDASI INLINE JS HTML — cegah deploy app mati (SyntaxError / bare async-await nyasar)
  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const scripts = [];
  let sm;
  while ((sm = scriptRe.exec(html)) !== null) scripts.push(sm[1]);
  const problems = [];
  scripts.forEach((sc, idx) => {
    try {
      new Function(sc);
    } catch (e) {
      problems.push('[inline script #' + idx + '] SYNTAX ERROR: ' + (e && e.message || e));
    }
    if (/^\s*async\s*$/m.test(sc)) problems.push('[inline script #' + idx + '] ada token "async" nyasar (baris sendiri) — hapus!');
    if (/^\s*await\s*$/m.test(sc)) problems.push('[inline script #' + idx + '] ada token "await" nyasar (baris sendiri) — hapus!');
    if (sc.includes('\u0000')) problems.push('[inline script #' + idx + '] ada karakter NUL di script');
  });
  if (problems.length) {
    console.error('=== VALIDASI GAGAL — build DIBATALKAN ===');
    problems.forEach((p) => console.error('  - ' + p));
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
