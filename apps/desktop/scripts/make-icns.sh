#!/bin/bash
# Generate .icns for macOS from a single PNG
# Usage: ./make-icns.sh icon.png output.icns

PNG_FILE=$1
OUT_FILE=$2

if [ -z "$PNG_FILE" ] || [ -z "$OUT_FILE" ]; then
  echo "Usage: $0 input.png output.icns"
  exit 1
fi

ICONSET="icon.iconset"
mkdir -p "$ICONSET"

# Create different sizes
sips -z 16 16     "$PNG_FILE" --out "$ICONSET/icon_16x16.png"
sips -z 32 32     "$PNG_FILE" --out "$ICONSET/icon_16x16@2x.png"
sips -z 32 32     "$PNG_FILE" --out "$ICONSET/icon_32x32.png"
sips -z 64 64     "$PNG_FILE" --out "$ICONSET/icon_32x32@2x.png"
sips -z 128 128   "$PNG_FILE" --out "$ICONSET/icon_128x128.png"
sips -z 256 256   "$PNG_FILE" --out "$ICONSET/icon_128x128@2x.png"
sips -z 256 256   "$PNG_FILE" --out "$ICONSET/icon_256x256.png"
sips -z 512 512   "$PNG_FILE" --out "$ICONSET/icon_256x256@2x.png"
sips -z 512 512   "$PNG_FILE" --out "$ICONSET/icon_512x512.png"
sips -z 1024 1024 "$PNG_FILE" --out "$ICONSET/icon_512x512@2x.png"

# Convert to icns
iconutil -c icns "$ICONSET" -o "$OUT_FILE"

# Cleanup
rm -rf "$ICONSET"

echo "✅ Created $OUT_FILE"
