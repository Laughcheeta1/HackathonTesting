#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="$ROOT/EquipoGerman"
UPLOAD_DIR="$PROJECT_DIR/backend/uploads"
TERRAFORM_LOCAL_DIR="$PROJECT_DIR/infra/local"

remove_containers() {
    docker rm -f \
        youtube_clone_nginx \
        youtube_clone_postgres \
        youtube_clone_redis \
        youtube_clone_backend \
        youtube_clone_worker \
        youtube_clone_frontend \
        youtube_clone_otel_collector \
        youtube_clone_tempo \
        youtube_clone_cadvisor \
        youtube_clone_prometheus \
        youtube_clone_grafana \
        >/dev/null 2>&1 || true
}

remove_labeled_resources() {
    local project_name="$1"
    local ids

    ids="$(docker volume ls -q --filter "label=com.docker.compose.project=${project_name}")"
    if [[ -n "$ids" ]]; then
        docker volume rm -f $ids >/dev/null 2>&1 || true
    fi

    ids="$(docker image ls -q --filter "label=com.docker.compose.project=${project_name}")"
    if [[ -n "$ids" ]]; then
        docker image rm -f $ids >/dev/null 2>&1 || true
    fi
}

remove_known_volumes() {
    docker volume rm -f \
        equipogerman_postgres_data \
        equipogerman_redis_data \
        equipogerman_prometheus_data \
        equipogerman_grafana_data \
        EquipoGerman_postgres_data \
        EquipoGerman_redis_data \
        EquipoGerman_prometheus_data \
        EquipoGerman_grafana_data \
        >/dev/null 2>&1 || true
}

remove_known_images() {
    docker image rm -f \
        equipogerman-backend \
        equipogerman-worker \
        equipogerman-frontend \
        nginx:1.27-alpine \
        postgres:16-alpine \
        redis:7-alpine \
        otel/opentelemetry-collector-contrib:0.99.0 \
        grafana/tempo:2.4.1 \
        gcr.io/cadvisor/cadvisor:v0.49.1 \
        prom/prometheus:v2.51.2 \
        grafana/grafana:10.4.2 \
        >/dev/null 2>&1 || true
}

explain_sudo_required() {
    echo "German cleanup needs sudo to remove root-owned generated files."
    echo "Grant permission from the action console, or run this in the same terminal before cleanup:"
    echo "  sudo -v"
}

empty_directory() {
    local directory="$1"

    mkdir -p "$directory"
    if find "$directory" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null; then
        return
    fi

    echo "Normal deletion failed for $directory; retrying with sudo..."
    if ! sudo -n find "$directory" -mindepth 1 -maxdepth 1 -exec rm -rf {} +; then
        explain_sudo_required
        exit 1
    fi
}

remove_terraform_state() {
    if rm -f \
        "$TERRAFORM_LOCAL_DIR"/terraform.tfstate \
        "$TERRAFORM_LOCAL_DIR"/terraform.tfstate.backup \
        "$TERRAFORM_LOCAL_DIR"/terraform.tfstate.*.backup \
        2>/dev/null; then
        return
    fi

    echo "Normal deletion failed for Terraform state; retrying with sudo..."
    if ! sudo -n rm -f \
        "$TERRAFORM_LOCAL_DIR"/terraform.tfstate \
        "$TERRAFORM_LOCAL_DIR"/terraform.tfstate.backup \
        "$TERRAFORM_LOCAL_DIR"/terraform.tfstate.*.backup; then
        explain_sudo_required
        exit 1
    fi
}

cd "$PROJECT_DIR"
./infra/scripts/deploy.sh --profile dev --target local --hw auto --action destroy || true
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev down --volumes --rmi all --remove-orphans || true
remove_containers
remove_labeled_resources "equipogerman"
remove_labeled_resources "EquipoGerman"
remove_known_volumes
remove_known_images
empty_directory "$UPLOAD_DIR"
remove_terraform_state
