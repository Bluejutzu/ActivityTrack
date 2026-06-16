#!/usr/bin/env bash
# Bump the app version, commit, tag, and push in one shot.
# Usage: ./scripts/bump-version.sh <version> [--dry-run]
# Example: ./scripts/bump-version.sh 0.2.0
set -euo pipefail

VERSION="${1:-}"
DRY_RUN=false
for arg in "$@"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
done

if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version> [--dry-run]"
  echo "Example: $0 0.2.0"
  exit 1
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must be in x.y.z format (e.g. 0.2.0)"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Bail if there are uncommitted changes that would get mixed into the version commit
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree has uncommitted changes. Commit or stash them first."
  exit 1
fi

echo "Bumping version to $VERSION..."

# Cargo.toml — only replace the first occurrence (package version, not a dep)
sed -i "0,/^version = \"[^\"]*\"/{s/^version = \"[^\"]*\"/version = \"$VERSION\"/}" \
  apps/desktop/src-tauri/Cargo.toml

# tauri.conf.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" \
  apps/desktop/src-tauri/tauri.conf.json

# apps/desktop/package.json
node -e "
const fs = require('fs');
const p = 'apps/desktop/package.json';
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
"

echo "Updated:"
echo "  apps/desktop/src-tauri/Cargo.toml"
echo "  apps/desktop/src-tauri/tauri.conf.json"
echo "  apps/desktop/package.json"

FILES=(
  apps/desktop/src-tauri/Cargo.toml
  apps/desktop/src-tauri/tauri.conf.json
  apps/desktop/package.json
)

if $DRY_RUN; then
  echo ""
  echo "Dry run — skipping git commit, tag, and push."
  git diff "${FILES[@]}"
  exit 0
fi

git add "${FILES[@]}"
git commit -m "chore: bump version to $VERSION"
git tag "v$VERSION"

echo ""
echo "Committed and tagged v$VERSION. Pushing..."
git push
git push origin "v$VERSION"
echo ""
echo "Done. CI will now build and publish the v$VERSION release."
