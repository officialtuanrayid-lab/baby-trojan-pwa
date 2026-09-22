#!/bin/bash
# ============================================
# SYNC-LIVE — sinkronkan worker repo dengan versi yang LIVE
# Digunakan kalau repo tertinggal dari deploy manual.
# ============================================
set -e
cd "$(dirname "$0")"

BASE="https://adaptia.isaacdev.workers.dev"
WORKER="worker-current-live.js"
EDIT_FILE="core-memory/decoded-index.html"
BACKUP="core-memory/backups/prelive-$(date +%Y%m%d-%H%M%S).js"
UA="Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36"

cp "$WORKER" "$BACKUP"
echo "[1/3] Backup: $BACKUP"

TMP=".sync-live-$$"
mkdir -p "$TMP"
trap 'rm -rf "$TMP"' EXIT

echo "[2/3] Sinkronkan asset dari live..."
PATHS=(/ /settings.html /auth.html /config.json /manifest.json /sw.js /background.jpg /avatar-border.png /welcome-icon.png /icons/icon-192.png /icons/icon-512.png)
CHANGED=""
for p in "${PATHS[@]}"; do
  if [ "$p" = "/" ]; then
    fname="index"
  else
    fname="$(echo "$p" | tr '/' '_')"
    fname="${fname#_}"
  fi
  if curl -sL -m 20 -A "$UA" -o "$TMP/$fname" "$BASE$p" && [ -s "$TMP/$fname" ]; then
    if grep -q "Adaptia - Not Found" "$TMP/$fname" 2>/dev/null; then
      echo "  skip $p (not found)"
      continue
    fi
    CHANGED="$CHANGED $p:$fname"
  else
    echo "  skip $p (fetch error)"
  fi
done

python3 - "$WORKER" "$TMP" "$CHANGED" <<'PY'
import sys, base64, re
worker, tmp, changed = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(worker).read()
report = []
for item in changed.split():
    p, fname = item.split(':')
    key = '/index.html' if p == '/' else p
    data = open(tmp + '/' + fname, 'rb').read()
    b64 = base64.b64encode(data).decode()
    pat = re.compile(r"'" + re.escape(key) + r"':\s*'[^']*'")
    if not pat.search(s):
        report.append((p, 'not-in-worker'))
        continue
    s = pat.sub("'%s': '%s'" % (key, b64), s, count=1)
    report.append((p, len(data)))
open(worker, 'w').write(s)
print('  Hasil sync:')
for p, n in report:
    print('    %-20s %s' % (p, (str(n) + ' bytes') if isinstance(n, int) else n))
PY

echo "[3/3] Sinkronkan file edit dari live..."
curl -sL -m 20 -A "$UA" "$BASE/" -o "$EDIT_FILE"
node -e "
  const fs=require('fs');
  const s=fs.readFileSync('$WORKER','utf8');
  const m=s.match(/'\/index\.html':\s*'([^']+)'/);
  const html=Buffer.from(m[1],'base64').toString('utf8');
  const t=(html.match(/<title>([^<]+)<\/title>/)||[])[1]||'?';
  const swm=s.match(/'\/sw\.js':\s*'([^']+)'/);
  const sw=swm?Buffer.from(swm[1],'base64').toString('utf8'):'';
  const cache=(sw.match(/adaptia-s\d+/)||[])[0]||'?';
  console.log('  Worker sekarang:', t, '| SW cache:', cache);
"
echo "=== SELESAI ==="
