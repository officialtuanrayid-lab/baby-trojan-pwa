#!/usr/bin/env bash
# ============================================================
# Adaptia Safe Deploy — deploy + health check + auto rollback
# Usage:
#   bash scripts/safe-deploy.sh                  # deploy lalu verifikasi, rollback kalau rusak
#   bash scripts/safe-deploy.sh --check [vX.Y.Z] # verifikasi versi aktif sekarang (tanpa deploy)
# Env wajib: CLOUDFLARE_API_TOKEN
# Opsional : WRANGLER_BIN (path wrangler), FILE (default worker-current-live.js)
# ============================================================
set -euo pipefail

ACC="90f83dd411034aaed5bad0c17576c159"
WORKER="adaptia"
BASE="https://api.cloudflare.com/client/v4/accounts/$ACC/workers/scripts/$WORKER"
LIVE="https://adaptia.isaacdev.workers.dev"
FILE="${FILE:-worker-current-live.js}"
WRANGLER=${WRANGLER_BIN:-wrangler}
MODE="deploy"
EXPECTED_TITLE=""

for a in "$@"; do
  case "$a" in
    --check) MODE="check" ;;
    v7.*|7.*) EXPECTED_TITLE="$a" ;;
  esac
done

command -v python3 >/dev/null || { echo "❌ butuh python3"; exit 1; }
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || { echo "❌ CLOUDFLARE_API_TOKEN belum di-set"; exit 1; }

api_get() { # $1 = path endpoint
  python3 -c "
import json,urllib.request,os,sys
try:
    r=urllib.request.Request('$BASE$1', headers={'Authorization':'Bearer '+os.environ['CLOUDFLARE_API_TOKEN']})
    d=json.load(urllib.request.urlopen(r,timeout=30))
    print(json.dumps(d.get('result',{})))
except Exception as e:
    sys.stderr.write('API GET $1 gagal: '+str(e)+'\n'); sys.exit(1)
"
}

active_version() {
  api_get "/deployments" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(d['deployments'][0]['versions'][0]['version_id'])
"
}

rollback_to() { # $1 = version_id
  python3 -c "
import json,urllib.request,os,sys
body=json.dumps({'strategy':'percentage','versions':[{'version_id':'$1','percentage':100}]}).encode()
r=urllib.request.Request('$BASE/deployments', data=body, method='POST',
    headers={'Authorization':'Bearer '+os.environ['CLOUDFLARE_API_TOKEN'],'Content-Type':'application/json'})
try:
    d=json.load(urllib.request.urlopen(r,timeout=60))
    sys.exit(0 if d.get('success') else 1)
except Exception as e:
    sys.stderr.write('rollback API error: '+str(e)+'\n'); sys.exit(1)
"
}

verify_health() {
  local ok=1 i
  for i in 1 2 3; do
    H=$(curl -s -m 20 "$LIVE/api/health" || true)
    if echo "$H" | grep -q '"status":"ok"'; then ok=0; break; fi
    sleep 6
  done
  [ "$ok" = "0" ] || { echo "  ❌ /api/health jelek"; return 1; }
  if [ -n "$EXPECTED_TITLE" ]; then
    T=$(curl -s -m 20 "$LIVE/" | grep -o '<title>[^<]*</title>' | head -1 || true)
    if ! echo "$T" | grep -q "$EXPECTED_TITLE"; then echo "  ❌ title tidak match: $T (harus mengandung $EXPECTED_TITLE)"; return 1; fi
  fi
  S=$(curl -s -m 20 "$LIVE/api/self-monitor" || true)
  if ! echo "$S" | grep -q '"overall":"healthy"'; then echo "  ❌ self-monitor tidak healthy"; return 1; fi
  return 0
}

echo "=== Safe Deploy: $WORKER ($MODE) ==="
PREV=$(active_version)
echo "Versi aktif sekarang: $PREV"

if [ "$MODE" = "check" ]; then
  echo "Mode check saja — tanpa deploy."
  if verify_health; then
    echo "✅ Health OK${EXPECTED_TITLE:+ (title: $EXPECTED_TITLE)}"
    exit 0
  fi
  echo "❌ Verifikasi gagal"; exit 1
fi

echo "Syntax check: $FILE ..."
node --check "$FILE" || { echo "❌ SYNTAX ERROR — batal deploy"; exit 1; }
echo "  OK"

echo "Deploy: $FILE → $WORKER ..."
if ! $WRANGLER deploy "$FILE" --name "$WORKER" 2>&1 | tail -4; then
  echo "❌ Wrangler deploy gagal — versi aktif TIDAK berubah, tidak ada yang di-rollback."
  exit 1
fi
sleep 15
NEW=$(active_version)
echo "Versi baru: $NEW"

if verify_health; then
  echo "✅ Deploy OK — health verified. Versi aktif: $NEW"
  exit 0
fi

echo "❌ Health check GAGAL setelah deploy — rollback ke $PREV ..."
if rollback_to "$PREV"; then
  echo "  Rollback dikirim, menunggu propagasi..."
  sleep 15
  if verify_health; then
    echo "✅ Rollback OK — sehat lagi di versi $PREV"
    exit 0
  fi
  echo "❌ ROLLBACK TERKIRIM TAPI MASIH JELEK — cek manual segera! Versi aktif: $(active_version)"
  exit 1
fi
echo "❌ ROLLBACK API ERROR — cek manual segera! Versi aktif: $(active_version)"
exit 1
