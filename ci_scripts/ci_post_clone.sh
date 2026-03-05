#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_DIR"
mkdir -p "$REPO_DIR/.tmp"
export TMPDIR="$REPO_DIR/.tmp"
export CI=1
export COCOAPODS_DISABLE_STATS=1

run() {
  echo "==> $*"
  "$@"
}

add_path_if_exists() {
  if [ -d "$1" ]; then
    PATH="$1:$PATH"
    export PATH
  fi
}

ensure_node_and_npm() {
  add_path_if_exists "/opt/homebrew/bin"
  add_path_if_exists "/usr/local/bin"
  add_path_if_exists "/opt/homebrew/opt/node/bin"
  add_path_if_exists "/opt/homebrew/opt/node@20/bin"
  add_path_if_exists "/usr/local/opt/node/bin"
  add_path_if_exists "/usr/local/opt/node@20/bin"

  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    return 0
  fi

  echo "==> Node/npm not found on PATH; downloading Node.js runtime"
  case "$(uname -m)" in
    arm64) NODE_ARCH="darwin-arm64" ;;
    x86_64) NODE_ARCH="darwin-x64" ;;
    *)
      echo "ERROR: Unsupported macOS architecture: $(uname -m)"
      exit 1
      ;;
  esac

  NODE_VERSION="${NODE_VERSION:-20.18.3}"
  NODE_BASE_URL="https://nodejs.org/dist/v$NODE_VERSION"
  SHASUMS_FILE="$TMPDIR/node-shasums.txt"
  run curl -fsSL "$NODE_BASE_URL/SHASUMS256.txt" -o "$SHASUMS_FILE"

  NODE_TARBALL="$(awk -v arch="$NODE_ARCH" '$2 ~ ("^node-v20.*-" arch "\\.tar\\.gz$") {print $2; exit}' "$SHASUMS_FILE")"
  if [ -z "$NODE_TARBALL" ]; then
    echo "ERROR: Could not resolve Node tarball for architecture $NODE_ARCH"
    exit 1
  fi

  NODE_TARBALL_PATH="$TMPDIR/$NODE_TARBALL"
  run curl -fsSL "$NODE_BASE_URL/$NODE_TARBALL" -o "$NODE_TARBALL_PATH"

  EXPECTED_SHA256="$(awk -v tar="$NODE_TARBALL" '$2 == tar {print $1; exit}' "$SHASUMS_FILE")"
  if [ -z "$EXPECTED_SHA256" ]; then
    echo "ERROR: Could not resolve checksum for $NODE_TARBALL"
    exit 1
  fi

  ACTUAL_SHA256="$(shasum -a 256 "$NODE_TARBALL_PATH" | awk '{print $1}')"
  if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
    echo "ERROR: Checksum mismatch for $NODE_TARBALL"
    echo "Expected: $EXPECTED_SHA256"
    echo "Actual:   $ACTUAL_SHA256"
    exit 1
  fi

  TOOLS_DIR="$REPO_DIR/.xcode-cloud-tools"
  run mkdir -p "$TOOLS_DIR"
  run tar -xzf "$NODE_TARBALL_PATH" -C "$TOOLS_DIR"

  NODE_DIR_NAME="${NODE_TARBALL%.tar.gz}"
  add_path_if_exists "$TOOLS_DIR/$NODE_DIR_NAME/bin"

  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo "ERROR: Node/npm still unavailable after runtime bootstrap."
    exit 1
  fi
}

echo "==> Tool versions"
node -v || true
npm -v || true
bun --version || true
ruby --version || true
pod --version || true

ensure_node_and_npm

echo "==> Tool versions after Node bootstrap"
node -v
npm -v

echo "==> Installing JS dependencies"
JS_OK=0

if command -v bun >/dev/null 2>&1 && [ -f "bun.lock" ]; then
  if run bun install --frozen-lockfile; then
    JS_OK=1
  else
    echo "WARN: bun frozen install failed, retrying bun install"
    if run bun install; then
      JS_OK=1
    fi
  fi
fi

if [ "$JS_OK" -ne 1 ]; then
  echo "==> Falling back to npm install (legacy peer deps)"
  rm -rf node_modules
  if [ -f package-lock.json ]; then
    run npm ci --legacy-peer-deps --no-audit --no-fund && JS_OK=1
  else
    run npm install --legacy-peer-deps --no-audit --no-fund && JS_OK=1
  fi
fi

if [ "$JS_OK" -ne 1 ]; then
  echo "ERROR: JavaScript dependency install did not complete successfully."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "ERROR: node_modules is missing after successful dependency install."
  exit 1
fi

echo "==> Installing CocoaPods dependencies"
cd ios
if ! command -v pod >/dev/null 2>&1; then
  echo "WARN: CocoaPods command not found in PATH; trying gem user install"
  if command -v gem >/dev/null 2>&1; then
    COCOAPODS_VERSION="${COCOAPODS_VERSION:-1.16.2}"
    GEM_BIN_DIR="$HOME/.gem/ruby/$(ruby -e 'print RbConfig::CONFIG[\"ruby_version\"]')/bin"
    run gem install cocoapods -v "$COCOAPODS_VERSION" -N --user-install
    export PATH="$GEM_BIN_DIR:$PATH"
  fi
fi

if ! command -v pod >/dev/null 2>&1; then
  echo "ERROR: CocoaPods command 'pod' is still not available after fallback."
  exit 1
fi

if ! run pod install; then
  echo "WARN: pod install failed, retrying with --repo-update"
  run pod install --repo-update
fi

if [ ! -f "Pods/Target Support Files/Pods-Igloo/Pods-Igloo.release.xcconfig" ]; then
  echo "ERROR: Expected Pods-Igloo.release.xcconfig was not generated."
  ls -la "Pods/Target Support Files" || true
  exit 1
fi
