# Homeserver Dashboard — Status Report

## What's Done

| Requirement | Status | Notes |
|---|---|---|
| Basic info (pubkey, address, version, users, disk) | **Done** | Live data from `/info` endpoint |
| Disable/enable user accounts | **Done** | By pubkey, wired to admin API |
| Generate invite codes + QR | **Done** | With aggregate usage stats |
| Delete any pubky URL by path | **Done** | Via admin WebDAV endpoint |
| Shadcn component library | **Done** | Own shadcn setup, matches Franky style |
| Cloudflare Tunnel config via UI | **Done** | Token + domain, persisted to disk |
| Umbrel app packaging | **Done** | docker-compose, gallery, x86 + ARM |
| Docker images | **Done** | Dashboard + homeserver, multi-arch |
| API Explorer | **Done** | Extra — lets admins test endpoints manually |

## Partially Done

| Requirement | Status | Gap |
|---|---|---|
| Config.toml display | **Read-only** | Edit requires a new admin endpoint or direct file write + restart. Homeserver has no restart or config-write API. |
| Invite tracking | **Aggregate only** | Shows total/used/unused counts. Per-invite user mapping exists in DB but no admin endpoint exposes it. |
| Disk usage | **Total only** | No per-user breakdown. Homeserver `/info` returns one number. Needs a new admin endpoint. |
| Logs | **Mock UI built** | Homeserver exposes no logs endpoint. UI is wired to fake data, ready to plug in when API exists. |

## Not Done

| Requirement | Why |
|---|---|
| Config.toml editing | Homeserver has no write-config or restart endpoint. Writing the file alone isn't useful without restart. |
| Trigger homeserver restart | Homeserver has no `/admin/restart` endpoint. Requirements already flagged this as post-MVP. |
| Per-user disk usage, activity, heaviest files | Homeserver has no endpoints for this. Requirements flagged as post-MVP (needs new admin endpoints). |
| Rate limits / hyper-params editing via UI | Config is TOML-based, no runtime API. Same blocker as config editing. |
| Unit / E2E tests | Zero tests exist. Vitest is configured but no test files written. |
| Reuse Franky components directly | Dashboard has its own shadcn copy. Components match the style but aren't shared from Franky's codebase. |
| StartOS packaging | Not wanted. |
| Testnet/mainnet toggle in single image | Not wanted. |

### Note: Extra Scope Delivered

A full WebDAV file browser was built (browse, edit, create, delete files and folders). The requirements explicitly said "No file explorer needed." It works and doesn't hurt, but it was effort that could have gone toward tests or the gaps above.

---

## Blockers

Most missing features trace to one root cause: the homeserver admin API is minimal (5 endpoints). The dashboard can only show what the server exposes.

These endpoints need Rust-side work before the dashboard can move forward:

| Needed Endpoint | Unblocks |
|---|---|
| `POST /admin/config` | Config editing from dashboard |
| `POST /admin/restart` | Restart after config change |
| `GET /admin/users/{pubkey}/usage` | Per-user disk stats |
| `GET /admin/logs` | Real log viewer |
| `GET /admin/signup_tokens` | Per-invite user tracking |

---

## Current Tasks (discussed with Chris)

1. **Cloudflare + Ring investigation.** Figure out why Cloudflare tunnels are not working with Ring. Will do testing — may require changes on the SDK side.
2. **PR on Core: blocked users list endpoint.** Add an admin API endpoint to list blocked/disabled users. This is a Core PR, not dashboard work.
3. **Dashboard: blocked users list UI.** Once the Core endpoint lands, wire it into the dashboard Users tab.

---

## Recommended Next Steps

1. **Tests.** Zero test coverage on a "production-ready" deliverable is the biggest gap. Unit tests for API proxy logic, E2E tests for core flows (generate invite, disable user, delete URL).

---

## Summary

The MVP core is functional: server info, user management, invites, URL deletion, Cloudflare setup, Umbrel deployment. The main gaps are tests (zero coverage) and features blocked by missing homeserver admin endpoints.
