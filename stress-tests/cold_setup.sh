#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
    SUDO=""
    TARGET_USER="${SUDO_USER:-ubuntu}"
else
    SUDO="sudo"
    TARGET_USER="${USER}"
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export DEBIAN_FRONTEND=noninteractive

echo "==> Updating apt repositories"
$SUDO apt-get update -y
$SUDO apt-get upgrade -y

echo "==> Installing base tools"
$SUDO apt-get install -y ca-certificates curl gnupg lsb-release unzip git python3 gawk

echo "==> Installing Docker Engine and Compose plugin"
$SUDO install -m 0755 -d /etc/apt/keyrings
$SUDO rm -f /etc/apt/keyrings/docker.gpg
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
$SUDO chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null

$SUDO apt-get update -y
$SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

$SUDO systemctl enable docker
$SUDO systemctl start docker
$SUDO usermod -aG docker "$TARGET_USER"

echo "==> Installing k6"
$SUDO gpg -k >/dev/null
$SUDO rm -f /usr/share/keyrings/k6-archive-keyring.gpg
curl -fsSL https://dl.k6.io/key.gpg | $SUDO gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  $SUDO tee /etc/apt/sources.list.d/k6.list >/dev/null
$SUDO apt-get update -y
$SUDO apt-get install -y k6

echo "==> Installing Terraform for German deployment scripts"
$SUDO rm -f /usr/share/keyrings/hashicorp-archive-keyring.gpg
curl -fsSL https://apt.releases.hashicorp.com/gpg | $SUDO gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(. /etc/os-release && echo "$VERSION_CODENAME") main" | \
  $SUDO tee /etc/apt/sources.list.d/hashicorp.list >/dev/null
$SUDO apt-get update -y
$SUDO apt-get install -y terraform

if [[ ! -f "$ROOT/.env" ]]; then
    echo "==> Creating root .env from stress-tests/.env.example"
    cp "$ROOT/stress-tests/.env.example" "$ROOT/.env"
else
    echo "==> Root .env already exists; leaving it unchanged"
fi

echo "==> Ensuring team repositories are at the expected commits"
"$ROOT/stress-tests/verify_commits.sh"

cat <<MSG

Cold setup complete.
User '$TARGET_USER' was added to the docker group.
Log out and back in, or run this once in the current shell before using Docker without sudo:
  newgrp docker

Root stress-test settings are available at:
  nano .env
MSG
