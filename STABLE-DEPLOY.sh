#!/bin/bash
# Adaptia Stable Deploy Script
# Usage: bash STABLE-DEPLOY.sh

ACC="90f83dd411034aaed5bad0c17576c159"
TOKEN="cfut_REMOVED"
WORKER="adaptia"
BACKUP="/root/baby-trojan-render/core-memory/worker-full-backup.js"

echo "=== Adaptia Deploy ==="

# Step 1: Syntax check
echo "[1/3] Syntax check..."
node -e "
const fs = require('fs');
const https = require('https');
const w = fs.readFileSync('$BACKUP', 'utf8');
const m = w.match(/'\/index\.html':\s*'([A-Za-z0-9+/=]*)'/);
if (!m) { console.log('FAIL: No index.html found'); process.exit(1); }
const html = Buffer.from(m[1], 'base64').toString();
const sm = html.match(/<script>([\s\S]*?)<\/script>/);
if (!sm) { console.log('FAIL: No script found'); process.exit(1); }
try { new Function(sm[1]); console.log('PASS'); } catch(e) { console.log('FAIL: ' + e.message); process.exit(1); }
" || { echo "SYNTAX ERROR - Aborting!"; exit 1; }

# Step 2: Deploy
echo "[2/3] Deploying..."
HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/$ACC/workers/scripts/$WORKER" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/javascript" \
  --data-binary "@$BACKUP")

if [ "$HTTP_CODE" = "200" ]; then
  echo "  Deploy OK"
else
  echo "  Deploy FAILED (HTTP $HTTP_CODE)"
  exit 1
fi

# Step 3: Verify
echo "[3/3] Verifying..."
HEALTH=$(curl -sS --max-time 10 "https://adaptia.isaacdev.workers.dev/api/health" 2>&1)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "  Health: OK"
else
  echo "  Health: FAILED"
  exit 1
fi

echo ""
echo "=== Deploy Complete! ==="
echo "URL: https://adaptia.isaacdev.workers.dev/"
