# Pubky-core admin endpoints needed for dashboard v1.0.0

The dashboard ships as feature-complete only after these are live on the homeserver. This doc is the contract draft the dashboard team would like the pubky-core team to review and implement; each section is a paste-ready GitHub issue body.

All paths are relative to `ADMIN_BASE_URL` (no `/admin/` prefix — matches the existing `/info`, `/users/disabled`, `/generate_signup_token`, `/users/{pubkey}/disable` convention). Authentication uses the existing `X-Admin-Password` header. Pagination uses `limit` + `cursor` query params returning `{ items, next_cursor }`, matching `GET /users/disabled`.

---

## 1. `GET /signup_tokens` — list signup tokens and their consumers

**Purpose:** Replace the `MOCK_USERS_BY_INVITE` placeholder in `InvitesDialog`. The Invites tab currently shows aggregate counts (total/used/unused via `/info`); we need to show _which_ token was consumed by _which_ user, so admins can revoke or audit specific invites.

**Path:** `GET /signup_tokens?limit=<n>&cursor=<opaque>&state=<used|unused|all>`

**Query params:**

- `limit` (optional, default 20, max 200) — page size.
- `cursor` (optional) — opaque continuation token from a previous response.
- `state` (optional, default `all`) — filter by `used`, `unused`, or `all`.

**Response 200:**

```json
{
  "items": [
    {
      "token": "abc123...",
      "created_at": "2026-04-12T14:33:01Z",
      "used_at": "2026-04-12T14:35:11Z",
      "used_by": "0x9a7e...c0ff"
    },
    {
      "token": "def456...",
      "created_at": "2026-04-12T14:34:00Z",
      "used_at": null,
      "used_by": null
    }
  ],
  "next_cursor": null
}
```

Field notes:

- `token` is the full opaque signup token (admins already have full access via `X-Admin-Password`; no further sensitivity).
- `used_at` / `used_by` are `null` when the token is still unused.
- `used_by` is the consumer's pubkey (z-base-32, same shape as in `/users/disabled`).

**Errors:** Standard 401 if auth fails, 500 on DB error.

**Open questions for core:**

- Are tokens single-use or reusable? Affects whether `used_by` is a single pubkey or an array.
- Do we want a TTL field (expiration)? Currently no expiration is enforced anywhere.

---

## 2. `GET /users/{pubkey}/usage` — per-user disk usage breakdown

**Purpose:** Replace the comment in `src/services/admin/admin.ts` that says "No dedicated endpoint yet; reuse `/info` if available" — currently the dashboard can only show global disk usage, not who is using how much. Needed for the Users tab and for admins to act on storage hogs.

**Path:** `GET /users/{pubkey}/usage`

**Response 200:**

```json
{
  "pubkey": "0x9a7e...c0ff",
  "bytes_used": 134217728,
  "file_count": 412,
  "last_activity_at": "2026-05-18T22:01:03Z",
  "is_disabled": false,
  "top_paths": [
    { "path": "/pub/photos/", "bytes": 89478485, "file_count": 234 },
    { "path": "/pub/files/", "bytes": 33554432, "file_count": 178 }
  ]
}
```

Field notes:

- `top_paths` is an optional aid for the dashboard to render a "heaviest folders" chart — homeserver can return at most 5 entries, or omit the field entirely if implementation is expensive.
- `last_activity_at` is the last write timestamp; `null` if the user has only read.
- `is_disabled` mirrors `/users/disabled` so the dashboard can render a single row without two round-trips.

**Errors:** 404 if pubkey is unknown; 401 on auth failure.

**Adjacent endpoint (nice-to-have, not blocking):** `GET /users?limit=&cursor=&sort=bytes_used:desc` — paginated list of all users with the same shape as above, for the Users tab default view. If this is too expensive, the dashboard can fall back to listing `/users/disabled` plus drill-downs.

---

## 3. `GET /logs` — homeserver log tail / stream

**Purpose:** Replace the deleted `DashboardLogs` component's mock data and reintroduce the Logs tab on the dashboard. Today admins have to SSH into the box and `docker logs`; the dashboard should be able to do this in-app.

Two delivery modes (pick one or support both):

### 3a. Server-Sent Events stream (preferred)

**Path:** `GET /logs?level=<info|warn|error>&since=<iso8601>&follow=<bool>`

**Headers:**

- `Accept: text/event-stream`

**Response:** SSE stream. Each event is one log line in JSON:

```
event: log
data: {"ts":"2026-05-19T03:14:22.011Z","level":"info","target":"pubky_homeserver::admin","msg":"User disabled","fields":{"pubkey":"0x9a7e...","ip":"10.0.0.5"}}

```

