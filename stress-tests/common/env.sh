#!/usr/bin/env bash
set -euo pipefail

repo_root() {
    cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

load_test_env() {
    local root="$1"
    local env_file="$root/.env"

    if [[ -f "$env_file" ]]; then
        set -a
        # shellcheck disable=SC1090
        source "$env_file"
        set +a
    fi

    export MAX_USERS="${MAX_USERS:-100}"
    export METRICS_SAMPLE_INTERVAL_SECONDS="${METRICS_SAMPLE_INTERVAL_SECONDS:-1}"
    export METRICS_PRINT_INTERVAL_SECONDS="${METRICS_PRINT_INTERVAL_SECONDS:-5}"
    export K6_BIN="${K6_BIN:-k6}"
}
