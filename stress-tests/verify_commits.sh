#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_FILE="$ROOT/stress-tests/expected-commits.env"

# shellcheck disable=SC1090
source "$EXPECTED_FILE"

ensure_commit() {
    local label="$1"
    local directory="$2"
    local expected="$3"
    local actual

    if [[ ! -d "$directory/.git" ]]; then
        echo "Error: $label is not a git repository at $directory" >&2
        exit 1
    fi

    actual="$(git -C "$directory" rev-parse HEAD)"
    if [[ "$actual" == "$expected" ]]; then
        echo "$label commit verified: $actual"
        return
    fi

    if [[ -n "$(git -C "$directory" status --porcelain)" ]]; then
        cat >&2 <<MSG
Error: $label is not at the expected commit and has local changes.
Expected: $expected
Actual:   $actual
Directory: $directory
Refusing to checkout because local changes would make the test run non-reproducible.
MSG
        exit 1
    fi

    echo "$label is at $actual; checking out expected commit $expected"

    if ! git -C "$directory" cat-file -e "$expected^{commit}" 2>/dev/null; then
        echo "$label expected commit is not available locally; fetching from remotes."
        git -C "$directory" fetch --all --tags --prune
    fi

    git -C "$directory" checkout --detach "$expected"
    actual="$(git -C "$directory" rev-parse HEAD)"

    if [[ "$actual" != "$expected" ]]; then
        cat >&2 <<MSG
Error: $label checkout did not reach the expected commit.
Expected: $expected
Actual:   $actual
Directory: $directory
MSG
        exit 1
    fi

    echo "$label commit checked out and verified: $actual"
}

ensure_commit "Braulio" "$ROOT/EquipoBraulio" "$BRAULIO_COMMIT"
ensure_commit "Cristobal" "$ROOT/EquipoCristobalRios" "$CRISTOBAL_COMMIT"
ensure_commit "German" "$ROOT/EquipoGerman" "$GERMAN_COMMIT"
