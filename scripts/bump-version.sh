#!/usr/bin/env bash
# Bump the app version across all config files and create a git tag.
# Usage: ./scripts/bump-version.sh <version>
# Example: ./scripts/bump-version.sh 0.2.0
set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.2.0"
  exit 1
fi

# Validate semver-ish format
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must be in x.y.z format (e.g. 0.2.0)"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Bumping version to $VERSION..."

# Cargo.toml — first occurrence is the package version
sed -i "0,/^version = \"[^\"]*\"/{s/^version = \"[^\"]*\"/version = \"$VERSION\"/}" \
  "$ROOT/apps/desktop/src-tauri/Cargo.toml"

# tauri.conf.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" \
  "$ROOT/apps/desktop/src-tauri/tauri.conf.json"

# apps/desktop/package.json
node -e "
const fs = require('fs');
const p = '$ROOT/apps/desktop/package.json';
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
"

echo "Updated:"
echo "  apps/desktop/src-tauri/Cargo.toml"
echo "  apps/desktop/src-tauri/tauri.conf.json"
echo "  apps/desktop/package.json"
echo ""
echo "Review the changes, then run:"
echo "  git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/tauri.conf.json apps/desktop/package.json"
echo "  git commit -m 'chore: bump version to $VERSION'"
echo "  git tag v$VERSION"
echo "  git push && git push --tags"
