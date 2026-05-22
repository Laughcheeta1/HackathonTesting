#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
"$ROOT/scripts/braulio-up.sh"
"$ROOT/stress-tests/common/wait-for-url.sh" "Braulio app" "http://localhost" 300
"$ROOT/stress-tests/common/wait-for-url.sh" "Braulio API" "http://localhost/api/health" 300
