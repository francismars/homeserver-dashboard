# Standalone vs Umbrel deployment awareness

Date: 2026-06-14. Status: design approved (3 product decisions confirmed); spec under review.

## Purpose

The dashboard image is identical for Umbrel and standalone, but its copy and
some of its features assume Umbrel. A standalone operator currently sees
irrelevant umbrelOS-backup guidance, "Restart the app from Umbrel" everywhere,
and a full Cloudflare setup UI whose flows cannot actually work without the
Umbrel cloudflared containers + config wrapper. This makes the dashboard
deployment-aware: it detects the platform at runtime and hides Umbrel-only
functionality / rewords Umbrel-only copy when running standalone.

## Decisions (from brainstorm, user-confirmed)

1. **Detection: an explicit `PLATFORM` env var.** The Umbrel compose sets
   `PLATFORM=umbrel`; standalone leaves it unset → `standalone`. One explicit
   source of truth; the same image serves both.
2. **Cloudflare on standalone: hide setup, keep status.** Hide everything that
   _sets up_ Cloudflare (the Settings Cloudflare tab and all flows, the
   `/cloudflare-guide` page, the "Set up access" / "Fix it" CTAs). KEEP the
   read-only Public-address row, its reachability check, and pkarr
   verification — a standalone operator may run their own tunnel/reverse proxy
   and still wants to see whether the published address is reachable and
   correctly published to the DHT.
3. **Restart copy: generic on standalone.** Replace "Restart the Pubky
   Homeserver app from Umbrel…" with platform-neutral wording ("restart your
   homeserver") wherever it appears.

## Why Cloudflare setup genuinely cannot work standalone

The dashboard's setup flows WRITE files (`token`/`config.yml`/
`credentials.json`/`testdrive.env`) into a shared dir that the Umbrel
**cloudflared containers** read and run. Standalone has no such containers, so
writing those files establishes no working tunnel. (The dashboard does embed
cloudflared and spawns it for the Connect login + the instant preview tunnel,
but the _persistent_ tunnel is always a separate container.) Hence the setup
UI is hidden standalone; the status views, which only depend on the published
record + relays + an HTTPS probe, still make sense.

## Architecture

### Detection + delivery

- `src/lib/server/platform.ts` — `export type Platform = 'umbrel' | 'standalone'`
  and `getPlatform()` returning `process.env.PLATFORM === 'umbrel' ? 'umbrel'
: 'standalone'`. Single source of truth, read lazily (call time).
- **Client delivery via the server root layout** (`src/app/layout.tsx` is a
  server component): it calls `getPlatform()` and renders a client
  `PlatformProvider` so every client component reads `usePlatform()` with no
  fetch and no flash (SSR-correct).
- **Server delivery**: API routes that need it call `getPlatform()` directly.
- `/api/capabilities` also returns `platform` (defense + anything that wants a
  server-validated value), reusing the existing capabilities fetch.

### Restart copy

- Replace the module constant `RESTART_APP_SENTENCE` (lib/restart-copy.ts,
  used in 27+ places) with `restartAppSentence(platform: Platform): string`:
  - umbrel → "Restart the Pubky Homeserver app from Umbrel (open the app's
    tile, then Restart)."
  - standalone → "Restart your homeserver to apply this."
- Server call sites pass `getPlatform()`; client call sites pass
  `usePlatform()`. (A thin `useRestartSentence()` hook wraps the client side.)

### Cloudflare gating

- **UI:** the Settings Cloudflare tab is hidden when `platform !== 'umbrel'`
  (extends the existing `isCloudflareTabVisible` gate); the `/cloudflare-guide`
  page renders a "not applicable to standalone" notice (or 404) and is not
  linked; the Overview's "Set up access"/"Fix it" CTAs and the get-started
  **reachable step** are omitted standalone (that step is a Cloudflare-setup
  action). The Public-address status row, reachability chip, and the whole
  pkarr "Pubky network" row + viewer stay.
