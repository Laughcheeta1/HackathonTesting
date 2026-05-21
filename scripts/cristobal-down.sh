#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="$ROOT/EquipoCristobalRios"

remove_containers() {
    docker rm -f \
        eiatube_redis \
        eiatube_backend \
        eiatube_frontend \
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
        equipocristobalrios_eiatube_uploads \
        equipocristobalrios_eiatube_redis \
        EquipoCristobalRios_eiatube_uploads \
        EquipoCristobalRios_eiatube_redis \
        >/dev/null 2>&1 || true
}

remove_known_images() {
    docker image rm -f \
        equipocristobalrios-backend \
        equipocristobalrios-frontend \
        redis:7-alpine \
        >/dev/null 2>&1 || true
}

docker compose -f "$PROJECT_DIR/docker-compose.yml" --project-directory "$PROJECT_DIR" down --volumes --rmi all --remove-orphans || true
remove_containers
remove_labeled_resources "equipocristobalrios"
remove_labeled_resources "EquipoCristobalRios"
remove_known_volumes
remove_known_images
