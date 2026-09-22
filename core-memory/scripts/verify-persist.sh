#!/bin/bash
# Auto-verify: pastikan memori persist normal setelah reset kuota (00:00 UTC)
# Output log: <repo>/verify-persist.log (fixed, tidak tergantung cwd)
BASE="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$BASE/verify-persist.log"
BASE_URL="https://adaptia.isaacdev.workers.dev"
MARKER="vpersist$(date +%s)"
PASS=0; FAIL=0
say(){ echo "$(date -u +%FT%TZ) $1" >> "$LOG"; }
say "=== VERIFY PERSIST START ==="
# 0) Version check
VC=$(curl -s --max-time 30 "$BASE_URL/" | grep -o "<title>[^<]*</title>" | head -1)
if echo "$VC" | grep -q "v7\.3\."; then say "PASS version ($VC)"; PASS=$((PASS+1)); else say "FAIL version ($VC)"; FAIL=$((FAIL+1)); fi
# 1) Chat harus nyangkut di chat_history (retry bila POST model lambat)
HA=0
for TRY in 1 2 3; do
  curl -s -X POST "$BASE_URL/api/chat" -H "Content-Type: application/json" \
    -d "{\"message\":\"$MARKER cek simpan memori\",\"history\":[]}" --max-time 150 >/dev/null
  sleep 4
  H=$(curl -s "$BASE_URL/api/chat/history?limit=8&x=$RANDOM" --max-time 30)
  if echo "$H" | grep -q "$MARKER"; then HA=1; break; fi
  say "chat_history retry $TRY (POST lambat/empty)"
done
if [ "$HA" = "1" ]; then say "PASS chat_history"; PASS=$((PASS+1)); else say "FAIL chat_history"; FAIL=$((FAIL+1)); fi
# 2) Rule via worker harus persist ke KV, lalu dibersihkan
curl -s -X POST "$BASE_URL/api/rules" -H "Content-Type: application/json" \
  -d "{\"action\":\"add\",\"rule\":\"VERIFY $MARKER\",\"message\":\"x\"}" --max-time 30 >/dev/null
RP=""; RPA=0
for TRY in 1 2 3; do
  sleep 3
  RP=$(curl -s "$BASE_URL/api/rules?x=$RANDOM" --max-time 30)
  if echo "$RP" | grep -q "$MARKER"; then RPA=1; break; fi
  say "rules persist retry $TRY (timeout/empty)"
done
if [ "$RPA" = "1" ]; then say "PASS rules persist"; PASS=$((PASS+1)); else say "FAIL rules persist"; FAIL=$((FAIL+1)); fi
curl -s -X POST "$BASE_URL/api/rules" -H "Content-Type: application/json" \
  -d "{\"action\":\"remove\",\"query\":\"VERIFY $MARKER\"}" --max-time 30 >/dev/null
# 3) Self-monitor masih healthy
M=$(curl -s "$BASE_URL/api/self-monitor?x=$RANDOM" --max-time 30)
if echo "$M" | grep -q '"overall":"healthy"'; then
  say "PASS self-monitor"; PASS=$((PASS+1))
elif echo "$M" | grep -q '"overall":"degraded"' && echo "$M" | grep -q '"kv":{"status":"ok"}'; then
  say "PASS self-monitor (degraded: model quota, sistem ok)"; PASS=$((PASS+1))
else
  say "FAIL self-monitor"; FAIL=$((FAIL+1))
fi
say "RESULT: PASS=$PASS FAIL=$FAIL"
say "=== VERIFY PERSIST END ==="
