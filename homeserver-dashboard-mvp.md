# Homeserver Dashboard MVP (Current Scope)

This document tracks the **current MVP scope** for `homeserver-dashboard/` after the recent cleanup/scope reduction.
It is intentionally aligned with the actual code in `src/app/dashboard/page.tsx` and the current `README.md`.

## 🎯 Current Scope (what exists today)

### Routes

- `/` redirects to `/dashboard`
- `/dashboard` is the main UI (single-page, tabbed)

### Tabs in `/dashboard`

- **Overview**
  - Reads homeserver stats from `GET /info`
  - Shows connection status (configured vs mock mode)
  - Pubkey/version may show as **mock** if missing from `/info`
- **Users**
  - Generate signup tokens via `GET /generate_signup_token`
  - Disable / enable a user by pubkey via:
    - `POST /users/{pubkey}/disable`
    - `POST /users/{pubkey}/enable`
  - Displays a **mock disabled-users list** sized to `/info.num_disabled_users` (until an API exists for listing disabled users)
  - The code does include a **WebDAV root scan** (`UserService.listUsers()`), currently used mainly for validation, not a full “list all users” UI.
- **Files**
  - WebDAV browser (list/read/write/delete/move/create-dir) using `/dav/*` with **Basic Auth**
- **Logs**
  - Mock log viewer UI (no backend logs endpoint is wired)
- **API**
  - API Explorer for admin/client/metrics endpoints (manual requests)

### Settings menu (navbar)

- **Configuration**: mock, read-only TOML view (no backend config endpoints wired)
- **Restart / Shutdown**: mock dialogs (no backend server-control endpoints wired)

## ✅ Real Backend Integration (implemented)

### Admin API (X-Admin-Password)

Used by `AdminService`:

- `GET /info`
- `GET /generate_signup_token`
- `POST /users/{pubkey}/disable`
- `POST /users/{pubkey}/enable`
- `DELETE /webdav/{*entry_path}`

### WebDAV API (Basic Auth)

Used by `WebDavService`:

- `PROPFIND` directory listing
- `GET` read file
- `PUT` write file
- `DELETE` delete entry
- `MKCOL` create directory
- `MOVE` rename/move
- `COPY` is implemented in the service, but not currently exposed as a UI action

## 🟡 Mock / Placeholder Areas (not implemented on backend yet)

- **Logs**
  - UI exists; backend endpoint needed (e.g. `GET /logs` or SSE)
- **Config**
  - UI is read-only mock; backend endpoints needed (e.g. `GET /config`, `PUT /config`)
- **Server control**
  - UI dialogs exist; backend endpoints needed (restart/shutdown)
- **Disabled users list**
  - The “count” is real (`/info.num_disabled_users`) but the list items are mock until a list endpoint exists

## ❌ Removed / Shelved From the Old MVP

These items were previously described in this doc but are **not part of the current dashboard code**:

- Usage tab (storage capacity / resource trend charts)
- User profile / sign-in / secret key handling
- User statistics overlays
- Multi-homeserver management / PKARR discovery / settings sync
- Toast system (`sonner`) and Pubky SDK usage (`@synonymdev/pubky`)
- Extra env vars like `NEXT_PUBLIC_CLIENT_BASE_URL`, `NEXT_PUBLIC_ADMIN_ENV`, `NEXT_PUBLIC_PKARR_RELAYS`
- Hooks that no longer exist: `useAdminUsage`, `useConfigEditor`

## 🔧 Environment Variables (current)

The UI reads configuration from:

```bash
NEXT_PUBLIC_ADMIN_BASE_URL=http://localhost:6288
NEXT_PUBLIC_ADMIN_TOKEN=your-admin-password
```

Behavior:

- If `NEXT_PUBLIC_ADMIN_BASE_URL` is empty, admin API calls will fail with “not configured” errors.

## 🧰 Repo Hygiene / Tooling (current)

The dashboard includes:

- **ESLint** (flat config via `eslint.config.mjs`)
- **Prettier** (`.prettierrc`, `.prettierignore`)
- **Knip** (`knip.json`) to detect unused files/deps/exports

Key scripts in `package.json`:

- `npm run lint` / `npm run lint:fix`
- `npm run format` / `npm run format:check`
- `npm run knip`
- `npm run dev` / `npm run build` / `npm start`

Note: we run ESLint directly (`eslint .`) rather than `next lint`.

## 🧪 Testing

Status: **Not started** (Vitest is installed, but there are no test files currently in this package).

## 📦 Packaging / Deployment

Status: **Not started** (no Dockerfile / compose / deployment docs yet).

## Next Priorities

1. Add backend endpoints for **logs**, **config read/write**, **disabled users listing**, and **server control** (or remove mock UI if not planned)
2. Add basic tests (smoke renders + a few interaction tests)
3. Add packaging/deployment docs if this is intended to be shipped independently

 
