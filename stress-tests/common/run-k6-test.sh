#!/usr/bin/env bash
set -euo pipefail

project="$1"
test_type="$2"
script_path="$3"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=env.sh
source "$ROOT/stress-tests/common/env.sh"
load_test_env "$ROOT"

if ! command -v "$K6_BIN" >/dev/null 2>&1; then
    echo "Error: k6 was not found. Run ./stress-tests/cold_setup.sh first, or set K6_BIN in .env." >&2
    exit 127
fi

run_id="$(date +%Y%m%d-%H%M%S)"
result_dir="$ROOT/stress-tests/results/${project}-${test_type}-${run_id}"
mkdir -p "$result_dir"

metrics_csv="$result_dir/docker-metrics.csv"
metrics_summary="$result_dir/docker-metrics-summary.env"
k6_summary="$result_dir/k6-summary.json"
k6_log="$result_dir/k6-output.log"

printf 'Running %s %s test with MAX_USERS=%s\n' "$project" "$test_type" "$MAX_USERS"
printf 'Results directory: %s\n' "$result_dir"
printf 'Live terminal metrics show total VM usage, including k6.\n'
printf 'Saved metrics and final resource summary are Docker-only app usage, excluding k6.\n'

"$ROOT/stress-tests/common/docker-metrics-monitor.sh" "$metrics_csv" "$metrics_summary" &
docker_monitor_pid="$!"
"$ROOT/stress-tests/common/vm-live-monitor.sh" &
vm_monitor_pid="$!"

stop_monitors() {
    kill "$docker_monitor_pid" "$vm_monitor_pid" >/dev/null 2>&1 || true
    wait "$docker_monitor_pid" >/dev/null 2>&1 || true
    wait "$vm_monitor_pid" >/dev/null 2>&1 || true
}

trap 'stop_monitors' EXIT

set +e
"$K6_BIN" run --summary-export "$k6_summary" -e MAX_USERS="$MAX_USERS" "$ROOT/$script_path" 2>&1 | tee "$k6_log"
k6_exit="${PIPESTATUS[0]}"
set -e

stop_monitors
trap - EXIT

python3 "$ROOT/stress-tests/common/print-test-summary.py" \
    "$k6_summary" "$metrics_summary" "$project" "$test_type" "$MAX_USERS" "$k6_exit"

exit "$k6_exit"
