#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  . "$ROOT_DIR/.env"
  set +a
fi

if [ -n "${NOTARY_APPLE_ID:-}" ] && [ -n "${NOTARY_APP_PASSWORD:-}" ]; then
  NOTARY_AUTH_MODE="apple_id"
  : "${NOTARY_TEAM_ID:?Missing NOTARY_TEAM_ID}"
else
  NOTARY_AUTH_MODE="api_key"
  : "${NOTARY_KEY_ID:?Missing NOTARY_KEY_ID}"
  : "${NOTARY_ISSUER_ID:?Missing NOTARY_ISSUER_ID}"
  : "${NOTARY_KEY_PATH:?Missing NOTARY_KEY_PATH}"
  : "${NOTARY_TEAM_ID:?Missing NOTARY_TEAM_ID}"

  if [ ! -f "$NOTARY_KEY_PATH" ]; then
    echo "NOTARY_KEY_PATH does not exist: $NOTARY_KEY_PATH" >&2
    exit 1
  fi
fi

APP_PATH="$ROOT_DIR/dist/mac-arm64/Peekdown.app"
HELPER_PATH="$ROOT_DIR/assets/quicklook/PeekdownQLHost.app.bundled"

if [ ! -d "$APP_PATH" ]; then
  echo "Peekdown.app not found at $APP_PATH" >&2
  exit 1
fi

if [ ! -d "$HELPER_PATH" ]; then
  echo "PeekdownQLHost.app.bundled not found at $HELPER_PATH" >&2
  exit 1
fi

notarize() {
  local target="$1"
  local name
  name="$(basename "$target")"
  local temp_dir
  temp_dir="$(mktemp -d)"
  local zip_path="$temp_dir/${name}.zip"

  ditto -c -k --sequesterRsrc --keepParent "$target" "$zip_path"

  if [ "$NOTARY_AUTH_MODE" = "apple_id" ]; then
    xcrun notarytool submit "$zip_path" \
      --apple-id "$NOTARY_APPLE_ID" \
      --password "$NOTARY_APP_PASSWORD" \
      --team-id "$NOTARY_TEAM_ID" \
      --wait
  else
    xcrun notarytool submit "$zip_path" \
      --key "$NOTARY_KEY_PATH" \
      --key-id "$NOTARY_KEY_ID" \
      --issuer "$NOTARY_ISSUER_ID" \
      --team-id "$NOTARY_TEAM_ID" \
      --wait
  fi

  xcrun stapler staple "$target"
  rm -rf "$temp_dir"
}

notarize "$HELPER_PATH"
notarize "$APP_PATH"
