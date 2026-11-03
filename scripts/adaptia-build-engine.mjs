import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const reportDir = path.join(root, '.adaptia-build');
const prompt = String(process.env.ADAPTIA_BUILD_PROMPT || '').trim();
const mode = String(process.env.ADAPTIA_BUILD_MODE || 'preview');
const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_FALLBACK_KEY].filter(Boolean);
const validModes = new Set(['preview', 'apply', 'deploy']);
if (!prompt) throw new Error('ADAPTIA_BUILD_PROMPT kosong');
if (!validModes.has(mode)) throw new Error('Mode Build Engine tidak valid');
if (!keys.length) throw new Error('GEMINI_API_KEY dan GEMINI_FALLBACK_KEY belum tersedia');
await fs.mkdir(reportDir, { recursive: true });

// Source biasa boleh dituning. Secret, cache, backup, binary, dan bundle hasil
// generate tetap dilindungi agar engine tidak merusak jalur deploy.
const blocked = [
  /^(?:\.git|node_modules|core-memory\/backups)(?:\/|$)/,
  /(?:^|\/)(?:\.env(?:\.|$)|.*(?:secret|credential|token|password|private-key).*)(?:$|\/)/i,
  /(?:^|\/)(?:worker-current-live\.js|worker-latest\.js|.*\.pem|.*\.key|.*\.crt)$/i,
  /\.(?:png|jpe?g|gif|webp|ico|mp3|mp4|zip|gz|pdf)$/i
];
const textExt = /\.(?:js|mjs|cjs|ts|tsx|jsx|html?|css|json|md|txt|sh|yml|yaml|toml|xml|sql|py|env\.example)$/i;
const isBlocked = (file) => blocked.some((pattern) => pattern.test(file));
const isText = (file) => textExt.test(file) || !path.extname(file);
function scoreFile(file, terms) {
  const lower = file.toLowerCase();
  let score = 0;
  for (const term of terms) if (term && lower.includes(term)) score += 5;
  if (/^(core-memory\/decoded-index\.html|config\.json|worker|wrangler|scripts\/)/i.test(file)) score += 2;
  if (/\.(js|mjs|html|css|json)$/i.test(file)) score += 1;
  return score;
}

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0').filter(Boolean).filter((file) => !isBlocked(file) && isText(file));
if (!tracked.length) throw new Error('Tidak menemukan file sumber yang aman');
const terms = prompt.toLowerCase().split(/[^a-z0-9_-]+/).filter((x) => x.length > 2);
const ranked = tracked.map((file) => ({ file, score: scoreFile(file, terms) }))
  .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
const selected = [];
let totalChars = 0;
for (const item of ranked) {
  const filePath = path.join(root, item.file);
  const stat = await fs.stat(filePath);
  if (stat.size > 90000) continue;
  const text = await fs.readFile(filePath, 'utf8');
  const limit = item.file.endsWith('.html') ? 70000 : 45000;
  const excerpt = text.length > limit ? text.slice(0, limit) + '\n[FILE DIPOTONG]' : text;
  if (totalChars + excerpt.length > 220000 && selected.length >= 6) continue;
  selected.push({ file: item.file, excerpt });
  totalChars += excerpt.length;
  if (selected.length >= 28 || totalChars >= 220000) break;
}
const allowed = selected.map((x) => x.file);
const context = selected.map(({ file, excerpt }) => `FILE: ${file}\n${excerpt}`).join('\n\n');
await fs.writeFile(path.join(reportDir, 'manifest.json'), JSON.stringify({ mode, prompt, trackedSourceFiles: tracked, modelContextFiles: allowed, blockedPolicy: 'secrets, generated bundles, backups, binary assets, and caches are protected' }, null, 2));

const instruction = `Kamu adalah Adaptia Build Engine. Lakukan build, upgrade, atau tuning pada repository Adaptia.
Instruksi user: ${prompt}

Aturan keamanan:
- Hanya boleh mengubah file yang ada pada daftar FILE di konteks.
- Jangan mengubah secret, token, credential, workflow permission, .env, generated bundle, backup, atau binary.
- Jangan menghapus fitur yang tidak diminta.
- Return JSON valid saja tanpa markdown:
{"summary":"...","patches":[{"file":"path/relatif","old":"teks exact","new":"teks pengganti"}]}
- old wajib cocok persis dan unik; new harus lengkap dan menjaga sintaks.
- Jika konteks tidak cukup atau perubahan tidak aman, return patches kosong dan jelaskan alasannya.

Daftar file yang boleh disentuh:
${allowed.join('\n')}

Konteks source:
${context}`;

