# Arabic Video Transcriber

A full-stack web application for Arabic video transcription and translation. Paste a YouTube URL or upload a local video file, select a time range, and get a full Arabic transcription, French translation, download the original video with french subtitles, and a structured French article — all powered by Groq Whisper and Google Gemini. No uploaded files are stored, videos are deleted automatically when the analysis is done.


## API Keys

### Groq API Key (free tier available)
1. Go to [https://console.groq.com](https://console.groq.com)
2. Navigate to **API Keys** → **Create API Key**
3. Copy your key (starts with `gsk_...`)

### Google Gemini API Key (free tier available)
1. Go to [https://aistudio.google.com](https://aistudio.google.com)
2. Click **Get API Key** → **Create API Key**


## Run with Docker (no code needed)

**1. Create a project folder with this structure:**
```
my-folder/
├── docker-compose.yml
└── backend/
    └── .env
```

**2. `docker-compose.yml`:**
```yaml
services:
  backend:
    image: hadiosj/khotba-backend:latest
    ports:
      - "8000:8000"
    env_file:
      - backend/.env
    volumes:
      - ./backend/logs:/app/logs
      - ./backend/analyses.db:/app/analyses.db
    restart: unless-stopped

  frontend:
    image: hadiosj/khotba-frontend:latest
    ports:
      - "5173:80"
    depends_on:
      - backend
    restart: unless-stopped
```

**3. `backend/.env`:**
```
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=...
DATABASE_URL=sqlite:///./analyses.db
ALLOWED_ORIGIN=http://localhost:5173
```

**4. Run:**
```bash
docker compose up
```

Open `http://localhost:5173`.

---

## Local Setup (Manual, from source)

**1. Clone and configure:**
```bash
git clone https://github.com/Hadiosj/khotba-transcriber.git
cd khotba-transcriber
cp backend/.env.example backend/.env
```
Open `backend/.env` and set your two API keys:
```
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


## Known Limitations

### YouTube on deployed servers

YouTube actively blocks requests from datacenter/server IPs, which means the YouTube URL feature does not work on a hosted deployment. The UI shows a warning when this tab is selected. This is a known issue with no reliable fix at the moment and will be addressed in a future update.

The feature works normally when running the app locally.
