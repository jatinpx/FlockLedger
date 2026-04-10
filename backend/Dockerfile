FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x docker-entrypoint.sh && sed -i 's/\r$//' docker-entrypoint.sh || true

EXPOSE 8000

# Use sh explicitly: avoids CRLF/shebang issues when the repo is on a Windows filesystem (e.g. /mnt/d).
ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
