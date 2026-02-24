# Khotba Transcriber

A full-stack web application for Arabic lecture (khotba) transcription and translation. Paste a YouTube URL, select a time range, preview the clip, and get a full Arabic transcription, French translation, and a structured French article — all powered by Groq Whisper and Google Gemini.

---

## Features

- **YouTube clip extraction** — select any time range up to 30 minutes
- **Arabic transcription** — via Groq's `whisper-large-v3-turbo` with timestamped segments
- **French translation** — segment-by-segment via Gemini 2.5/3 Flash
- **Structured French article** — auto-generated with sections, headings, and citations
- **History panel** — browse and reload past analyses without reprocessing
- **RTL support** — Noto Naskh Arabic font for transcription display
- **Persistent storage** — SQLite (swappable to PostgreSQL with zero code changes)
- **Rotating logs** — structured log file, max 5MB × 3 files

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.12+ | Backend runtime |
| Node.js | 20+ | Frontend build |
| FFmpeg | any recent | Must be in PATH |
| yt-dlp | latest | Installed via pip |
| Docker + Compose | optional | For containerized setup |

### Install FFmpeg

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows — download from https://ffmpeg.org/download.html and add to PATH
```

---

## API Keys

### Groq API Key (free tier available)
1. Go to [https://console.groq.com](https://console.groq.com)
2. Sign up / log in
3. Navigate to **API Keys** → **Create API Key**
4. Copy your key (starts with `gsk_...`)

### Google Gemini API Key (free tier available)
1. Go to [https://aistudio.google.com](https://aistudio.google.com)
2. Sign in with a Google account
3. Click **Get API Key** → **Create API Key**
4. Copy your key

---

## Local Setup (Manual)

### 1. Clone and configure

```bash
git clone <your-repo-url>
cd khotba-transcriber

# Backend .env
cp backend/.env.example backend/.env
# Edit backend/.env and fill in your API keys
```

Your `backend/.env` should look like:
```env
GROQ_API_KEY=gsk_your_key_here
GEMINI_API_KEY=your_gemini_key_here
DATABASE_URL=sqlite:///./analyses.db
ALLOWED_ORIGIN=http://localhost:5173
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`.
API docs: `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## Local Setup (Docker)

```bash
# Edit backend/.env first (see above)
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

Logs and the SQLite database are mounted as volumes so data persists across restarts.

---

## Viewing Logs

```bash
# Tail live logs
tail -f backend/logs/app.log

# Or with Docker
docker compose logs -f backend
```

Log format:
```
[2025-06-01 14:32:10] INFO | downloader.py | Video info fetched: "Title" (duration: 3420s) in 1.23s
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

## Models Used

| Task | Model |
|------|-------|
| Transcription | `whisper-large-v3-turbo` (Groq) |
| Translation + Article | `gemini-2.5-flash` and `gemini-3-flash-preview` (Google) |

Model names are defined in `backend/utils/models_config.py` for easy updates.

---

## Deploying to Production

See [DEPLOYMENT.md](DEPLOYMENT.md) for a complete step-by-step guide to deploy this app on a VPS using Docker Compose — the easiest and cheapest option.

---

## Troubleshooting

**`yt-dlp: command not found`**
```bash
pip install yt-dlp
# or upgrade: pip install -U yt-dlp
```

**`ffmpeg: command not found`**
Install FFmpeg and ensure it's in your PATH.

**`GROQ_API_KEY is not set`**
Check that `backend/.env` exists and has the correct key.

**Clip download is slow**
yt-dlp downloads only the selected segment. Large segments or slow connections will take longer.

**Rate limit errors from Groq/Gemini**
Both offer generous free tiers. If you hit limits, wait a moment and retry.
