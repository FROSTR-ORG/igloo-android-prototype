#!/bin/sh
set -euo pipefail

echo "==> Installing JS dependencies (bun)"
if ! command -v bun >/dev/null 2>&1; then
  echo "==> bun not found; installing..."
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  curl -fsSL https://bun.sh/install | bash
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

bun install --frozen-lockfile

echo "==> Installing CocoaPods"
cd ios
pod install
