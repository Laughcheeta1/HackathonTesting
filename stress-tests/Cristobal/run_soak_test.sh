#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
"$ROOT/stress-tests/common/run-k6-test.sh" "Cristobal" "soak" "k6/Cristobal/soak-test-cristobal.js"
