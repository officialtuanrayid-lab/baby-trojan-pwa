#!/bin/bash
# ============================================
# ADAPTIA RESTORE SCRIPT — CHECKPOINT v7.3.4-final
# Updated: 2026-09-12
# Deploy CHECKPOINT-STABLE-v7.3.4-final ke Cloudflare Workers
# ============================================

CF_TOKEN=${CF_API_TOKEN:-$(cat /root/Documents/Codex/2026-09-22/gw-pengen-customize-adaptia-pwa/.wrangler/cf-token 2>/dev/null || echo cfut_REMOVED_USE_ENV)}
ACCOUNT_ID="90f83dd411034aaed5bad0c17576c159"
KV_NAMESPACE="20eefddba7ec402792a007453fd153a5"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHECKPOINT="$SCRIPT_DIR/backups/CHECKPOINT-STABLE-v7.3.4-final-20260912.js"

echo "=== ADAPTIA RESTORE (CHECKPOINT v7.3.4-final) ==="

# Fallback: pakai worker-full-backup.js kalau checkpoint gak ada
if [ ! -f "$CHECKPOINT" ]; then
    echo "⚠️ Checkpoint tidak ditemukan, pakai worker-full-backup.js"
    CHECKPOINT="$SCRIPT_DIR/worker-full-backup.js"
fi

if [ ! -f "$CHECKPOINT" ]; then
    echo "❌ ERROR: Tidak ada file backup ditemukan!"
    exit 1
fi

echo "Restoring dari: $CHECKPOINT"
echo "[1/2] Deploying worker..."

RESPONSE=$(curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/adaptia" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -F "metadata={\"body_part\":\"script\",\"bindings\":[{\"name\":\"MEMORY_KV\",\"type\":\"kv_namespace\",\"namespace_id\":\"${KV_NAMESPACE}\"}],\"scheduled_handlers\":[{\"schedule\":\"* * * * *\",\"handler\":\"scheduled\"}]};type=application/json" \
  -F "script=@${CHECKPOINT};type=application/javascript")

SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success','False'))" 2>/dev/null || echo "False")

if [ "$SUCCESS" = "True" ]; then
    echo "✅ Worker deployed successfully!"
else
    echo "❌ Deploy failed!"
    echo "$RESPONSE" | head -c 500
    exit 1
fi

echo ""
echo "[2/2] Verifying..."
sleep 2
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://adaptia.isaacdev.workers.dev/)
HEALTH=$(curl -s https://adaptia.isaacdev.workers.dev/api/health)
if [ "$STATUS" = "200" ]; then
    echo "✅ Adaptia is live!"
    echo "   URL: https://adaptia.isaacdev.workers.dev/"
    echo "   Health: $HEALTH"
    echo ""
    echo "=== RESTORE COMPLETE ==="
    echo "💡 Jangan lupa clear cache browser di HP setelah restore!"
else
    echo "⚠️ Health check returned $STATUS - may need a few seconds to propagate"
fi
