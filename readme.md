# FlockLedger

Poultry farm management: egg production, feed, tray stock, sales, expenses, and analytics. This monorepo contains a **FastAPI** backend, **Next.js** dashboard, and **Expo** mobile app.

## Prerequisites

- Docker Desktop (optional, for Postgres/Redis/backend/nginx)
- Node.js 20+ and npm
- Python 3.12+ (for local backend without Docker)

## Quick start (Docker)

1. Put API secrets in [`backend/.env`](backend/.env) (see [`backend/.env.example`](backend/.env.example)). For **Neon**, set `DATABASE_URL` to your full Neon URL; you do **not** need the bundled Postgres container.
2. From the repo root:

```bash
docker compose up --build
```

- API: [http://localhost:8000](http://localhost:8000) (OpenAPI: `/docs`)
- Nginx proxy: [http://localhost:8080](http://localhost:8080)
- Redis on the host (optional): `localhost:6380` maps to the container

**Bundled Postgres (optional):** if something on your machine already uses port `5432`, either keep using Neon only, or start the stack with Postgres on profile `local-db` (published as **`localhost:5433`**):

```bash
docker compose --profile local-db up --build
```

Set `DATABASE_URL=postgresql://flock:flock@postgres:5432/flockledger` in `backend/.env` when using that profile (inside Docker the hostname is still `postgres`, port `5432`). The backend entrypoint waits for that host so startup order stays safe even without `depends_on` (Compose cannot reference a profile-only service there).

The backend container runs **Alembic migrations** on startup.

## Web dashboard

```bash
cd web
cp .env.local.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register, create a farm under **Settings**, add sheds, then use **Production**, **Feed**, **Sales**, and **Analytics**.

Set `NEXT_PUBLIC_API_URL` in `.env.local` if the API is not on `http://localhost:8000`.

## Mobile (Expo)

```bash
cd mobile
cp .env.example .env
npm install
npx expo start
```

Set `EXPO_PUBLIC_API_URL` to a URL your phone or emulator can reach (for Android emulator, `http://10.0.2.2:8000` often works).

## Backend only (local Python)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## ML training (optional)

With `DATABASE_URL` set and enough historical rows:

```bash
cd backend
python -m scripts.train_models
```

Models are saved under `backend/ml_artifacts/`. Prediction endpoints are under `/farms/{farm_id}/ml/`.

## Deployment

See [infra/DEPLOY.md](infra/DEPLOY.md) and [infra/nginx.conf](infra/nginx.conf).

## Layout

| Path | Description |
|------|-------------|
| `backend/` | FastAPI app, Alembic, Docker image |
| `web/` | Next.js (App Router) dashboard |
| `mobile/` | Expo React Native worker app |
| `infra/` | Example nginx config and deploy notes |
