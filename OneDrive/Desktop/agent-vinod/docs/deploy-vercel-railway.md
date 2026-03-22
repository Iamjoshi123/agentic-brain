# Deploy on Vercel + Railway

This is the simplest production setup for this repo:

- `frontend` on Vercel
- `backend` on Railway
- PostgreSQL on Railway
- LiveKit Cloud for meetings
- Qdrant optional at first, recommended after backend is live

## 1. Backend on Railway

Create a new Railway project and add these services:

- `backend` from this repo
- `PostgreSQL`
- optional later: `Qdrant`

For the `backend` service:

- Root Directory: `backend`
- Builder: `Dockerfile`
- Start command: use the Dockerfile default
- Health check path: `/health`

Generate a Railway public domain for the backend and keep that URL. Example:

- `https://your-backend.up.railway.app`

### Backend environment variables

Set these in the Railway `backend` service:

```env
APP_ENV=production
LOG_LEVEL=INFO

DATABASE_URL=${{Postgres.DATABASE_URL}}

BACKEND_URL=https://your-backend.up.railway.app
FRONTEND_URL=https://your-frontend.vercel.app

LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

ENCRYPTION_KEY=generate-a-real-fernet-key

OPENAI_API_KEY=your-openai-key

PLAYWRIGHT_HEADLESS=true
ENABLE_STAGEHAND=false
ENABLE_VOICE=true
VOICE_PROVIDER=openai_realtime
VOICE_TTS_PROVIDER=auto
```

Notes:

- `DATABASE_URL` should come from the Railway Postgres service, not SQLite.
- `ENABLE_STAGEHAND=false` is the easiest production path for now.
- `ENABLE_VOICE=true` keeps the `/meet` experience closer to local.
- `VOICE_PROVIDER=openai_realtime` is the cleanest cloud voice path for this repo.
- The backend Docker image seeds demo data on startup. That is useful for first deployment and testing.

### Optional Qdrant service

If you want vector retrieval in production, add a Qdrant service after the backend is live.

Then set:

```env
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION=demo_brain
```

If you skip Qdrant initially, the app still works with its keyword fallback.

## 2. Frontend on Vercel

Create a new Vercel project from this same repo.

Use these project settings:

- Root Directory: `frontend`
- Framework Preset: `Next.js`
- Build Command: `npm run build`
- Install Command: `npm ci`

### Frontend environment variables

Set this in Vercel:

```env
BACKEND_URL=https://your-backend.up.railway.app
```

Important:

- Do not set `NEXT_PUBLIC_API_URL` for production unless you really want the browser to call Railway directly.
- Leaving `NEXT_PUBLIC_API_URL` empty makes the frontend use Vercel-side `/api` rewrites to the Railway backend.
- That keeps auth cookies and browser requests simpler.

## 3. Deploy order

Use this order:

1. Deploy Railway Postgres
2. Deploy Railway backend
3. Confirm backend health at `/health`
4. Deploy Vercel frontend
5. Open `/admin` on Vercel and sign in
6. Test one `/meet/<token>` link

## 4. First production checks

After both deploy:

- `GET https://your-backend.up.railway.app/health`
- open `https://your-frontend.vercel.app/admin`
- confirm login works
- confirm product list loads
- confirm one meeting page opens
- confirm LiveKit room connects
- confirm microphone + agent voice both work on `/meet/...`

## 5. Admin login

Default bootstrap login comes from app settings:

- email: `admin@demoagent.local`
- password: `demo1234`

Change this after first login, or set your own bootstrap values before deploy:

```env
ADMIN_BOOTSTRAP_ORG_NAME=Your Company
ADMIN_BOOTSTRAP_EMAIL=you@example.com
ADMIN_BOOTSTRAP_PASSWORD=replace-this-now
```
