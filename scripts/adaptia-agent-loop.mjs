#!/usr/bin/env node
/*
 * Adaptia Agent Loop.
 * Runs the guarded Build Engine, feeds validation failures back into the next
 * attempt, and stops after a small bounded number of retries.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const basePrompt = String(process.env.ADAPTIA_BUILD_PROMPT || '').trim();
const mode = String(process.env.ADAPTIA_BUILD_MODE || 'preview');
const maxAttempts = Math.max(1, Math.min(3, Number(process.env.ADAPTIA_AGENT_MAX_ATTEMPTS || 3)));
if (!basePrompt) throw new Error('ADAPTIA_BUILD_PROMPT kosong');

let feedback = '';
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const prompt = attempt === 1
    ? basePrompt
    : `${basePrompt}

AGENT RETRY ${attempt}/${maxAttempts}
Percobaan sebelumnya gagal saat validasi. Baca error berikut, perbaiki akar masalahnya,
lalu keluarkan patch baru yang aman. Jangan hanya menjelaskan; hasilkan patch.
ERROR VALIDASI SEBELUMNYA:
${feedback.slice(-9000)}`;
  console.log(`=== ADAPTIA AGENT ATTEMPT ${attempt}/${maxAttempts} (${mode}) ===`);
  const result = spawnSync(process.execPath, ['scripts/adaptia-build-engine.mjs'], {
    env: { ...process.env, ADAPTIA_BUILD_PROMPT: prompt, ADAPTIA_BUILD_MODE: mode },
    encoding: 'utf8',
    maxBuffer: 12 * 1024 * 1024
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  process.stdout.write(output);
  if (result.status === 0) {
    fs.writeFileSync('.adaptia-build/agent-loop.json', JSON.stringify({
      status: 'success', attempts: attempt, maxAttempts, mode
    }, null, 2));
    process.exit(0);
  }
  feedback = output || `Build Engine exit code ${result.status}`;
  fs.mkdirSync('.adaptia-build', { recursive: true });
  fs.writeFileSync('.adaptia-build/agent-loop.json', JSON.stringify({
    status: 'retrying', attempts: attempt, maxAttempts, mode,
    lastError: feedback.slice(-9000)
  }, null, 2));
}

console.error(`ADAPTIA AGENT GAGAL: ${maxAttempts} percobaan habis; perubahan dibatalkan oleh Build Engine.`);
process.exit(1);
