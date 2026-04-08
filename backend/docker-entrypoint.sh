#!/bin/sh
set -e
cd /app

# When using --profile local-db, Postgres may still be starting; Neon URLs skip this.
case "$DATABASE_URL" in
  *@postgres:*)
    echo "Waiting for Postgres (postgres:5432)..."
    i=0
    while [ "$i" -lt 60 ]; do
      if python -c "import socket; s=socket.socket(); s.settimeout(2); s.connect(('postgres',5432)); s.close()" 2>/dev/null; then
        echo "Postgres is up."
        break
      fi
      i=$((i + 1))
      sleep 1
    done
    if [ "$i" -eq 60 ]; then
      echo "Postgres not reachable. Use: docker compose --profile local-db up"
      exit 1
    fi
    ;;
esac

# Migrations run automatically in FastAPI lifespan (see app/main.py).
# Set RUN_MIGRATIONS_ON_STARTUP=0 and run `alembic upgrade head` yourself if needed.
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
