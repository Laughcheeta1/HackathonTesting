#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
"$ROOT/stress-tests/common/run-k6-test.sh" "Braulio" "stress" "k6/Braulio/stress-test-braulio.js"
