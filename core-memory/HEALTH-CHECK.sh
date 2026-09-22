#!/bin/bash
# Adaptia Autonomous Health Check
# Run: bash /root/baby-trojan-render/core-memory/HEALTH-CHECK.sh

URL="https://adaptia.isaacdev.workers.dev"
ERRORS=0
WARNINGS=0

echo "========================================="
echo "  ADAPTIA HEALTH CHECK - $(date)"
echo "========================================="

# 1. Health endpoint
echo -n "[1] Health endpoint: "
HEALTH=$(curl -s --max-time 5 "$URL/api/health" 2>/dev/null)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "✅ OK"
else
  echo "❌ FAIL - $HEALTH"
  ((ERRORS++))
fi

# 2. Chat response
echo -n "[2] Chat response: "
CHAT=$(curl -s --max-time 10 -X POST "$URL/api/chat" -H "Content-Type: application/json" -d '{"message":"health check"}' 2>/dev/null)
if echo "$CHAT" | grep -q '"reply"'; then
  echo "✅ OK"
else
  echo "❌ FAIL - No reply"
  ((ERRORS++))
fi

# 3. Memory endpoint
echo -n "[3] Memory endpoint: "
MEM=$(curl -s --max-time 5 "$URL/api/memory" 2>/dev/null)
if echo "$MEM" | grep -q '"userName"'; then
  INTERACTIONS=$(echo "$MEM" | python3 -c "import sys,json;print(json.load(sys.stdin).get('interactions',0))" 2>/dev/null)
  echo "✅ OK (interactions: $INTERACTIONS)"
else
  echo "❌ FAIL"
  ((ERRORS++))
fi

# 4. All GET endpoints
echo ""
echo "--- GET Endpoints ---"
for ep in health mood greeting stories memory memory/learn memory/goals memory/notes proactive reminder dashboard knowledge plugins rules identity identity/diary identity/emotion telegram-status; do
  STATUS=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" "$URL/api/$ep" 2>/dev/null)
  if [ "$STATUS" = "200" ]; then
    echo "  ✅ /api/$ep"
  else
    echo "  ❌ /api/$ep ($STATUS)"
    ((ERRORS++))
  fi
done

# 5. All POST endpoints
echo ""
echo "--- POST Endpoints ---"
for ep in memory/learn memory/goals memory/notes proactive identity/diary identity/emotion rules knowledge plugins telegram-notify device; do
  STATUS=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" -X POST "$URL/api/$ep" -H "Content-Type: application/json" -d '{}' 2>/dev/null)
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "500" ]; then
    echo "  ✅ /api/$ep"
  else
    echo "  ❌ /api/$ep ($STATUS)"
    ((ERRORS++))
  fi
done

# 6. Local backup integrity
echo ""
echo "--- Backup Integrity ---"
WORKER_SIZE=$(wc -c < /root/baby-trojan-render/core-memory/worker-full-backup.js 2>/dev/null)
CONTEXT_SIZE=$(wc -c < /root/baby-trojan-render/core-memory/systemContext.txt 2>/dev/null)
BACKUP_COUNT=$(ls /root/baby-trojan-render/core-memory/backups/ 2>/dev/null | wc -l)

echo "  Worker: ${WORKER_SIZE} bytes"
echo "  SystemContext: ${CONTEXT_SIZE} bytes"
echo "  Versioned backups: $BACKUP_COUNT"

if [ "$WORKER_SIZE" -gt 2000000 ]; then
  echo "  ✅ Worker size OK"
else
  echo "  ❌ Worker too small - possible corruption"
  ((ERRORS++))
fi

# 7. Git status
echo ""
echo "--- Git Status ---"
cd /root/baby-trojan-render 2>/dev/null
git log --oneline -1 2>/dev/null

# Summary
echo ""
echo "========================================="
if [ $ERRORS -eq 0 ]; then
  echo "  RESULT: ✅ ALL SYSTEMS STABLE"
else
  echo "  RESULT: ❌ $ERRORS ERRORS FOUND"
fi
echo "========================================="
