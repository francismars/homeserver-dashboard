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

### Security

- WebDAV proxy now rejects path segments equal to `.`, `..`, or containing `\0`, `/`, or `\\` — defense-in-depth against path traversal on the homeserver `/dav/` endpoint.
- `cloudflare-config` POST now validates the tunnel token (length 32–2048 chars, URL-safe character class) before persisting; prevents storing junk on paste errors.

### Removed

- `src/components/organisms/DashboardLogs/` — the mock Logs tab. The Logs tab was already absent from the dashboard page; the component was orphaned and held `generateMockLogs()` placeholder data. A real Logs tab will be reintroduced once the homeserver exposes a logs admin endpoint.
- `src/services/user/` and `src/hooks/user/` — scaffold for an earlier user-listing approach that was never wired into the UI.
- `src/components/ui/{dropdown-menu,scroll-area}.tsx` — unused Shadcn primitives.
- `@radix-ui/react-dropdown-menu` and `@radix-ui/react-scroll-area` from dependencies — only consumed by the deleted UI primitives above.
- `dashboard-ci.yml`: removed the stale `working-directory: homeserver-dashboard` block and corrected `cache-dependency-path` — the repo root is the dashboard, CI never ran correctly before.
- `entrypoint.sh`: tightened Cloudflare config directory permissions from `0777`/`0666` to `0700`/`0600` so the tunnel token is not world-readable on a bind mount.
- Dockerfile port: unified on `8080` to match `package.json` dev/start scripts (was `3000`).

### Changed

- README: corrected local dev port (8080, not 3000); removed outdated "no tests currently live" line; updated related-project links to the `pubky` GitHub org; corrected the Users-tab description (disabled users list is live, not mock).
