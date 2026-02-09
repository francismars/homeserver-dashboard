#!/bin/sh
set -e

# Ensure cloudflare config directory exists and is writable by nextjs user
CLOUDFLARE_DIR="/app/cloudflare-config"
if [ -d "$CLOUDFLARE_DIR" ]; then
  # Make directory writable (may require running as root initially)
  chmod 777 "$CLOUDFLARE_DIR" 2>/dev/null || true
  # Touch files so they exist with correct permissions
  touch "$CLOUDFLARE_DIR/token" "$CLOUDFLARE_DIR/domain" 2>/dev/null || true
  chmod 666 "$CLOUDFLARE_DIR/token" "$CLOUDFLARE_DIR/domain" 2>/dev/null || true
fi

# Switch to nextjs user and run the app
exec su-exec nextjs node server.js
