#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="$ROOT/EquipoBraulio"

remove_containers() {
    docker rm -f \
        youtube_clone_postgres \
        youtube_clone_redis \
        youtube_clone_backend \
        youtube_clone_frontend \
        youtube_clone_nginx \
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
        equipobraulio_postgres_data \
        equipobraulio_uploads_data \
        EquipoBraulio_postgres_data \
        EquipoBraulio_uploads_data \
        >/dev/null 2>&1 || true
}

remove_known_images() {
    docker image rm -f \
        equipobraulio-backend \
        equipobraulio-frontend \
        postgres:16-alpine \
        redis:7-alpine \
        nginx:alpine \
        >/dev/null 2>&1 || true
}

docker compose -f "$PROJECT_DIR/docker-compose.yml" --project-directory "$PROJECT_DIR" down --volumes --rmi all --remove-orphans || true
remove_containers
remove_labeled_resources "equipobraulio"
remove_labeled_resources "EquipoBraulio"
remove_known_volumes
remove_known_images
