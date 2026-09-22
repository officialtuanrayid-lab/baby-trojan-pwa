#!/usr/bin/env python3
"""Adaptia Web Chat Server v4 — Render Compatible (Robyn async)"""
import json, time, os, urllib.request, subprocess, uuid, re, threading, asyncio

WEB_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG = {}
try:
    CONFIG = json.load(open(os.path.join(WEB_DIR, "config.json")))
except Exception:
    pass

# Support both env var and local file
GEMINI_KEY = os.environ.get("GEMINI_KEY", "")
if not GEMINI_KEY:
    try:
        local = "/root/.codex/telegram-bridge.json"
        if os.path.exists(local):
            GEMINI_KEY = json.load(open(local)).get("geminiKey", "")
    except Exception:
        pass

VOICE_DIR = os.path.join(WEB_DIR, "voices")
os.makedirs(VOICE_DIR, exist_ok=True)
TTS_VOICE = "id-ID-ArdiNeural"

MIME = {'.html':'text/html','.css':'text/css','.js':'application/javascript',
        '.json':'application/json','.png':'image/png','.svg':'image/svg+xml',
        '.ico':'image/x-icon','.mp3':'audio/mpeg','.jpg':'image/jpeg',
        '.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2',
        '.txt':'text/plain','.gif':'image/gif'}

HISTORY_LOCK = threading.Lock()

def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)

def ai_reply(message, history=None):
    context = CONFIG.get("systemContext") or """Kamu adalah Adaptia, AI partner pribadi untuk Tuan Isaac.
- Panggil "Tuan Isaac" atau "cuy"
- Gaya: santai, gaul, friendly, singkat padat
- Gunakan emoji secukupnya
- Jawab seperti manusia yang mengerti
- Kalau ditanya sesuatu, langsung kasih jawaban
- Panjang jawaban: 1-3 kalimat aja, jangan panjang"""
    model = os.environ.get("GEMINI_MODEL", "gemini-flash-lite-latest")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_KEY}"
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
        log(f"AI Error: {e}")
    return "Gue error nih cuy, coba lagi! 😅"

def generate_tts(text):
    filename = f"tts_{uuid.uuid4().hex[:8]}.mp3"
    filepath = os.path.join(VOICE_DIR, filename)
    clean = re.sub(r'[^\w\s.,!?-]', '', text)
    if len(clean) < 3:
        return None
    try:
        subprocess.run(["edge-tts", "--voice", TTS_VOICE, "--text", clean, "--write-media", filepath],
                       capture_output=True, timeout=15)
        if os.path.exists(filepath) and os.path.getsize(filepath) > 100:
            return filename
    except Exception as e:
        log(f"TTS Error: {e}")
    return None

def load_history():
    hf = os.path.join(WEB_DIR, 'webchat-history.json')
    try:
        with HISTORY_LOCK:
            with open(hf) as f:
                return json.load(f)
    except Exception:
        return []

def save_history(history):
    hf = os.path.join(WEB_DIR, 'webchat-history.json')
    try:
        with HISTORY_LOCK:
            with open(hf, 'w') as f:
                json.dump(history, f, ensure_ascii=False)
    except Exception:
        pass

def serve_static(path):
    fp = os.path.join(WEB_DIR, path.lstrip('/'))
    if not os.path.isfile(fp) or '..' in path:
        return None
    ext = os.path.splitext(fp)[1]
    mime = MIME.get(ext, 'application/octet-stream')
    with open(fp, 'rb') as f:
        data = f.read()
    headers = {"Content-Type": mime}
    if ext == '.html':
        headers["Cache-Control"] = "no-cache"
    return RobynResponse(status_code=200, headers=headers, description=data)

