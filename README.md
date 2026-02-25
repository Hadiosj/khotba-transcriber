# Arabic Video Transcriber

A full-stack web application for Arabic video transcription and translation. Paste a YouTube URL, select a time range, preview the clip, and get a full Arabic transcription, French translation, and a structured French article — all powered by Groq Whisper and Google Gemini.

---

## Dependencies

**FFmpeg** — must be in PATH:
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg
```

**yt-dlp:**
```bash
pip install yt-dlp
```

---

## API Keys

### Groq API Key (free tier available)
1. Go to [https://console.groq.com](https://console.groq.com)
2. Navigate to **API Keys** → **Create API Key**
3. Copy your key (starts with `gsk_...`)

### Google Gemini API Key (free tier available)
1. Go to [https://aistudio.google.com](https://aistudio.google.com)
2. Click **Get API Key** → **Create API Key**

---

## Local Setup (Manual)

```bash
git clone <your-repo-url>
cd khotba-transcriber
cp backend/.env.example backend/.env
# Fill in your API keys in backend/.env
```

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000` — API docs: `/docs`

---

## Local Setup (Docker)

```bash
# Fill in backend/.env first
docker compose up --build
```

---

## Viewing Logs

```bash
# File
tail -f backend/logs/app.log

# Docker
docker compose logs -f backend
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/video/info` | Fetch video title, duration, thumbnail |
| POST | `/api/video/clip` | Download & stream a video clip |
| POST | `/api/transcribe` | Extract audio + transcribe with Whisper |
| POST | `/api/translate` | Translate + generate article with Gemini |
| GET | `/api/history` | List past analyses (paginated) |
| GET | `/api/history/{id}` | Get full analysis record |
| DELETE | `/api/history/{id}` | Delete an analysis |
| GET | `/api/health` | Health check |

---

## YouTube Cookies (deployed server)

YouTube blocks yt-dlp on server/datacenter IPs. Fix: provide a cookies file from a logged-in YouTube session.

**One-time setup:**

1. Install the **"Get cookies.txt LOCALLY"** browser extension ([Chrome](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) / [Firefox](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/))
2. Go to youtube.com (logged in) → click the extension → **Export** → save as `cookies.txt`
3. Upload to the server as `backend/youtube-cookies.txt`
4. Add to `backend/.env` on the server:
   ```
   YOUTUBE_COOKIES_FILE=/app/youtube-cookies.txt
   ```
5. Restart: `docker compose up -d`

**Refresh:** cookies expire in ~1–2 weeks. Repeat steps 2–3 and restart when you start getting bot errors again.
