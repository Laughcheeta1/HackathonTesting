#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
"$ROOT/stress-tests/common/ensure-docker.sh"
PROJECT_DIR="$ROOT/EquipoGerman"
ENV_FILE="$PROJECT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Creating German project .env at $ENV_FILE"
    cat > "$ENV_FILE" <<'GERMAN_ENV'
# =============================================================================
# APPLICATION SECRETS & CONFIGURATION
# =============================================================================
APP_ENV=production

POSTGRES_USER=your_db_username
POSTGRES_PASSWORD=StrongPassword12345!
POSTGRES_DB=youtube_clone
DATABASE_URL=

REDIS_PASSWORD=
REDIS_URL=

JWT_SECRET_KEY=l-yiCgUXo_vEC5xO3Ybj_uHduN-Ni8gYYUOz9LXbLhY789ExYq2RgPLCMSeemcwG
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXP_MINUTES=120
AUTH_TOKEN_ISSUER_ENABLED=true

CORS_ALLOW_ORIGINS=http://localhost,http://localhost:5173,http://127.0.0.1

BACKEND_GUNICORN_TIMEOUT=120
BACKEND_GUNICORN_GRACEFUL_TIMEOUT=30
BACKEND_GUNICORN_KEEPALIVE=75

GRAFANA_ADMIN_PASSWORD=admin
GRAFANA_ROOT_URL=http://localhost/grafana
GERMAN_ENV
else
    echo "German project .env already exists: $ENV_FILE"
fi

"$ROOT/scripts/german-up.sh"
