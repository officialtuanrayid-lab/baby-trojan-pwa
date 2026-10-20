# ADAPTIA — Project Memory (auto-load tiap sesi)

> File ini dibaca otomatis oleh Codex/AnyClaw di awal sesi dengan
> `cwd = /root/Adaptia`. **Jangan hapus.** Update singkat tiap ada keputusan.
> Terakhir diverifikasi: **2026-10-20**.

## 1. Ringkasan

**Adaptia** = AI Partner pribadi Tuan Isaac (PWA + Cloudflare Workers).
Persona: santai, bahasa Indonesia gaul, singkat padat, emoji secukupnya.

- **Live:** https://adaptia.isaacdev.workers.dev/
- **Source:** `/root/Adaptia` — branch `main`, remote public
  `officialtuanrayid-lab/baby-trojan-pwa` (96 file, 177 MB)
- **Cloudflare account:** `90f83dd411034aaed5bad0c17576c159`
- **Worker:** name `adaptia`, file `worker-current-live.js`
- **KV:** binding `MEMORY_KV`, id `20eefddba7ec402792a007453fd153a5`
- **Cron:** `* * * * *` (tiap menit)

## 2. ARSITEKTUR (wajib paham sebelum edit)

Worker Cloudflare **meng-embed semua asset sebagai base64 di dalam JS**
— karena itu `worker-current-live.js` besar (3.705.894 byte).

| File | Peran |
|---|---|
| `core-memory/decoded-index.html` | **SUMBER UI LIVE** (313.115 byte). Edit tampilan/teks/fitur di sini |
| `config.json` | Nama bot, panggilan user, warna, greeting, avatar, persona |
| `worker-current-live.js` | Bundle Worker (jangan diedit manual) |
| `wrangler.toml` | Konfig deploy + KV + cron |
| `adaptia.sh` | Build + deploy 1 perintah |
| `sync-live.sh` | Tarik asset dari live kalau repo tertinggal |
| `core-memory/` | Snapshot KV, checkpoint/rollback, backup |
| `index.html` (276.801 B) | **BUKAN** sumber live — dipakai jalur web-server.py/Render |

> **Jangan** edit `index.html` untuk custom PWA live. Sumbernya
> `core-memory/decoded-index.html`.

## 3. ALUR DEPLOY

```bash
bash adaptia.sh --dry-run    # build + syntax check, TANPA deploy
bash adaptia.sh              # backup -> build -> inject config -> syntax
                             # -> wrangler deploy -> verify -> sync kembali
bash sync-live.sh            # tarik asset live -> repo (kalau repo tertinggal)
```

`build-worker.js` otomatis **bump patch versi** di `<title>` dan bump
versi cache Service Worker setiap build.

**Status prasyarat deploy:**
- `wrangler` — ✅ terpasang (v4.151.3)
- Git hook secret-scan — ✅ terpasang di `.git/hooks/pre-commit`
- `/root/.cf-token` — ❌ **MASIH BELUM ADA** → satu-satunya blocker deploy

**BUG yang pernah ada (sudah diperbaiki 2026-10-20):**
`scripts/secret-scan.sh` memakai `rg -L`/`rg -E` ala grep, padahal di ripgrep
`-E` artinya `--encoding`. Error-nya lalu ditelan `2>/dev/null`, sehingga scan
**selalu gagal diam-diam dan selalu melaporkan "bersih"** — hook tidak pernah
benar-benar memblokir apa pun. Sudah diganti jadi `rg -e` + gagal jika `rg`
tidak ada (fail-closed). Terverifikasi: token palsu → exit 1 (diblokir).

## 4. STATE SYNC (penting!)

Diverifikasi 2026-10-20:

- `worker-current-live.js` embed HTML **v7.3.302**
- Live mengembalikan **v7.3.312**
- **Diff cuma 2 string versi** (`<title>` + `var VER`), sisanya **identik**
- `core-memory/decoded-index.html` = v7.3.301 (1 versi lebih tua dari bundle)

→ Aman untuk customize dan deploy dari repo. Selisih versi bersifat kosmetik
dan akan naik lagi saat build. **Perlu re-sync dengan `sync-live.sh` dulu
kalau ada deploy manual dari Cloudflare Dashboard setelah 2026-09-25.**

## 5. API LIVE (terverifikasi HTTP 200)

`/api/health` (→ `7.3.4-models-upgrade`, platform `cloudflare-workers`),
`/api/mood`, `/config.json`, `/manifest.json`, `/auth.html`,
`/api/persona`, `/api/identity`, `/api/plugins`.

Endpoint lain yang dipakai: chat, voice, tts, speech, memory, memory-index,
stories, rules, push, search, reminder, registry, model, loose-ends, insights,
greeting, dashboard, build, apply, self, self-monitor, automation.

## 6. HISTORY & KEPUTUSAN

- **2026-09-25** — commit terakhir `f828ddf` (safe-deploy.sh). Sebelumnya
  `5ed35b5` pindahkan kredensial (TG/Gemini/Groq/OpenRouter/KV) ke
  **Cloudflare secrets**, matikan password login, hapus dump bocor,
  tambah secret-scan hook. Repo sudah pernah di-scrub.
- **2026-10-05** — Audit versi PUBLIC `baby-trojan-deploy` (v3.1):
  SyntaxError `web-server.py:403`, NameError `get_memory_context`,
  `/api/health` double-response, `/api/apply` path traversal → RCE,
  session secret hardcoded, Dockerfile salah COPY, SW tak pernah diregister.
  **Versi ini BEDA dari source live — jangan pakai sebagai acuan tanpa cek ulang.**
- **2026-10-20** — `/root/Adaptia` akhirnya terisi source (sebelumnya kosong,
  itulah penyebab Codex "lupa project"). Memori global
  `/root/.codex/AGENTS.md` masih **0 byte**.
- **2026-10-20** — Repo diubah jadi public lalu di-clone ke `/root/Adaptia`.
  `AGENTS.md` (memori project) dibuat — sudah **terverifikasi kebaca otomatis**
  oleh sesi baru di folder ini.
- **2026-10-20** — `wrangler` 4.151.3 terpasang; hook `pre-commit` dipasang;
  bug `rg -E` pada `scripts/secret-scan.sh` diperbaiki (false-negative keamanan).
  **Belum di-commit** — `AGENTS.md` (baru) + `scripts/secret-scan.sh` (diubah).

## 7. CATATAN UNTUK SESI BARU

1. Mulai sesi dengan `cwd = /root/Adaptia` (sudah `trust_level = trusted`).
2. Root cause "Codex lupa" = folder kosong + file memori kosong — sudah diperbaiki.
3. Custom UI/teks → `core-memory/decoded-index.html` + `config.json`, lalu `adaptia.sh`.
4. Sebelum deploy → pastikan `/root/.cf-token` ada dan `wrangler` terinstall.
5. Jangan commit token/key; `scripts/secret-scan.sh` ada untuk itu.
