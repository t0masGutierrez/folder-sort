#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/install-to-vault.sh /path/to/your/vault

Installs dependencies, builds the plugin, then installs it into the requested vault.
USAGE
}

if [[ "${1:-}" == "/path/to/your/vault" ]]; then
  printf 'Please replace "/path/to/your/vault" with the path to your vault\n' >&2
  exit 64
fi

if [[ $# -ne 1 || -z "${1:-}" ]]; then
  usage >&2
  exit 64
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
VAULT="$1"
PLUGIN_DIR="$VAULT/.obsidian/plugins/folder-sort"

printf 'Installing dependencies...\n'
(cd "$PROJECT_ROOT" && npm install --include=dev)

printf 'Building Folder Sort...\n'
(cd "$PROJECT_ROOT" && npm run build)

for artifact in main.js manifest.json; do
  if [[ ! -f "$PROJECT_ROOT/$artifact" ]]; then
    printf 'Missing %s. Run npm run build from %s first.\n' "$artifact" "$PROJECT_ROOT" >&2
    exit 66
  fi
done

mkdir -p "$PLUGIN_DIR"
cp "$PROJECT_ROOT/main.js" "$PROJECT_ROOT/manifest.json" "$PLUGIN_DIR/"
rm -f "$PLUGIN_DIR/styles.css"

printf 'Installed Folder Sort to %s\n' "$PLUGIN_DIR"
