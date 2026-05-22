#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
"$ROOT/stress-tests/common/ensure-docker.sh"
"$ROOT/scripts/german-down.sh"
