#!/usr/bin/env bash
set -euo pipefail

if docker info >/dev/null 2>&1; then
    exit 0
fi

cat >&2 <<'MSG'
Error: Docker is not accessible from this shell.
Run ./cold_setup.sh first. If Docker was restarted after cold setup, run:
  newgrp docker
or log out and back in, then retry.
MSG
exit 1
