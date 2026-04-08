# Deployment notes

## Local stack

From the repository root:

```bash
docker compose up --build
```

The backend container runs `alembic upgrade head` on startup, then starts Uvicorn. The API is exposed on port **8000**, PostgreSQL on **5432**, Redis on **6379**.

## Web (Cloudflare Pages or Vercel)

- Set `NEXT_PUBLIC_API_URL` to your public API origin (for example `https://api.example.com`).
- Ensure the FastAPI `BACKEND_CORS_ORIGINS` environment variable includes your web origin.

## Mobile (Expo EAS)

- Set `EXPO_PUBLIC_API_URL` in `mobile/app.config` or EAS secrets to the same public API URL.
- Build with `eas build` after configuring `eas.json` (run `eas init` in `mobile/`).

## EC2 + Docker Compose

1. Install Docker Engine and Docker Compose.
2. Copy the project and create a `.env` with a strong `SECRET_KEY` and database passwords.
3. Optionally add an **nginx** service to `docker-compose.yml` using [nginx.conf](nginx.conf) as a mounted config, and terminate TLS with Let’s Encrypt.
4. Point DNS for your API hostname to the instance; restrict security groups to 80/443 (and SSH if needed).

## Training ML models

With `DATABASE_URL` pointing at your database:

```bash
cd backend
python -m scripts.train_models
```

Artifacts are written to `backend/ml_artifacts/`. Mount or copy that directory into the backend container for inference endpoints to load models.
