#!/bin/bash
# Launcher auto-verify: nohup + detach, tahan banting walau session tutup.
BASE="$(cd "$(dirname "$0")/.." && pwd)"
pid=$(pgrep -f auto-verify-loop.sh | head -1)
if [ -n "$pid" ]; then echo "auto-verify sudah jalan pid=$pid"; exit 0; fi
nohup bash "$BASE/scripts/auto-verify-loop.sh" >/dev/null 2>&1 &
disown
sleep 1
pid=$(pgrep -f auto-verify-loop.sh | head -1)
echo "auto-verify start pid=$pid"