When `follow=false`, the server closes the stream after replaying the last N (default 1000) lines. When `follow=true`, it stays open and pushes new lines as they arrive.

### 3b. Polling endpoint (fallback)

**Path:** `GET /logs?level=<…>&since_id=<opaque>&limit=<n>`

**Response 200:**

```json
{
  "items": [{ "id": "00018f3c...", "ts": "...", "level": "info", "target": "…", "msg": "…", "fields": {} }],
  "next_since_id": "00018f3d..."
}
```

Dashboard polls every 2-5 seconds with the last `next_since_id`.

**Errors:** 400 on invalid level, 401 on auth.

**Open questions:**

- Where do logs live? `tracing` to stdout means we need to teach the homeserver to also write to a ring buffer or sqlite for the API to read. This is the biggest implementation question.
- Retention policy? Suggest "last 24 hours or last 100k lines, whichever is smaller", configurable.
- Redaction? Logs should already not contain `X-Admin-Password` or PII, but a final pass through a key blocklist (`password`, `token`, `secret`, `authorization`) before serving is cheap insurance.

---

## 4. `POST /config` + `POST /restart` — write config and reload

**Purpose:** Replace the "Config endpoint not available yet" placeholder in `AdminService.saveConfig()` and wire the `ConfigDialog` write mode + the `ServerControlDialog`. Today the dashboard can read `config.toml` (via the mounted volume) but cannot write it, and the restart UI is a `setTimeout` simulation.

### 4a. `POST /config`

**Body:**

```json
{
  "config_toml": "<full file body>",
  "checksum": "sha256:<hex>"
}
```

**Behavior:**

- The `checksum` is the SHA-256 of the _current_ `config.toml` as the dashboard last read it. If the on-disk version has changed since (someone edited it out-of-band), the request **must fail with 409 Conflict** so we don't silently clobber. Returns `{ "current_checksum": "sha256:…" }` in the conflict response so the dashboard can show a diff.
- Validate as TOML before writing. Validate semantically (port ranges, paths exist, etc.). Reject invalid configs with 400 + structured error pointing at the offending key.
- On success, write atomically (write to `config.toml.tmp` then rename) so a crash mid-write can't corrupt the file.

**Response 200:**

```json
{
  "checksum": "sha256:<new_hex>",
  "updated_at": "2026-05-19T..."
}
```

**Errors:** 400 (invalid TOML/values), 409 (checksum mismatch), 500 (write failed), 401 (auth).

### 4b. `POST /restart`

**Body:** empty.

**Behavior:** Trigger a clean homeserver restart (re-read `config.toml`, drop and re-bind sockets). The HTTP server should finish replying with 202 _before_ actually restarting, so the client gets confirmation; the dashboard waits and re-polls `/info` to detect when the server is back up.

**Response 202:**

```json
{
  "scheduled_at": "2026-05-19T...",
  "estimated_downtime_ms": 5000
}
```

**Errors:** 401, 503 if a restart is already in progress.

**Open questions for core:**

- Is a graceful restart (drain connections, exec self) doable in the current process model, or do we need a supervisor (the Umbrel docker `restart: on-failure` policy + `exit(0)` from the process)? The latter is simpler but means restart UX is "container will come back in ~10s". The dashboard's E2E test must tolerate either.
- Should `POST /config` automatically trigger a restart when the change requires one, or is the dashboard responsible for the two-step? Recommendation: keep them separate so the dashboard can batch many config edits before one restart.

---

## Sequencing

To keep the dashboard team unblocked while core team works in parallel:

1. **First**: `GET /signup_tokens` and `GET /users/{pubkey}/usage` (read-only, low blast radius).
2. **Second**: `GET /logs` (the schema-design is the work; pick SSE or polling).
3. **Last**: `POST /config` + `POST /restart` (the highest-risk pair; needs the most review).

Each lands on the dashboard side behind a feature flag (`NEXT_PUBLIC_ENABLE_*` envs or similar), defaulting off while mocks remain so we can ship preview builds at any time without exposing half-done UX.

## Out of scope for v1.0

The audit also flagged "delete-user" as missing alongside disable-user; that's intentionally out of scope. Disable-then-prune-via-quota is the current intended model; a hard delete endpoint is a larger product question.

---

## How this was drafted

This doc was drafted by the takeover team after reading the inherited dashboard codebase. The TypeScript types under `src/services/admin/admin.types.ts` already encode the dashboard's expected shapes for several of these (`AdminConfigResponse`, `AdminUsageResponse`, etc.) — those types were updated in lockstep with this proposal so the dashboard side is "ready and waiting" for any of these endpoints to land.

When this is approved, file each section as a separate issue in `pubky/pubky-core` so they can be implemented and shipped independently.