- **Routes (defense in depth):** the Cloudflare setup routes
  (`/api/cloudflare-connect`, `/api/cloudflare-auto-setup`,
  `/api/cloudflare-preview`, `/api/cloudflare-disconnect`, and the POST of
  `/api/cloudflare-config`) return `404 not_supported` when
  `getPlatform() !== 'umbrel'`, so a hidden-but-reachable route can't act. The
  **GET** of `/api/cloudflare-config` still works (the status views read it).

### Backup note

- Platform-aware: umbrel keeps the umbrelOS-backup wording; standalone shows
  generic "back up this app's data directory; losing it loses this server's
  identity" without umbrelOS specifics.

## Hide/show matrix

| Surface                                                      | Umbrel                                                     | Standalone                               |
| ------------------------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------- |
| Server info / pubkey / version / logs / users / invites      | show                                                       | show                                     |
| Config editor                                                | show (admin_password read-only via ADMIN_PASSWORD_MANAGED) | show (admin_password editable)           |
| Public-address row + reachability chip                       | show                                                       | **show** (status only)                   |
| pkarr "Pubky network" row + viewer + Preview badge           | show                                                       | **show**                                 |
| Settings → Cloudflare tab (Connect/API-token/manual/Preview) | show                                                       | **hide**                                 |
| `/cloudflare-guide` page + its links                         | show                                                       | **hide**                                 |
| Overview "Set up access" / "Fix it" CTAs                     | show                                                       | **hide**                                 |
| Get-started checklist "reachable" step                       | show                                                       | **hide** (checklist = invite + signup)   |
| Restart copy                                                 | "…from Umbrel…"                                            | generic                                  |
| Backup note                                                  | umbrelOS wording                                           | generic                                  |
| Restart-pending callout (boot-stamp signal)                  | shows when pending                                         | naturally absent (no wrapper boot stamp) |

## Components / files touched

- New: `src/lib/server/platform.ts`, `src/components/providers/PlatformProvider.tsx` (client context + `usePlatform`), spec/plan docs.
- Modify: `src/app/layout.tsx` (inject provider), `src/lib/restart-copy.ts` (→ function), all RESTART_APP_SENTENCE call sites, `DashboardOverview.tsx` (CTAs, backup note, get-started wiring), `GetStartedChecklist` (omit reachable step when not provided), `ConfigDialog.tsx` (hide CF tab), `cloudflare-guide/page.tsx`, the 5 Cloudflare route handlers (refuse standalone), `/api/capabilities` (+platform).
- Umbrel compose (umbrel-app-store): add `PLATFORM: umbrel` to the `web` service env.
- README: document `PLATFORM` and standalone behavior.

## Error handling / edge cases

- `PLATFORM` unset or any value other than `umbrel` → `standalone` (fail safe
  toward the generic, non-Umbrel-specific experience).
- A standalone user who hand-set `PLATFORM=umbrel` gets the Umbrel UI (their
  choice); harmless.
- Cloudflare routes refusing on standalone return a clean 404 RouteError, not
  a 500.

## Testing

- `getPlatform()` unit: umbrel / unset / other → correct.
- `usePlatform()` + provider: renders both modes.
- `restartAppSentence()` unit: both platforms; spot-check a server route
  message and a client component both vary by platform.
- Component tests (both platforms) for: CF tab hidden standalone; Overview CTAs
  - reachable step hidden standalone but status rows shown; backup note wording.
- Route tests: each CF setup route → 404 on standalone, normal on umbrel;
  cloudflare-config GET still works standalone.
- e2e: the harness sets `PLATFORM=umbrel` (current specs unchanged); add a
  standalone spec asserting the CF tab/guide/CTAs are gone and the status rows
  remain.
- Docker reality check: run the image with `PLATFORM` unset → standalone UI;
  with `PLATFORM=umbrel` → current UI.

## Out of scope

- A full standalone "set up your own reverse proxy" guide (could be a later
  addition; for now standalone just hides CF setup).
- Per-feature toggles beyond platform (no general feature-flag system).
- Changing the admin_password gate (already platform-correct via
  ADMIN_PASSWORD_MANAGED).

## Rollout

Ships as one dashboard release; the Umbrel compose change (adding
`PLATFORM=umbrel`) goes out in the same app-store release so Umbrel keeps its
current experience. The two already-built Overview tweaks (Preview badge +
All-set expand) can ride the same release.
