#!/usr/bin/env bash
# Rebuild the React reader and stage it into the Xcode project.
# Run this from the repo root after any change in web/src.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "→ Building React bundle…"
(cd web && npm run build)

echo "→ Staging dist/ into ios/KJVBible/WebApp/"
WEBAPP="ios/KJVBible/WebApp"
rm -rf "$WEBAPP"
mkdir -p "$WEBAPP"
cp -R web/dist/. "$WEBAPP"/

echo "✓ Done. Open ios/KJVBible.xcodeproj and ⌘R."
