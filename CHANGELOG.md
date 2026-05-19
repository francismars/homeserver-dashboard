# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Vitest coverage for `cloudflare-config`, `server-config`, `public-health`, and `admin/generate_signup_token` route handlers (test count: 12 → 43; file coverage: 5 → 9).
- `LICENSE` (MIT).
- `CHANGELOG.md`.
- `CONTRIBUTORS.md`.
- `docs/AUDIT-2026-05-19.md` — forensic audit of the inherited state with the v1.0.0 punch list.
- `.github/dependabot.yml` for npm, github-actions, and docker updates.
- `.github/workflows/codeql.yml` for static analysis.
- CI gates: `knip`, `prettier --check`, and `docker build` in addition to existing lint/typecheck/test/build.
- `HEALTHCHECK` directive in the Dockerfile pointing at `/api/public-health`.

### Fixed

- `public-health` route: use the shared `isAbortError` helper so jsdom `DOMException` instances are correctly mapped to a 504 timeout rather than falling through to a 502.
- `dashboard-ci.yml`: removed the stale `working-directory: homeserver-dashboard` block and corrected `cache-dependency-path` — the repo root is the dashboard, CI never ran correctly before.
- `entrypoint.sh`: tightened Cloudflare config directory permissions from `0777`/`0666` to `0700`/`0600` so the tunnel token is not world-readable on a bind mount.
- Dockerfile port: unified on `8080` to match `package.json` dev/start scripts (was `3000`).

### Changed

- README: corrected local dev port (8080, not 3000); removed outdated "no tests currently live" line; updated related-project links to the `pubky` GitHub org; corrected the Users-tab description (disabled users list is live, not mock).