def build_manifest():
    return {
        "name": CONFIG.get("name", "Adaptia"),
        "short_name": CONFIG.get("short_name", "Adaptia"),
        "description": CONFIG.get("description", "AI Partner Pribadi - Tuan Isaac"),
        "start_url": "/",
        "display": "fullscreen",
        "orientation": "portrait",
        "background_color": CONFIG.get("background_color", "#0a0a0f"),
        "theme_color": CONFIG.get("theme_color", "#0a0a0f"),
        "icons": [
            {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
            {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}
        ],
        "categories": ["productivity"],
        "lang": "id"
    }

# ---- Robyn app ----
from robyn import Robyn, Response as RobynResponse

app = Robyn(__file__)

def cors_headers(base=None):
    h = dict(base or {})
    h["Access-Control-Allow-Origin"] = "*"
    return h

def json_resp(data, status=200, cache=False):
    body = json.dumps(data, ensure_ascii=False).encode()
    headers = {"Content-Type": "application/json"}
    if cache:
        headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return RobynResponse(status_code=status, headers=headers, description=body)

@app.get("/")
async def home(request):
    return serve_static("/index.html")

@app.get("/api/health")
async def health_get(request):
    return json_resp({"status": "ok", "voice": "ready", "tts": TTS_VOICE, "gemini": bool(GEMINI_KEY)})

@app.post("/api/health")
async def health_post(request):
    return json_resp({"status": "ok", "voice": "ready", "tts": TTS_VOICE, "gemini": bool(GEMINI_KEY)})

@app.get("/manifest.json")
async def manifest(request):
    return json_resp(build_manifest(), cache=True)

@app.get("/voices/:name")
async def voice_file(request):
    name = request.path_params["name"]
    fp = os.path.join(VOICE_DIR, name)
    if os.path.isfile(fp) and '..' not in name:
        with open(fp, 'rb') as f:
            data = f.read()
        return RobynResponse(status_code=200,
                             headers={"Content-Type": "audio/mpeg", "Cache-Control": "public,max-age=3600"},
                             description=data)
    return RobynResponse(status_code=404, headers={"Content-Type": "text/plain"}, description="Not Found")

@app.post("/api/chat")
async def chat(request):
    try:
        body = request.json() if callable(request.json) else json.loads(request.body)
    except Exception:
        return json_resp({"reply": "Format salah 😅"}, 400)
    message = str(body.get("message", "")).strip()
    voice = bool(body.get("voice", False))
    if not message:
        return json_resp({"reply": "Kosong dong 😅"})
    history = load_history()
    reply = await asyncio.to_thread(ai_reply, message, history)
    history.append({"role": "user", "text": message, "time": time.time()})
    history.append({"role": "bot", "text": reply, "time": time.time()})
    save_history(history[-50:])
    resp = {"reply": reply, "time": time.time()}
    if voice:
        tts = await asyncio.to_thread(generate_tts, reply)
        if tts:
            resp["audio"] = f"/voices/{tts}"
    return json_resp(resp)

@app.post("/api/greeting")
async def greeting(request):
    import random
    greetings = CONFIG.get("greetings") or [
        "Yo Tuan Isaac! Ada yang bisa gue bantu cuy?",
        "Halo Tuan Isaac! Mau ngomong apa nih?",
        "Yo bro! Adaptia ready, speak!",
    ]
    reply = random.choice(greetings)
    resp = {"reply": reply}
    tts = await asyncio.to_thread(generate_tts, reply)
    if tts:
        resp["audio"] = f"/voices/{tts}"
    return json_resp(resp)

@app.options("/:any")
async def opts_any(request):
    return RobynResponse(status_code=200, headers=cors_headers({"Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type"}), description="")

@app.options("/:any/:sub")
async def opts_sub(request):
    return RobynResponse(status_code=200, headers=cors_headers({"Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type"}), description="")

@app.get("/:file")
async def static_file(request):
    name = request.path_params["file"]
    if not name or name.startswith('.'):
        return RobynResponse(status_code=404, headers={"Content-Type": "text/plain"}, description="Not Found")
    res = serve_static("/" + name)
    if res:
        res.headers["Access-Control-Allow-Origin"] = "*"
        return res
    return RobynResponse(status_code=404, headers={"Content-Type": "text/plain"}, description="Not Found")

@app.get("/:dir/:file")
async def static_subdir(request):
    name = "/" + request.path_params["dir"] + "/" + request.path_params["file"]
    if '..' in name:
        return RobynResponse(status_code=404, headers={"Content-Type": "text/plain"}, description="Not Found")
    res = serve_static(name)
    if res:
        res.headers["Access-Control-Allow-Origin"] = "*"
        return res
    return RobynResponse(status_code=404, headers={"Content-Type": "text/plain"}, description="Not Found")

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8767))
    log(f"Adaptia WebChat v4 (Robyn) on port {port} | Voice: {TTS_VOICE}")
    app.start(host="0.0.0.0", port=port, _check_port=False)
