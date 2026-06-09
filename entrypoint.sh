#!/bin/sh
set -e

# Ensure cloudflare config directory exists and is owner-only readable by the nextjs user.
# The token is sensitive; do not leave it world-readable on a shared bind mount.
CLOUDFLARE_DIR="/app/cloudflare-config"
if [ -d "$CLOUDFLARE_DIR" ]; then
  touch "$CLOUDFLARE_DIR/token" "$CLOUDFLARE_DIR/domain" 2>/dev/null || true
  chown -R nextjs:nodejs "$CLOUDFLARE_DIR" 2>/dev/null || true
  # token must be readable by cloudflared (distroless image, UID 65532) which
  # mounts this same bind mount and reads TUNNEL_TOKEN_FILE. Owner=nextjs can
  # still rewrite the file via fs.writeFile (mode is preserved on truncate);
  # cloudflared's nonroot UID joins via the group bit. The DIRECTORY also
  # needs its group set to 65532 - without execute/traverse on the parent
  # dir, cloudflared cannot open the file regardless of file perms.
  chgrp 65532 "$CLOUDFLARE_DIR" "$CLOUDFLARE_DIR/token" 2>/dev/null || true
  chmod 750 "$CLOUDFLARE_DIR" 2>/dev/null || true
  chmod 640 "$CLOUDFLARE_DIR/token" 2>/dev/null || true
  chmod 600 "$CLOUDFLARE_DIR/domain" 2>/dev/null || true
fi

# Make the homeserver's config.toml writable by the dashboard process.
# pubky-core writes the file as its own user (e.g. node:node mode 0644)
# in a dir owned by that same user mode 0755, so without these chmods the
# Save button in Settings cannot persist edits even though the bind mount
# is rw. We need both:
#   - 0777 on the directory so the dashboard can create config.toml.tmp
#     (the POST handler uses a write-tmp + rename pattern for crash safety)
#   - 0666 on config.toml so the dashboard can replace it via the rename
# Idempotent; runs each container start; non-fatal if either does not
# exist yet (first install before the homeserver has written them).
HOMESERVER_DATA_DIR="/app/homeserver-data"
if [ -d "$HOMESERVER_DATA_DIR" ]; then
  chmod 0777 "$HOMESERVER_DATA_DIR" 2>/dev/null || true
fi
if [ -f "$HOMESERVER_DATA_DIR/config.toml" ]; then
  chmod 0666 "$HOMESERVER_DATA_DIR/config.toml" 2>/dev/null || true
fi

# Switch to nextjs user and run the app
exec su-exec nextjs node server.js
