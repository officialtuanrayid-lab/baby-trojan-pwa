#!/bin/bash
# ============================================
# ADAPTIA SAVE-CORE
# Extract core memory dari deployed worker
# Jalankan SETELAH upgrade apapun
# ============================================

CF_TOKEN=${CF_API_TOKEN:-$(cat /root/Documents/Codex/2026-09-22/gw-pengen-customize-adaptia-pwa/.wrangler/cf-token 2>/dev/null || echo cfut_REMOVED_USE_ENV)}
ACCOUNT_ID="90f83dd411034aaed5bad0c17576c159"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== ADAPTIA SAVE-CORE ==="
echo "Extracting core memory from deployed worker..."

# Fetch current worker
curl -s "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/babytrojan" \
  -H "Authorization: Bearer ${CF_TOKEN}" -o /tmp/worker_extract.js

# Extract systemContext
python3 << 'PYEOF'
import re, base64, json, os

SCRIPT_DIR = os.environ.get("SCRIPT_DIR", ".")

with open('/tmp/worker_extract.js', 'r') as f:
    worker = f.read()

# Extract systemContext
m = re.search(r'sysCtx = `([^`]+)`', worker)
if m:
    sysctx = m.group(1)
    with open(os.path.join(SCRIPT_DIR, 'systemContext.txt'), 'w') as f:
        f.write(sysctx)
    print(f"  ✅ systemContext.txt: {len(sysctx)} chars")
else:
    print("  ❌ Could not extract systemContext")

# Extract index.html
m2 = re.search(r"'/index\.html':\s*'([^']+)'", worker)
if m2:
    html = base64.b64decode(m2.group(1)).decode()
    with open(os.path.join(SCRIPT_DIR, '../index.html'), 'w') as f:
        f.write(html)
    print(f"  ✅ index.html: {len(html)} bytes")

# Extract config.json
m3 = re.search(r"'/config\.json':\s*'([^']+)'", worker)
if m3:
    cfg = base64.b64decode(m3.group(1)).decode()
    with open(os.path.join(SCRIPT_DIR, 'config.json'), 'w') as f:
        f.write(cfg)
    print(f"  ✅ config.json saved")

# Extract sw.js
m4 = re.search(r"'/sw\.js':\s*'([^']+)'", worker)
if m4:
    sw = base64.b64decode(m4.group(1)).decode()
    with open(os.path.join(SCRIPT_DIR, 'sw.js'), 'w') as f:
        f.write(sw)
    print(f"  ✅ sw.js saved")

# Save full worker as backup
with open(os.path.join(SCRIPT_DIR, 'worker-full-backup.js'), 'w') as f:
    f.write(worker)
print(f"  ✅ worker-full-backup.js: {len(worker)} bytes")

print()
print("=== CORE MEMORY SAVED ===")
PYEOF

# Git commit
cd "$SCRIPT_DIR/.." && git add core-memory/ && git commit -m "SAVE-CORE: core memory auto-saved $(date +%Y%m%d-%H%M%S)" --quiet 2>/dev/null
echo "  ✅ Git committed"
