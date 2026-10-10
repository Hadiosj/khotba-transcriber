# Arabic Video Transcriber

> **Status: Currently Disabled on `sudev.ai` (Archived for future revamp)**
> This app was previously deployed at `https://sudev.ai/transcriber`. It has been temporarily stopped on the production server to conserve VPS resources and clean up routing until revamped.

A full-stack web application for Arabic video transcription and translation. Paste a YouTube URL or upload a local video file, select a time range, and get a full Arabic transcription, French translation, downloadable video with French subtitles, and a structured French article — powered by Groq Whisper and Google Gemini.

---

## Current State & Known Issues

1. **YouTube Scraper / Proxying**:
   - YouTube blocks requests originating from datacenter / VPS IP addresses (such as Hetzner).
   - The app previously used a Webshare residential proxy pool (`WEBSHARE_PROXY_URL`) to circumvent this. The proxy subscription was discontinued, so **YouTube downloads currently fail on the server** (local execution may still work).
2. **Outdated AI Models**:
   - Model definitions in `backend/utils/models_config.py` use older preview tags and need updating to current stable model endpoints.
3. **Root `/api` Routing Conflict**:
   - The frontend and backend were hardcoded to route API traffic to `/api/*` at the domain root rather than `/transcriber/api/*`.
4. **CI/CD Branch Mismatch**:
   - `.github/workflows/deploy.yml` references branch `main`, while the repository's primary branch is `master`.

---

## Roadmap to Revive & Modernize

When picking this project back up:

- [ ] **Drop YouTube Proxy Dependency**: Shift focus to **direct drag-and-drop video/audio upload** (and/or client-side audio extraction). Eliminating datacenter yt-dlp dependencies makes the app 100% reliable and zero-cost to host.
- [ ] **Update AI Models**: Update `models_config.py` to use:
  - Transcription: Groq `whisper-large-v3-turbo` (fast, low-cost).
  - Translation & Summarization: Current stable Google Gemini Flash models.
- [ ] **Nest API Prefix**:
  - Update FastAPI router prefixes in `backend/main.py` to `/transcriber/api`.
  - Update Nginx config and frontend `VITE_API_BASE_URL` to match.
- [ ] **Add Basic Rate Limiting / Protection**: Guard against unauthenticated users exhausting Groq/Gemini API quotas.
- [ ] **Fix CI/CD**: Standardize git branch to `main` and verify GitHub Actions SSH deploy secrets.
- [ ] **Re-enable in Caddy**: Re-add the reverse proxy block in `/etc/caddy/Caddyfile` for `localhost:8080`.

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

## Local Setup (Manual, from source)

**1. Clone and configure:**
```bash
git clone https://github.com/Hadiosj/khotba-transcriber.git
cd khotba-transcriber
cp backend/.env.example backend/.env
```
Open `backend/.env` and set your two API keys:
```env
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=...
```

**2. Install FFmpeg** (must be in PATH):
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg
```

**3. Start the backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**4. Start the frontend** (in a separate terminal):
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Backend API docs at `http://localhost:8000/docs`.

---

## Viewing Logs

```bash
# File
tail -f backend/logs/app.log

# Docker
docker compose logs -f backend
```
