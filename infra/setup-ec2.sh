#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# FlockLedger – EC2 first-time setup
# Run as ubuntu user on a fresh Ubuntu 22.04 / 24.04 instance.
# Usage:  bash setup-ec2.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="https://github.com/jatinpx/FlockLedger.git"
APP_DIR="$HOME/FlockLedger"
BRANCH="main"

echo "==> [1/5] Installing Docker Engine + Compose plugin"
sudo apt-get update -qq
sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -qq
sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# Allow ubuntu user to run docker without sudo
sudo usermod -aG docker "$USER"
echo "Docker installed: $(docker --version)"

echo "==> [2/5] Cloning repository (branch: $BRANCH)"
if [ -d "$APP_DIR" ]; then
  echo "    Directory exists — pulling latest"
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

echo "==> [3/5] Creating production .env"
if [ ! -f "$APP_DIR/backend/.env" ]; then
  cp "$APP_DIR/backend/.env.production" "$APP_DIR/backend/.env"
  echo ""
  echo "  !! ACTION REQUIRED: edit $APP_DIR/backend/.env"
  echo "     Fill in DATABASE_URL and SECRET_KEY before continuing."
  echo "     Run:  nano $APP_DIR/backend/.env"
  echo "     Then re-run this script or proceed manually."
  echo ""
  exit 0
else
  echo "    backend/.env already exists — skipping copy"
fi

echo "==> [4/5] Building and starting services"
cd "$APP_DIR"
# Use 'sg docker' so the group change above takes effect without re-login
sg docker -c "docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"

echo "==> [5/5] Health check"
sleep 5
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health || true)
if [ "$HTTP_CODE" = "200" ]; then
  echo "    ✓ Backend is UP — http://localhost/health → 200"
else
  echo "    ✗ Got HTTP $HTTP_CODE — checking logs:"
  sg docker -c "docker compose logs --tail=30 backend"
fi

echo ""
echo "Done. Your stack is running."
echo "Next: point api.jatinpanghal.com DNS A-record at this server's public IP."
