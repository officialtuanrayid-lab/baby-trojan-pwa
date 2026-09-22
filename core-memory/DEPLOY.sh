#!/bin/bash
# ============================================
# ADAPTIA DEPLOY v2 — SATU PERINTAH UNTUK SEMUA UPDATE
# Flow: save-checkpoint → build worker (auto-bump versi) → deploy → verify → backup → git commit
# Aturan: CHECKPOINT-STABLE TIDAK PERNAH disentuh (lihat RULES-CHECKPOINT.md)
# ============================================

CF_TOKEN="***REMOVED***"
ACCOUNT_ID="90f83dd411034aaed5bad0c17576c159"
KV_NAMESPACE="20eefddba7ec402792a007453fd153a5"
TEMPLATE_SCRIPT="backups/CHECKPOINT-STABLE-v7.3.4-final-20260912.js"
HTML_SOURCE="decoded-index.html"
WORKER_OUT="worker-latest.js"
DEPLOY_WORKER=""

echo "=== ADAPTIA DEPLOY v2 ==="
echo "Time: $(date +%Y%m%d-%H%M%S)"
cd "$(dirname "$0")" || exit 1

# Label fitur dari argumen (opsional): bash DEPLOY.sh welcome-screen
LABEL="${1:-}"
AREA="${2:-}"
RNAME="${3:-}"
RDESC="${4:-}"

# [1/7] Snapshot ke CHECKPOINT-UPDATE (backup kedua)
echo "[1/7] Snapshot backup kedua..."
if [ -n "$LABEL" ]; then
  bash SAVE-CHECKPOINT.sh "$LABEL"
else
  bash SAVE-CHECKPOINT.sh
fi

# [2/7] Siapkan template worker (pastikan ada)
if [ ! -f "$TEMPLATE_SCRIPT" ]; then
  TEMPLATE_SCRIPT=$(ls -t backups/CHECKPOINT-STABLE-*.js 2>/dev/null | head -1)
fi
if [ -z "$TEMPLATE_SCRIPT" ] || [ ! -f "$TEMPLATE_SCRIPT" ]; then
  echo "❌ Tidak ada CHECKPOINT-STABLE. Abaikan aturan, pakai worker-full-backup.js..."
  TEMPLATE_SCRIPT="worker-full-backup.js"
fi
echo "[2/7] Template worker: $TEMPLATE_SCRIPT"

# [3/7] Cek ada HTML baru yang mau di-deploy
if [ -f "$HTML_SOURCE" ]; then
  echo "[3/7] Build worker dari $HTML_SOURCE (auto-bump versi)..."
  node scripts/build-worker.js "$HTML_SOURCE" "$TEMPLATE_SCRIPT" "$WORKER_OUT"
  if [ $? -ne 0 ]; then echo "❌ Build gagal!"; exit 1; fi
  DEPLOY_WORKER="$WORKER_OUT"
else
  echo "[3/7] Tidak ada $HTML_SOURCE, deploy template langsung..."
  DEPLOY_WORKER="$TEMPLATE_SCRIPT"
fi

# [4/7] Deploy ke Cloudflare
echo "[4/7] Deploy $DEPLOY_WORKER..."
RESPONSE=$(curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/adaptia" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -F "metadata={\"body_part\":\"script\",\"bindings\":[{\"name\":\"MEMORY_KV\",\"type\":\"kv_namespace\",\"namespace_id\":\"${KV_NAMESPACE}\"}],\"scheduled_handlers\":[{\"schedule\":\"* * * * *\",\"handler\":\"scheduled\"}]};type=application/json" \
  -F "script=@${DEPLOY_WORKER};type=application/javascript")

SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success','False'))" 2>/dev/null || echo "False")
if [ "$SUCCESS" != "True" ]; then
  echo "❌ Deploy gagal!"
  echo "$RESPONSE" | head -c 600
  exit 1
fi
echo "✅ Deploy sukses!"

# [4b/7] Auto-register upgrade ke kategori Otak/Tubuh/Jiwa
if [ -n "$RNAME" ]; then
  echo "[4b/7] Register upgrade: area='${AREA:-auto}' name='$RNAME'..."
  curl -s -m 20 -X POST "https://adaptia.isaacdev.workers.dev/api/registry" \
    -H "Content-Type: application/json" \
    -d '{"name":"'"$RNAME"'","area":"'"$AREA"'","desc":"'"$RDESC"'"}' >/dev/null 2>&1 && echo "   Registered OK" || echo "   ⚠️ Register gagal (kemungkinan kuota KV)"
fi

# [5/7] Backup aktif (BUKAN stable)
cp "$DEPLOY_WORKER" "backups/POST-DEPLOY-$(date +%Y%m%d-%H%M%S).js"
cp "$DEPLOY_WORKER" worker-full-backup.js
echo "[5/7] worker-full-backup.js + POST-DEPLOY disimpan (CHECKPOINT-STABLE tetap aman)"

# [6/7] Verifikasi
echo "[6/7] Verifikasi..."
sleep 2
HTTP=$(curl -s -o /dev/null -w "%{http_code}" https://adaptia.isaacdev.workers.dev/)
HEALTH=$(curl -s https://adaptia.isaacdev.workers.dev/api/health)
echo "   HTTP: $HTTP"
echo "   Health: $HEALTH"
if [ "$HTTP" != "200" ]; then
  echo "⚠️ HTTP bukan 200 — cek manual, mungkin butuh beberapa detik."
fi

# [7/7] Git commit + push GitHub otomatis
GITHUB_TOKEN="***REMOVED***"
echo "[7/7] Git commit + push..."
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  cd /root/baby-trojan-render
  TITLE=$(node -e "
    const fs=require('fs');
    const w=fs.readFileSync('core-memory/worker-latest.js','utf8');
    const m=w.match(/'\/index\.html':\s*'([^']+)'/);
    const h=m ? Buffer.from(m[1],'base64').toString('utf8') : '';
    const t=h.match(/<title>([^<]+)<\/title>/);
    console.log(t ? t[1] : 'ADAPTIA');
  " 2>/dev/null || echo "ADAPTIA")
  git add -A
  git commit -m "deploy: ${TITLE}" --quiet && echo "✅ Commit: $(git log --oneline -1)" || echo "ℹ️ Tidak ada perubahan untuk di-commit"
  # Push ke GitHub (repo officialtuanrayid-lab/baby-trojan-pwa, PRIVATE)
  if [ -n "$GITHUB_TOKEN" ]; then
    git push "https://x-access-token:${GITHUB_TOKEN}@github.com/officialtuanrayid-lab/baby-trojan-pwa.git" main --quiet && echo "✅ Push ke GitHub: origin/main" || echo "⚠️ Push gagal — cek token GitHub"
  fi
else
  echo "ℹ️ Bukan git repo, skip commit"
fi

echo ""
echo "=== DEPLOY SELESAI ==="
echo "URL: https://adaptia.isaacdev.workers.dev/"
echo "💡 User: jangan lupa refresh browser / cek di HP. Versi baru otomatis ke-load karena auto-bump."
