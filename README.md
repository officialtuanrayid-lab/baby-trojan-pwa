# Adaptia 🤖

AI Partner Pribadi untuk Tuan Trojan

## Features
- 💬 Real-time AI Chat (Gemini)
- 🎤 Voice messages (edge-tts)
- 📱 Installable PWA
- 🎨 Custom dark theme with cyan accents
- 📖 WhatsApp-style stories

## Deploy to Render
1. Push repo to GitHub
2. Go to [render.com](https://render.com)
3. New > Web Service > Connect GitHub repo
4. Set env var `GEMINI_KEY` = your Gemini API key
5. Deploy!

## Local Run
```bash
pip install -r requirements.txt
GEMINI_KEY=your_key python3 web-server.py 8767
```

## Customize (Cloudflare Workers) — alur cepat

Ada 2 file yang biasa diedit:

- `core-memory/decoded-index.html` — semua tampilan, teks, fitur, dan perilaku UI
- `config.json` — nama bot, panggilan user, warna aksen, greeting, avatar

Setelah edit, deploy dalam 1 perintah:

```bash
bash adaptia.sh            # backup → build → bump versi → deploy → verify
bash adaptia.sh --dry-run  # tes build & bundle tanpa deploy
```

File edit otomatis di-decode dari worker terakhir kalau belum ada, dan
`worker-current-live.js` ikut disinkron setelah deploy sukses.
