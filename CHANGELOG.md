# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Baseline work toward v1.0.0: CI repair, test coverage, security fixes, dead-code cleanup.

### Added

- `GET /api/health` — dedicated liveness endpoint used by the Dockerfile HEALTHCHECK and any orchestrator probes. Always returns `200 { ok: true }`; does not consult downstream services.
- Vitest coverage for `cloudflare-config`, `server-config`, `public-health`, `admin/generate_signup_token`, and `health` route handlers (test count: 12 → 53; file coverage: 5 → 10).
- `LICENSE` (MIT, matching pubky-core).
- `CHANGELOG.md` following Keep a Changelog.
- `CONTRIBUTORS.md` crediting the original contractor.
- `docs/AUDIT-2026-05-19.md` — forensic audit of the inherited state with the v1.0.0 punch list.
- `.github/dependabot.yml` for npm, github-actions, and docker updates.
- `.github/workflows/codeql.yml` for static analysis.
- CI gates: `knip`, `prettier --check`, and `docker build` in addition to existing lint/typecheck/test/build.
- `HEALTHCHECK` directive in the Dockerfile against `/api/health` on `127.0.0.1`.

### Changed

- README: corrected local dev port (8080, not 3000); removed outdated "no tests currently live" line; updated related-project links to the `pubky` GitHub org; corrected the Users-tab description (disabled users list is live, not mock); now lists 5 tabs (matches the UI); added a forward-looking note about the Logs tab.
- Dockerfile port: unified on `8080` to match `package.json` dev/start scripts (was `3000`).
- Applied a one-time `prettier --write` baseline so `format:check` can be a strict CI gate going forward.

### Removed

- `src/components/organisms/DashboardLogs/` — the orphaned mock Logs tab. The dashboard page no longer has a Logs tab; the component held `generateMockLogs()` placeholder data with no consumer. A real Logs tab will be reintroduced once the homeserver exposes a logs admin endpoint.
- `src/services/user/` and `src/hooks/user/` — scaffold for an earlier user-listing approach that was never wired into the UI (and held seven `console.log` debugging statements).
- `src/components/ui/{dropdown-menu,scroll-area}.tsx` — unused Shadcn primitives.
- `src/components/molecules/Logo/` and `src/components/organisms/InvitesDialog/` — both flagged by `knip` as having zero consumers and held mock placeholder data. New components will be authored against real endpoints in follow-up PRs.
- `withTimeout` (in `src/lib/server/errors.ts`) and `logRouteWarn` (in `src/lib/server/logger.ts`) — unused exports.
- `@radix-ui/react-dropdown-menu` and `@radix-ui/react-scroll-area` from dependencies — only consumed by the deleted UI primitives above.
- `baseline-browser-mapping` from devDependencies — transitive only, no direct consumer.

### Fixed

- Dockerfile `HEALTHCHECK` actually works now. Originally pointed at `/api/public-health` (which requires a `?domain=` param and returns 400 without one) and used `localhost` (which Alpine resolves to `::1` while Next.js binds IPv4 only) — both fixed by adding `/api/health` and using `127.0.0.1`. Verified end-to-end by running the container and observing the `healthy` state transition.
- `public-health` route: use the shared `isAbortError` helper so jsdom `DOMException` instances are correctly mapped to a 504 timeout rather than falling through to a 502.
- `dashboard-ci.yml`: removed the stale `working-directory: homeserver-dashboard` block and corrected `cache-dependency-path` — the repo root is the dashboard, CI never ran correctly before.
- `entrypoint.sh`: tightened Cloudflare config directory permissions from `0777`/`0666` to `0700`/`0600` so the tunnel token is not world-readable on a bind mount.

### Security

- WebDAV proxy now rejects path segments equal to `.`, `..`, or containing `\0`, `/`, or `\\` — defense-in-depth against path traversal on the homeserver `/dav/` endpoint.
- `cloudflare-config` POST now validates the tunnel token (length 32–2048 chars, URL-safe character class) before persisting; prevents storing junk on paste errors.
