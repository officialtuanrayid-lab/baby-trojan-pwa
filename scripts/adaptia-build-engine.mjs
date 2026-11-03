import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const reportDir = path.join(root, '.adaptia-build');
const prompt = String(process.env.ADAPTIA_BUILD_PROMPT || '').trim();
const mode = String(process.env.ADAPTIA_BUILD_MODE || 'preview');
const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_FALLBACK_KEY].filter(Boolean);

if (!prompt) throw new Error('ADAPTIA_BUILD_PROMPT kosong');
if (!keys.length) throw new Error('GEMINI_API_KEY dan GEMINI_FALLBACK_KEY belum tersedia');
await fs.mkdir(reportDir, { recursive: true });

const allowed = ['core-memory/decoded-index.html', 'config.json'];
const source = {};
for (const file of allowed) source[file] = await fs.readFile(path.join(root, file), 'utf8');

const context = Object.entries(source).map(([file, text]) => {
  const limit = file.endsWith('.html') ? 120000 : 30000;
  return `FILE: ${file}\n${text.substring(0, limit)}`;
}).join('\n\n');

const instruction = `Kamu adalah Adaptia Build Engine. Buat patch aman untuk repository Adaptia.
Instruksi user: ${prompt}

Aturan:
- Hanya boleh mengubah file yang ada di daftar konteks.
- Jangan mengubah atau meminta secret, token, workflow permission, atau file di luar daftar.
- Return JSON valid saja, tanpa markdown, dengan bentuk:
{"summary":"...","patches":[{"file":"core-memory/decoded-index.html","old":"teks exact","new":"teks pengganti"}]}
- old wajib cocok persis dan sesingkat mungkin, new harus lengkap.
- Jika tidak yakin menemukan lokasi yang tepat, return patches kosong dan jelaskan di summary.

Konteks source:
${context}`;

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
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: instruction }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 8192 } })
    });
    clearTimeout(timer);
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(x => x.text || '').join('') || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!response.ok || !match) throw new Error(data?.error?.message || 'Gemini tidak mengembalikan JSON');
    result = JSON.parse(match[0]);
    break;
  } catch (error) { lastError = error; }
  if (result) break;
}
if (!result) {
  try {
    const compactInstruction = instruction.length > 50000 ? instruction.substring(0, 50000) + '\n\n[Source dipotong untuk batas request. Buat patch hanya dari konteks yang terlihat.]' : instruction;
    const response = await fetch('https://adaptia.isaacdev.workers.dev/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: compactInstruction + '\n\nBalas JSON valid saja sesuai format patch.', history: [] })
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error('Fallback Adaptia mengembalikan respons non-JSON: HTTP ' + response.status); }
    const text = String(data?.reply || '');
    const match = text.match(/\{[\s\S]*\}/);
    if (match) result = JSON.parse(match[0]);
    else if (data?.error) lastError = new Error(data.error);
  } catch (error) { lastError = error; }
}
if (!result) throw lastError || new Error('Build engine gagal');

const patches = Array.isArray(result.patches) ? result.patches : [];
for (const patch of patches) {
  if (!allowed.includes(patch.file) || typeof patch.old !== 'string' || typeof patch.new !== 'string') throw new Error('Patch tidak aman atau formatnya invalid');
  const filePath = path.join(root, patch.file);
  const current = await fs.readFile(filePath, 'utf8');
  if (!current.includes(patch.old)) throw new Error(`Target patch tidak ditemukan: ${patch.file}`);
  if ((current.match(new RegExp(patch.old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length !== 1) throw new Error(`Target patch tidak unik: ${patch.file}`);
}

await fs.writeFile(path.join(reportDir, 'plan.json'), JSON.stringify({ mode, prompt, summary: result.summary || '', patches }, null, 2));
if (mode === 'preview') {
  console.log(`PREVIEW: ${patches.length} patch(es).`);
  console.log(result.summary || 'Tidak ada ringkasan.');
  process.exit(0);
}
if (!patches.length) throw new Error('Tidak ada patch yang bisa diterapkan: ' + (result.summary || 'model tidak menemukan target yang aman'));

for (const patch of patches) {
  const filePath = path.join(root, patch.file);
  const current = await fs.readFile(filePath, 'utf8');
  await fs.writeFile(filePath, current.replace(patch.old, patch.new));
}

execFileSync('bash', ['adaptia.sh', '--dry-run'], { stdio: 'inherit' });
if (mode === 'apply' || mode === 'deploy') {
  execFileSync('git', ['config', 'user.name', 'Adaptia Build Engine']);
  execFileSync('git', ['config', 'user.email', 'adaptia-build-engine@users.noreply.github.com']);
  execFileSync('git', ['add', ...allowed]);
  execFileSync('git', ['commit', '-m', `adaptia engine: ${String(result.summary || prompt).substring(0, 72)}`], { stdio: 'inherit' });
  execFileSync('git', ['push', 'origin', 'HEAD:main'], { stdio: 'inherit' });
}
if (mode === 'deploy') {
  if (!process.env.CLOUDFLARE_API_TOKEN) throw new Error('CLOUDFLARE_API_TOKEN belum tersedia');
  await fs.writeFile('/root/.cf-token', process.env.CLOUDFLARE_API_TOKEN, { mode: 0o600 });
  try { execFileSync('bash', ['adaptia.sh'], { stdio: 'inherit' }); }
  finally { await fs.writeFile('/root/.cf-token', '', { mode: 0o600 }); }
}
console.log(`${mode.toUpperCase()}: selesai. ${patches.length} patch(es).`);
