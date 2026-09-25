#!/bin/bash
# ============================================
# ADAPTIA ROLLBACK — kembali ke versi sebelumnya
# Opsi 1: Rollback via Cloudflare Deployments (kalau token punya akses)
# Opsi 2: Restore dari checkpoint lokal (pasti jalan)
# ============================================

CF_TOKEN=${CF_API_TOKEN:-$(cat /root/Documents/Codex/2026-09-22/gw-pengen-customize-adaptia-pwa/.wrangler/cf-token 2>/dev/null || echo cfut_REMOVED_USE_ENV)}
ACCOUNT_ID="90f83dd411034aaed5bad0c17576c159"
BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)/backups"

echo "=== ADAPTIA ROLLBACK ==="
echo ""

# [Opsi 1] Coba Cloudflare Deployments API
echo "[1] Cek Cloudflare Deployments..."
DEPLOYS=$(curl -s "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/adaptia/deployments" \
  -H "Authorization: Bearer ${CF_TOKEN}")
SUCCESS=$(echo "$DEPLOYS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success','False'))" 2>/dev/null || echo "False")

if [ "$SUCCESS" = "True" ]; then
  echo "✅ Cloudflare Deployments tersedia!"
  DEPLOYMENT_ID=$(echo "$DEPLOYS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d.get('result',{}).get('deployments',[]) or []
items.sort(key=lambda x: x.get('created_on',''), reverse=True)
if not items:
    print(''); raise SystemExit
# deployment TERBARU = yang aktif, rollback ke yang SEBELUMNYA (index 1)
if len(items) >= 2:
    print(items[1]['id'])
else:
    print('')
" 2>/dev/null)
  if [ -n "$DEPLOYMENT_ID" ]; then
    echo "   Deployment sebelumnya: $DEPLOYMENT_ID"
    echo "   Rollback..."
    RL=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/adaptia/deployments/${DEPLOYMENT_ID}/rollback" \
      -H "Authorization: Bearer ${CF_TOKEN}")
    echo "$RL" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅' if d.get('success') else '❌ '+json.dumps(d.get('errors')))" 2>/dev/null
    echo ""
    echo "=== ROLLBACK CLOUDFLARE SELESAI ==="
    exit 0
  else
    echo "   Tidak ada deployment sebelumnya yang bisa di-rollback, lanjut ke opsi lokal."
  fi
else
  echo "ℹ️ Token tidak punya akses Deployments API, pakai checkpoint lokal."
fi

echo ""
# [Opsi 2] Restore checkpoint lokal
echo "[2] Pilih checkpoint lokal untuk restore:"
echo "   1) CHECKPOINT-STABLE (MASTER — yang sudah Tuan Isaac validasi)"
echo "   2) CHECKPOINT-UPDATE terbaru (snapshot sebelum update terakhir)"
echo ""
read -rp "Pilih [1/2]: " CHOICE

case "$CHOICE" in
  2)
    FILE=$(ls -t "$BACKUP_DIR"/CHECKPOINT-UPDATE-*.js 2>/dev/null | head -1)
    ;;
  *)
    FILE=$(ls -t "$BACKUP_DIR"/CHECKPOINT-STABLE-*.js 2>/dev/null | head -1)
    ;;
esac

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "❌ Checkpoint tidak ditemukan!"
  exit 1
fi

echo "   Restore dari: $(basename "$FILE")"
echo "   Deploying..."
RESP=$(curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/adaptia" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -F "metadata={\"body_part\":\"script\",\"bindings\":[{\"name\":\"MEMORY_KV\",\"type\":\"kv_namespace\",\"namespace_id\":\"20eefddba7ec402792a007453fd153a5\"}],\"scheduled_handlers\":[{\"schedule\":\"* * * * *\",\"handler\":\"scheduled\"}]};type=application/json" \
  -F "script=@${FILE};type=application/javascript")

SUCCESS=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success','False'))" 2>/dev/null || echo "False")
if [ "$SUCCESS" = "True" ]; then
  echo "✅ Restore sukses!"
  cp "$FILE" worker-full-backup.js
  sleep 2
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" https://adaptia.isaacdev.workers.dev/)
  echo "   Live HTTP: $HTTP"
  echo ""
  echo "=== RESTORE SELESAI ==="
  echo "💡 Jangan lupa clear cache browser di HP!"
else
  echo "❌ Restore gagal!"
  echo "$RESP" | head -c 400
  exit 1
fi
