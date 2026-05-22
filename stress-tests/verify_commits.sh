#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_COMMITS_FILE="$ROOT/stress-tests/expected-commits.env"
EXPECTED_REPOS_FILE="$ROOT/stress-tests/expected-repos.env"

# shellcheck disable=SC1090
source "$EXPECTED_COMMITS_FILE"
# shellcheck disable=SC1090
source "$EXPECTED_REPOS_FILE"

ensure_repo_exists() {
    local label="$1"
    local directory="$2"
    local repo_url="$3"

    if [[ -d "$directory/.git" ]] || [[ -f "$directory/.git" ]]; then
        return
    fi

    if [[ -e "$directory" ]]; then
        if find "$directory" -mindepth 1 -maxdepth 1 | read -r _; then
            cat >&2 <<MSG
Error: $label directory exists but is not a git repository and is not empty.
Directory: $directory
Refusing to replace it automatically.
MSG
            exit 1
        fi
        rmdir "$directory"
    fi

    echo "$label repository is missing; cloning $repo_url into $directory"
    git clone "$repo_url" "$directory"
}

ensure_clean_worktree() {
    local label="$1"
    local directory="$2"

    if [[ -n "$(git -C "$directory" status --porcelain)" ]]; then
        cat >&2 <<MSG
Error: $label has local changes.
Directory: $directory
Refusing to continue because dirty product code makes the test run non-reproducible.
MSG
        exit 1
    fi
}

ensure_commit() {
    local label="$1"
    local directory="$2"
    local repo_url="$3"
    local expected="$4"
    local actual

    ensure_repo_exists "$label" "$directory" "$repo_url"
    ensure_clean_worktree "$label" "$directory"

    actual="$(git -C "$directory" rev-parse HEAD)"
    if [[ "$actual" == "$expected" ]]; then
        echo "$label commit verified: $actual"
        return
    fi

    echo "$label is at $actual; checking out expected commit $expected"

    if ! git -C "$directory" cat-file -e "$expected^{commit}" 2>/dev/null; then
        echo "$label expected commit is not available locally; fetching from remotes."
        git -C "$directory" fetch --all --tags --prune
    fi

    git -C "$directory" checkout --detach "$expected"
    ensure_clean_worktree "$label" "$directory"
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

ensure_commit "Braulio" "$ROOT/EquipoBraulio" "$BRAULIO_REPO_URL" "$BRAULIO_COMMIT"
ensure_commit "Cristobal" "$ROOT/EquipoCristobalRios" "$CRISTOBAL_REPO_URL" "$CRISTOBAL_COMMIT"
ensure_commit "German" "$ROOT/EquipoGerman" "$GERMAN_REPO_URL" "$GERMAN_COMMIT"
