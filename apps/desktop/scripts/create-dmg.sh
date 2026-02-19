#!/bin/bash
# ─── Create DMG for Crunch ──────────────────────────────────────────────────────
# Creates a DMG with drag-to-Applications layout using native hdiutil
# Usage: ./create-dmg.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$PROJECT_DIR/release/mac-arm64"
APP_NAME="Crunch"
DMG_NAME="Crunch-1.0.0-arm64"
DMG_DIR="$PROJECT_DIR/release"
TEMP_DMG="$DMG_DIR/${DMG_NAME}-temp.dmg"
FINAL_DMG="$DMG_DIR/${DMG_NAME}.dmg"
STAGING_DIR="$DMG_DIR/.dmg-staging"

echo "📦 Creating DMG for ${APP_NAME}..."

# Check that the .app exists
if [ ! -d "$APP_DIR/${APP_NAME}.app" ]; then
  echo "❌ ${APP_NAME}.app not found in $APP_DIR"
  echo "   Run 'npm run build && npx electron-builder --dir' first."
  exit 1
fi

# Remove old artifacts
rm -f "$TEMP_DMG" "$FINAL_DMG"
rm -rf "$STAGING_DIR"

# Create staging directory with app + Applications symlink
echo "  → Preparing staging directory..."
mkdir -p "$STAGING_DIR"
cp -R "$APP_DIR/${APP_NAME}.app" "$STAGING_DIR/"
ln -s /Applications "$STAGING_DIR/Applications"

# Create DMG from staging directory
echo "  → Creating DMG (this may take a moment)..."
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDZO \
  "$FINAL_DMG"

# Cleanup staging
rm -rf "$STAGING_DIR"

echo ""
echo "✅ DMG created successfully!"
echo "   📍 $FINAL_DMG"
echo "   📦 $(du -h "$FINAL_DMG" | cut -f1) compressed"