function extractJson(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

let result;
let lastError;
const models = ['gemini-3.8-flash', 'gemini-3.8-flash-lite'];
for (const model of models) for (const key of keys) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key), {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: instruction }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 12000 } })
    });
    clearTimeout(timer);
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((x) => x.text || '').join('') || '';
    result = extractJson(text);
    if (!response.ok || !result) throw new Error(data?.error?.message || 'Gemini tidak mengembalikan JSON');
    break;
  } catch (error) { lastError = error; }
  if (result) break;
}
if (!result) {
  try {
    const compact = instruction.length > 60000 ? instruction.slice(0, 60000) + '\n[Konteks dipotong]' : instruction;
    const response = await fetch('https://adaptia.isaacdev.workers.dev/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: compact + '\n\nBalas JSON valid saja sesuai format patch.', history: [] })
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error('Fallback Adaptia mengembalikan respons non-JSON: HTTP ' + response.status); }
    result = extractJson(data?.reply || '');
    if (!result) lastError = new Error(data?.error || 'Fallback tidak menghasilkan patch JSON');
  } catch (error) { lastError = error; }
}
if (!result) throw lastError || new Error('Build Engine gagal');

const patches = Array.isArray(result.patches) ? result.patches : [];
const originals = new Map();
for (const patch of patches) {
  if (!allowed.includes(patch.file) || isBlocked(patch.file) || typeof patch.old !== 'string' || typeof patch.new !== 'string') throw new Error('Patch tidak aman atau formatnya invalid: ' + String(patch.file));
  const filePath = path.join(root, patch.file);
  const current = await fs.readFile(filePath, 'utf8');
  const escaped = patch.old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const count = (current.match(new RegExp(escaped, 'g')) || []).length;
  if (count !== 1) throw new Error(`Target patch harus unik (${count}x): ${patch.file}`);
  if (!originals.has(patch.file)) originals.set(patch.file, current);
}
await fs.writeFile(path.join(reportDir, 'plan.json'), JSON.stringify({ mode, prompt, summary: result.summary || '', patches }, null, 2));
if (mode === 'preview') {
  console.log(`PREVIEW: ${patches.length} patch(es) dari ${tracked.length} file sumber aman.`);
  console.log(result.summary || 'Tidak ada ringkasan.');
  process.exit(0);
}
if (!patches.length) throw new Error('Tidak ada patch yang bisa diterapkan: ' + (result.summary || 'model tidak menemukan target yang aman'));

try {
  for (const patch of patches) {
    const filePath = path.join(root, patch.file);
    const current = await fs.readFile(filePath, 'utf8');
    await fs.writeFile(filePath, current.replace(patch.old, patch.new));
  }
  execFileSync('bash', ['scripts/secret-scan.sh', ...patches.map((patch) => patch.file)], { stdio: 'inherit' });
  for (const patch of patches) {
    if (/\.(?:js|mjs|cjs)$/i.test(patch.file)) execFileSync('node', ['--check', patch.file], { stdio: 'inherit' });
    if (/\.json$/i.test(patch.file)) JSON.parse(await fs.readFile(path.join(root, patch.file), 'utf8'));
  }
  execFileSync('bash', ['adaptia.sh', '--dry-run'], { stdio: 'inherit' });
  if (mode === 'deploy') {
    if (!process.env.CLOUDFLARE_API_TOKEN) throw new Error('CLOUDFLARE_API_TOKEN belum tersedia');
    execFileSync('bash', ['scripts/safe-deploy.sh'], {
      stdio: 'inherit',
      env: { ...process.env, FILE: 'worker-latest.js', WRANGLER_BIN: path.join(root, 'node_modules/.bin/wrangler') }
    });
    await fs.copyFile('worker-latest.js', 'worker-current-live.js');
  }
  execFileSync('git', ['config', 'user.name', 'Adaptia Build Engine']);
  execFileSync('git', ['config', 'user.email', 'adaptia-build-engine@users.noreply.github.com']);
  const changed = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).filter((file) => !isBlocked(file));
  if (!changed.length) throw new Error('Tidak ada perubahan source aman untuk di-commit');
  execFileSync('git', ['add', ...changed]);
  execFileSync('bash', ['scripts/secret-scan.sh'], { stdio: 'inherit' });
  execFileSync('git', ['commit', '-m', `adaptia engine: ${String(result.summary || prompt).substring(0, 72)}`], { stdio: 'inherit' });
  execFileSync('git', ['push', 'origin', 'HEAD:main'], { stdio: 'inherit' });
  console.log(`${mode.toUpperCase()}: selesai. ${patches.length} patch(es), ${changed.length} file(s).`);
} catch (error) {
  for (const [file, original] of originals) await fs.writeFile(path.join(root, file), original);
  throw error;
}
