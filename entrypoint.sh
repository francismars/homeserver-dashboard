#!/bin/sh
set -e

# Ensure cloudflare config directory exists and is owner-only readable by the nextjs user.
# The token is sensitive; do not leave it world-readable on a shared bind mount.
CLOUDFLARE_DIR="/app/cloudflare-config"
if [ -d "$CLOUDFLARE_DIR" ]; then
  touch "$CLOUDFLARE_DIR/token" "$CLOUDFLARE_DIR/domain" 2>/dev/null || true
  chown -R nextjs:nodejs "$CLOUDFLARE_DIR" 2>/dev/null || true
  chmod 700 "$CLOUDFLARE_DIR" 2>/dev/null || true
  chmod 600 "$CLOUDFLARE_DIR/token" "$CLOUDFLARE_DIR/domain" 2>/dev/null || true
fi

# Switch to nextjs user and run the app
exec su-exec nextjs node server.js
