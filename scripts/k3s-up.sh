#!/usr/bin/env bash
# Deploy backend + frontend to local K3s. Stateful deps stay on Docker.
#
# Steps:
#   1. Build backend + frontend images via Docker.
#   2. Save and import them into K3s containerd (K3s does not see Docker's
#      image store).
#   3. Render the backend Secret from .env (template fields → real values).
#   4. kubectl apply manifests.
#
# Re-run safely: builds and applies are idempotent.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

K3S_DIR="$REPO_ROOT/deploy/k3s"
ENV_FILE="$REPO_ROOT/.env"
BACKEND_IMAGE="smartmedcare-platform-backend:k3s"
FRONTEND_IMAGE="smartmedcare-platform-frontend:k3s"

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "[k3s-up] missing required command: $1" >&2; exit 1; }
}
require docker
require kubectl
require sudo

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[k3s-up] $ENV_FILE not found — create it from .env.example first" >&2
  exit 1
fi

echo "[k3s-up] step 1/4: building images"
docker build -t "$BACKEND_IMAGE"  -f backend/Dockerfile  .
docker build -t "$FRONTEND_IMAGE" -f frontend/Dockerfile ./frontend

echo "[k3s-up] step 2/4: importing images into K3s containerd"
for img in "$BACKEND_IMAGE" "$FRONTEND_IMAGE"; do
  tmp="$(mktemp /tmp/k3s-import.XXXXXX.tar)"
  trap 'rm -f "$tmp"' EXIT
  docker save "$img" -o "$tmp"
  sudo k3s ctr images import "$tmp"
  rm -f "$tmp"
  trap - EXIT
done

echo "[k3s-up] step 3/4: rendering Secret from .env"
# Pull a key from .env (returns empty string if missing).
env_get() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//' || true
}

# Escape for sed replacement: backslash, ampersand, forward slash, pipe (we use | as delim).
sed_escape() { printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'; }

TMP_SECRET="$(mktemp /tmp/backend-secret.XXXXXX.yaml)"
trap 'rm -f "$TMP_SECRET"' EXIT
cp "$K3S_DIR/secret.yaml.example" "$TMP_SECRET"

for key in SECRET_KEY MYSQL_USER MYSQL_PASSWORD MINIO_ACCESS_KEY MINIO_SECRET_KEY \
           HIVE_METASTORE_DB_PASSWORD WEATHER_API_KEY AI_API_KEY BRAVE_API_KEY \
           QDRANT_API_KEY KB_EMBEDDING_API_KEY; do
  val="$(env_get "$key")"
  esc="$(sed_escape "$val")"
  sed -i "s|__${key}__|${esc}|g" "$TMP_SECRET"
done

echo "[k3s-up] step 4/4: applying manifests"
kubectl apply -f "$K3S_DIR/namespace.yaml"
kubectl apply -f "$K3S_DIR/configmap.yaml"
kubectl apply -f "$K3S_DIR/frontend-nginx-config.yaml"
kubectl apply -f "$TMP_SECRET"
kubectl apply -f "$K3S_DIR/backend-deployment.yaml"
kubectl apply -f "$K3S_DIR/frontend-deployment.yaml"
kubectl apply -f "$K3S_DIR/ingress.yaml"

rm -f "$TMP_SECRET"
trap - EXIT

echo "[k3s-up] rolling restart so new images take effect"
kubectl -n smartmedcare rollout restart deploy/backend deploy/frontend

echo "[k3s-up] waiting for rollouts"
kubectl -n smartmedcare rollout status deploy/backend  --timeout=180s
kubectl -n smartmedcare rollout status deploy/frontend --timeout=120s

echo
echo "[k3s-up] done. Try:"
echo "  curl http://172.30.240.74/api/v1/system/health"
echo "  open http://172.30.240.74/        (or http://localhost/)"
echo
kubectl -n smartmedcare get pods,svc,ingress
