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
| StartOS packaging | Not started. |
| Testnet/mainnet toggle in single image | Build arg exists but no UI toggle. |

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

## Future Roadmap Proposal (Dashboard scope)

Items marked *Blocked: Core* require new homeserver admin endpoints — that work belongs to the Core/homeserver team, not the dashboard team. Dashboard work can proceed immediately on everything else.

### Phase 1: Operational Confidence (weeks 1–4)

**Monitoring & Health Dashboard**
- Disk space warnings at configurable thresholds (80%, 90%, 95%)
- Service health checks: is PostgreSQL up? Homeserver responding? Cloudflare tunnel connected?
- Uptime tracking with historical availability
- Dashboard health-at-a-glance with red/yellow/green indicators
- Alert channels: email, webhook (Discord/Slack/Telegram)

**Dashboard Audit Log**
- Log admin actions locally in the dashboard (who disabled/enabled users, generated invites, changed config)
- Searchable, filterable, exportable

### Phase 2: Better User & Invite Management (weeks 5–8)

**Blocked Users List & Management**
- Display list of disabled/blocked users (not just disable-by-pubkey)
- Bulk enable/disable
- *Blocked: Core — need `GET /admin/users/disabled` endpoint. PR in progress.*

**Invite System v2**
- Bulk invite generation
- Invite links with expiry dates and usage limits
- Per-invite tracking (which pubkey used which invite, when)
- Revocable invites
- *Blocked: Core — need `GET /admin/signup_tokens` endpoint to list tokens with usage details.*

**User Analytics**
- User growth over time (signups per day/week/month)
- Active vs inactive users
- Trend charts on the Overview page (not just current numbers)
- *Partially blocked: Core — need activity/last-seen data per user. Growth charts can be built dashboard-side if we persist invite usage timestamps.*

### Phase 3: Configuration & Quotas (weeks 9–12)

**Config Editing**
- Switch config viewer from read-only to editable
- Validate TOML before saving
- *Blocked: Core — need `POST /admin/config` and `POST /admin/restart` endpoints. Without restart, editing the file is useless.*

**Storage Quotas & Per-User Usage**
- Set per-user storage limits from the dashboard
- Visual storage usage breakdown per user
- Warning thresholds before users hit limits
- Growth trend charts and projected full-disk date
- *Blocked: Core — need `GET /admin/users/{pubkey}/usage` endpoint.*

**Rate Limiting UI**
- Per-user request rate limits configurable from dashboard
- IP blocklist/allowlist management
- *Blocked: Core — rate limits are TOML-only today, need runtime API.*

### Phase 4: Polish & Ecosystem (weeks 13+)

**Real Log Viewer**
- Replace mock logs with real structured log stream
- Filter by level, source, user
- *Blocked: Core — need `GET /admin/logs` endpoint.*

**Multi-Admin & Roles**
- Multiple admin accounts (not just one shared password)
- Roles: full admin vs read-only observer
- Per-admin audit trail
- *Dashboard-only work if we manage admin accounts in the dashboard layer. Otherwise Blocked: Core.*

**Custom Domain Wizard**
- Beyond Cloudflare: guided Let's Encrypt setup, DuckDNS, manual DNS with verification
- Domain verification checks
- *Dashboard-only work.*

**Federation & Network View**
- View PKARR record status (is the server discoverable? last republish?)
- Peer reachability checks
- *Partially blocked: Core — need federation/peer info endpoints.*

**StartOS Packaging**
- If still a target, ~1 week of work as originally scoped
- *Dashboard + deployment work.*

---

## Summary

The MVP core is functional: server info, user management, invites, URL deletion, Cloudflare setup, Umbrel deployment. The main gaps are tests (zero coverage) and features blocked by missing homeserver admin endpoints.
