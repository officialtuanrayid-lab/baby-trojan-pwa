#!/bin/bash
# Auto-verify loop — jalan terus, verify harian 00:10 UTC (setelah reset kuota KV)
# Pakai: bash scripts/start-auto-verify.sh
BASE="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$BASE/verify-persist.log"
SCRIPT="$BASE/scripts/verify-persist.sh"
echo "$(date -u +%FT%TZ) AUTO-VERIFY LOOP START pid=$$" >> "$LOG"
while true; do
  now=$(date -u +%s)
  off=$(( now % 86400 ))
  if [ "$off" -ge 600 ]; then wait=$(( 86400 - off + 600 )); else wait=$(( 600 - off )); fi
  echo "$(date -u +%FT%TZ) next verify in ${wait}s" >> "$LOG"
  sleep "$wait"
  bash "$SCRIPT" || echo "$(date -u +%FT%TZ) verify error rc=$?" >> "$LOG"
done
