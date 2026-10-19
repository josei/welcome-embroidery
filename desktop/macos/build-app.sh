#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP_DIR=${1:-"$SCRIPT_DIR/build/Welcom.app"}
mkdir -p "$APP_DIR/Contents/MacOS"
swiftc -swift-version 5 -O -framework SwiftUI -framework WebKit -framework AppKit \
  "$SCRIPT_DIR/WelcomApp.swift" -o "$APP_DIR/Contents/MacOS/Welcom"
cp "$SCRIPT_DIR/Info.plist" "$APP_DIR/Contents/Info.plist"
printf 'Built source shell: %s\nOpen with: open %s\n' "$APP_DIR" "$APP_DIR"
