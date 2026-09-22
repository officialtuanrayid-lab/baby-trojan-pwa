#!/bin/bash
# ============================================
# ADAPTIA CUSTOMIZE — edit → build → deploy → verify
# Cara pakai:
#   1. Edit core-memory/decoded-index.html  (tampilan/teks/fitur)
#   2. Edit config.json                     (nama, panggilan, warna, greeting)
#   3. bash adaptia.sh                      (otomatis semuanya)
#   4. bash adaptia.sh --dry-run            (tes build tanpa deploy)
# ============================================
set -e
cd "$(dirname "$0")"

DRY=0
if [ "${1:-}" = "--dry-run" ]; then DRY=1; fi

EDIT_FILE="core-memory/decoded-index.html"
TEMPLATE="worker-current-live.js"
OUTPUT="worker-latest.js"

# [0] Kalau file edit belum ada, decode dari worker terakhir (selalu sinkron)
if [ ! -f "$EDIT_FILE" ]; then
  echo "[0/6] Decode file edit dari worker terakhir..."
  node -e "
    const fs=require('fs');
    const s=fs.readFileSync('$TEMPLATE','utf8');
    const m=s.match(/'\/index\.html':\s*'([^']+)'/);
    if(!m){ console.error('Tidak ketemu asset /index.html'); process.exit(1); }
    fs.writeFileSync('$EDIT_FILE', Buffer.from(m[1],'base64').toString('utf8'));
  "
fi

# [1] Backup worker yang lagi jalan
BACKUP="core-memory/backups/predeploy-$(date +%Y%m%d-%H%M%S).js"
cp "$TEMPLATE" "$BACKUP"
echo "[1/6] Backup: $BACKUP"

# [2] Build worker baru dari file edit + template terakhir
echo "[2/6] Build worker baru..."
node core-memory/scripts/build-worker.js "$EDIT_FILE" "$TEMPLATE" "$OUTPUT"

# [3] Sinkronkan config.json ke dalam worker
echo "[3/6] Sinkronkan config.json..."
node -e "
  const fs=require('fs');
  let w=fs.readFileSync('$OUTPUT','utf8');
  const cfg=fs.readFileSync('config.json','utf8');
  JSON.parse(cfg); // validasi
  const b64=Buffer.from(cfg,'utf8').toString('base64');
  if(!/'\/config\.json':\s*'[^']+'/.test(w)){
    console.error('Asset /config.json tidak ketemu di worker'); process.exit(1);
  }
  w=w.replace(/'\/config\.json':\s*'[^']+'/, \"'/config.json': '\" + b64 + \"'\");
  fs.writeFileSync('$OUTPUT', w);
"

# [4] Syntax check
echo "[4/6] Syntax check..."
node --check "$OUTPUT"

if [ "$DRY" = "1" ]; then
  echo "[5/6] DRY-RUN (tanpa deploy)"
  CLOUDFLARE_API_TOKEN="$(cat /root/.cf-token)" wrangler deploy "$OUTPUT" --config wrangler.toml --dry-run 2>&1 | tail -n 12
  echo "[6/6] Selesai (dry-run). File siap: $OUTPUT"
  exit 0
fi

# [5] Deploy
echo "[5/6] Deploy ke Cloudflare..."
CLOUDFLARE_API_TOKEN="$(cat /root/.cf-token)" wrangler deploy "$OUTPUT" --config wrangler.toml 2>&1 | tail -n 14

# [6] Verify
echo "[6/6] Verify live..."
sleep 3
curl -s -m 15 "https://adaptia.isaacdev.workers.dev/api/health"
echo ""
# Sync: worker-current-live.js = versi yang baru ter-deploy
cp "$OUTPUT" "$TEMPLATE"
# Sync versi ke file edit biar tiap deploy berikutnya naik versi lagi
node -e "
  const fs=require('fs');
  const s=fs.readFileSync('$OUTPUT','utf8');
  const m=s.match(/'\/index\.html':\s*'([^']+)'/);
  if(m) fs.writeFileSync('$EDIT_FILE', Buffer.from(m[1],'base64').toString('utf8'));
"
echo "=== SELESAI (worker + versi file edit disinkron) ==="
