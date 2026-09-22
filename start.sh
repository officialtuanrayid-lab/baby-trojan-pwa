#!/bin/bash
export GEMINI_KEY="AQ.Ab8RN6IQJ-uZl3TxlsVsS2yv04whQfB3lvRXPK5Yrq0fQxJDzg"
cd /root/baby-trojan-render

echo "[1] Starting web server..."
python3 web-server.py 8767 &
SERVER_PID=$!
sleep 2

echo "[2] Server health check..."
curl -s http://127.0.0.1:8767/api/health
echo ""

echo "[3] Starting cloudflare tunnel..."
cloudflared tunnel --url http://127.0.0.1:8767 2>&1 &
TUNNEL_PID=$!
sleep 10

echo "[4] Checking tunnel..."
curl -s http://127.0.0.1:8767/api/health
echo ""
echo "PIDs: server=$SERVER_PID tunnel=$TUNNEL_PID"

# keep alive
wait
