"""Baby Trojan API — Vercel Serverless"""
import json, os, subprocess, uuid, re, time, urllib.request

WEB_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(WEB_DIR, "config.json")
try:
    with open(CONFIG_PATH) as f:
        CONFIG = json.load(f)
except:
    CONFIG = {}

GEMINI_KEY = os.environ.get("GEMINI_KEY", "")
TTS_VOICE = "id-ID-ArdiNeural"

def ai_reply(message, history=None):
    if not GEMINI_KEY:
        return "Gemini key belum diset cuy! 😅"
    context = CONFIG.get("systemContext", "Kamu adalah Baby Trojan. Panggil user Tuan Trojan atau cuy. Gaya santai gaul friendly.")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={GEMINI_KEY}"
    contents = []
    if history:
        for h in history[-6:]:
            role = "user" if h.get("role") == "user" else "model"
            contents.append({"role": role, "parts": [{"text": h.get("text", "")}]})
    contents.append({"role": "user", "parts": [{"text": message}]})
    body = json.dumps({
        "system_instruction": {"parts": [{"text": context}]},
        "contents": contents,
        "generationConfig": {"maxOutputTokens": 200, "temperature": 0.85}
    }).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read())
            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            if parts:
                return parts[0].get("text", "").strip()
    except Exception as e:
        return f"Error: {str(e)}"
    return "Gue error nih cuy, coba lagi! 😅"

def handler(request):
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }
    
    if request.get("method") == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}
    
    path = request.get("path", "/")
    
    if path == "/api/health":
        return {"statusCode": 200, "headers": {**headers, "Content-Type": "application/json"},
                "body": json.dumps({"status": "ok", "voice": "ready", "tts": TTS_VOICE, "gemini": bool(GEMINI_KEY)})}
    
    if path == "/api/chat" and request.get("method") == "POST":
        body = json.loads(request.get("body", "{}"))
        message = body.get("message", "").strip()
        voice = body.get("voice", False)
        if not message:
            return {"statusCode": 200, "headers": {**headers, "Content-Type": "application/json"},
                    "body": json.dumps({"reply": "Kosong dong 😅"})}
        reply = ai_reply(message)
        resp_data = {"reply": reply, "time": time.time()}
        return {"statusCode": 200, "headers": {**headers, "Content-Type": "application/json"},
                "body": json.dumps(resp_data, ensure_ascii=False)}
    
    if path == "/api/greeting":
        greetings = CONFIG.get("greetings", ["Yo Tuan Trojan! Ada yang bisa gue bantu cuy?"])
        import random
        reply = random.choice(greetings)
        return {"statusCode": 200, "headers": {**headers, "Content-Type": "application/json"},
                "body": json.dumps({"reply": reply}, ensure_ascii=False)}
    
    return {"statusCode": 404, "headers": headers, "body": "Not found"}

# For Vercel
from http.server import BaseHTTPRequestHandler

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._handle()
    def do_POST(self):
        self._handle()
    def do_OPTIONS(self):
        self._handle()
    
    def _handle(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode() if content_length > 0 else ""
        
        request = {
            "method": self.command,
            "path": self.path,
            "body": body,
            "headers": dict(self.headers)
        }
        
        result = handler(request)
        
        self.send_response(result["statusCode"])
        for k, v in result.get("headers", {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(result.get("body", "").encode())
    
    def log_message(self, *a): pass

if __name__ == "__main__":
    from http.server import HTTPServer
    HTTPServer(("0.0.0.0", int(os.environ.get("PORT", 8080))), Handler).serve_forever()
