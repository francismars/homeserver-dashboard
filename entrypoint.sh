#!/bin/sh
set -e

# Ensure cloudflare config directory exists and is owner-only readable by the nextjs user.
# The token is sensitive; do not leave it world-readable on a shared bind mount.
CLOUDFLARE_DIR="/app/cloudflare-config"
if [ -d "$CLOUDFLARE_DIR" ]; then
  # One-time migration for installs created before the token-mode container
  # was removed: convert a legacy token+domain into the locally-managed
  # credentials.json + config.yml that the single cloudflared --config service
  # runs. Idempotent and conservative (no-op when config.yml exists or the
  # token is empty/undecodable); runs BEFORE the perm phase below so the new
  # files inherit the same ownership/modes. Must never fail the boot. Note
  # this only adds config.yml/credentials.json; the create-only touch below
  # still leaves the boot-stamp comparison for token/domain untouched.
  # DEPRECATION: remove this line and /app/migrate-cf-token.mjs after
  # 2026-12-01 (see the script header for why).
  CLOUDFLARE_CONFIG_DIR="$CLOUDFLARE_DIR" node /app/migrate-cf-token.mjs || true
  # Create-only: an unconditional touch would bump the mtimes on every boot,
  # AFTER the wrapper wrote its boot stamp, so the restart-pending probe
  # (which compares these files against the stamp) would report a pending
  # restart forever. Existence is all the perms block below needs.
  for f in token domain; do
    [ -f "$CLOUDFLARE_DIR/$f" ] || touch "$CLOUDFLARE_DIR/$f" 2>/dev/null || true
  done
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
  # Locally-managed mode (Connect-account flow): credentials.json carries the
  # tunnel secret and config.yml the ingress; both must be readable by the
  # cloudflared-local container (UID 65532) but not world-readable.
  for f in credentials.json config.yml; do
    if [ -f "$CLOUDFLARE_DIR/$f" ]; then
      chgrp 65532 "$CLOUDFLARE_DIR/$f" 2>/dev/null || true
      chmod 640 "$CLOUDFLARE_DIR/$f" 2>/dev/null || true
    fi
  done
  # An unused login cert is a zone-admin credential with a 15-minute
  # authorization window. The dashboard enforces it only while its status
  # route is polled, so reap over-age certs here too: the canonical path and
  # the scratch dir where the login child delivers them.
  find "$CLOUDFLARE_DIR" -maxdepth 1 -name cert.pem -mmin +15 -delete 2>/dev/null || true
  find "$CLOUDFLARE_DIR/.cloudflared" -name cert.pem -mmin +15 -delete 2>/dev/null || true
  # A leftover login cert is a zone-admin credential; only the dashboard
  # process ever needs it.
  if [ -f "$CLOUDFLARE_DIR/cert.pem" ]; then
    chown nextjs:nodejs "$CLOUDFLARE_DIR/cert.pem" 2>/dev/null || true
    chmod 600 "$CLOUDFLARE_DIR/cert.pem" 2>/dev/null || true
  fi
  # Flow locks are per-process and meaningless across a restart; a lock
  # orphaned by a crash must not wedge the setup flows forever.
  rm -f "$CLOUDFLARE_DIR"/.flow-*.lock "$CLOUDFLARE_DIR/.connect-complete.lock" 2>/dev/null || true
  # The recursive chown above also grabs the preview subtree, but that one
  # belongs to cloudflared-preview (distroless, UID 65532), which re-opens
  # preview/quick.log by name on every restart. A nextjs-owned 0644 logfile
  # makes that open fail ("Falling back to a default logger ... permission
  # denied"), the preview URL never lands in the log, and the wrapper's
  # publish wait times out. The dashboard only READS quick.log and
  # preview/published, so hand the subtree back: world-readable modes keep
  # the nextjs reads working.
  if [ -d "$CLOUDFLARE_DIR/preview" ]; then
    chown 65532:65532 "$CLOUDFLARE_DIR/preview" 2>/dev/null || true
    if [ -f "$CLOUDFLARE_DIR/preview/quick.log" ]; then
      chown 65532:65532 "$CLOUDFLARE_DIR/preview/quick.log" 2>/dev/null || true
      chmod 664 "$CLOUDFLARE_DIR/preview/quick.log" 2>/dev/null || true
    fi
    # published is written by the wrapper (atomic tmp+mv as root) and only
    # read here and by users of the status route; 644 is enough.
    if [ -f "$CLOUDFLARE_DIR/preview/published" ]; then
      chmod 644 "$CLOUDFLARE_DIR/preview/published" 2>/dev/null || true
    fi
  fi
fi

# Make the homeserver's config.toml editable by the dashboard process
# without world-writable modes (the file holds admin_password). Group-based
# sharing, same approach as the cloudflare dir above.
#
# Who touches the shared /app/homeserver-data bind mount:
#   homeserver wrapper image     uid 100, gid 101 ("homeserver", the first
#                                alpine system user); its root-phase
#                                entrypoint chowns the dir to 100:101 on
#                                every app boot when ownership differs
#   dashboard (this image)       uid 1001 ("nextjs") after su-exec, with
#                                supplementary gid 101 (see Dockerfile);
#                                needs: open config.toml r+ (writability
#                                probe), create config.toml.tmp in the dir,
#                                rename it over config.toml
#
# Matrix this block converges to (heals pre-existing 0777/0666 installs on
# the next boot; idempotent; non-fatal when the file does not exist yet):
#   /app/homeserver-data   100:101  2775  setgid: new files inherit gid 101
#   config.toml            100:101  0660  owner+group rw, others nothing
#
# Sharing the WRAPPER's gid (101) instead of this image's nodejs gid is what
# makes boot order irrelevant: the wrapper's chown -R homeserver:homeserver
# is then a no-op for group access, so whichever container starts last, the
# dashboard keeps dir write (group rwx) and file rw (group rw). The
# server-config route preserves the file's mode on every save (and the
# setgid bit keeps the group at 101), so a save never widens 0660 back to
# the umask default.
#
# Residual gap (accepted, same window existed with the old 0666 chmod): when
# the wrapper REWRITES config.toml (first generation, template migration,
# admin_password reconcile) it chmods it 0644 and chowns it 100:101. Until
# the next dashboard container start the Settings editor then degrades to
# read-only (the r+ probe fails on group r--) and admin_password is
# other-readable inside the containers that mount the dir. The next boot of
# this container converges it back to 0660.
HOMESERVER_DATA_DIR="/app/homeserver-data"
if [ -d "$HOMESERVER_DATA_DIR" ]; then
  chgrp 101 "$HOMESERVER_DATA_DIR" 2>/dev/null || true
  chmod 2775 "$HOMESERVER_DATA_DIR" 2>/dev/null || true
fi
if [ -f "$HOMESERVER_DATA_DIR/config.toml" ]; then
  chgrp 101 "$HOMESERVER_DATA_DIR/config.toml" 2>/dev/null || true
  chmod 0660 "$HOMESERVER_DATA_DIR/config.toml" 2>/dev/null || true
fi

# Switch to nextjs user and run the app
exec su-exec nextjs node server.js
