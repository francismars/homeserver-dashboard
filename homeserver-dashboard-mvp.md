# Homeserver Dashboard MVP

**Standalone Project**: This is a separate repository from Franky, but uses the same design system, technologies, and UI patterns.

High-level blueprint for a Shadcn/Franky-style homeserver admin UI plus required admin endpoints. Targets modern browsers and runs against real homeserver admin APIs, with a mock mode for local dev.

## 🎯 Implementation Status

**Overall Progress: ~75% Complete**

### ✅ Completed Phases

- ✅ **Phase 0**: Bootstrap - COMPLETE
  - Next.js project scaffolded, dependencies installed, design system copied
  - Shadcn components installed (tabs, card, button, input, textarea, dialog, alert, skeleton, label)
  - `.env.example` created with proper `NEXT_PUBLIC_` prefixes

- ✅ **Phase 1**: Services & Hooks - COMPLETE  
  - `AdminService` with all endpoints (info, usage, config, delete, disable, invite)
  - Mock adapter with realistic data
  - All hooks implemented (`useAdminInfo`, `useAdminUsage`, `useAdminActions`, `useConfigEditor`)
  - Auto-mock mode when env vars missing (dev-friendly)

- ✅ **Phase 2**: UI Shell - COMPLETE
  - `/dashboard` page with 5-tab navigation
  - Loading skeletons and error states
  - All Shadcn UI components created

- ✅ **Phase 3**: Components - COMPLETE
  - **Atoms**: `StatCard`, `ProgressBar`
  - **Molecules**: `ConfigEditor`, `ActionPanel`, `InviteList`
  - **Organisms**: `DashboardOverview`, `DashboardUsage`, `DashboardConfig`, `DashboardActions`
  - All components functional and wired to hooks

### ⚠️ Partially Complete

- ⚠️ **Phase 4**: Polish & UX - PARTIAL
  - ✅ Confirm dialogs implemented
  - ✅ Error handling with Alert components
  - ❌ Toast notifications (using Sonner) - NOT IMPLEMENTED
  - ❌ Success feedback messages - NOT IMPLEMENTED
  - ❌ Clear inputs on success - NOT IMPLEMENTED
  - ❌ Env selector (mainnet/testnet toggle) - NOT IMPLEMENTED

### ❌ Not Started

- ❌ **Phase 5**: Testing - NOT STARTED
  - No unit tests, snapshot tests, or hook tests written yet
  - Vitest configured but no test files created

- ❌ **Phase 6**: Packaging & Docs - NOT STARTED
  - No README.md
  - No Dockerfile
  - No docker-compose.yml
  - No deployment documentation

### MVP Core Features Status

**✅ FUNCTIONAL:**
- ✅ Basic info display (pubkey, address, version, disk usage, users, signup codes)
- ✅ Usage data visualization (users, storage with progress bar)
- ✅ Admin actions (delete URL with confirm, disable user with confirm, generate invite)
- ✅ Config editor (mock mode, ready for backend endpoints)
- ✅ Copy-to-clipboard for invite codes

**Ready for Testing**: Dashboard is functional with mock data. Can connect to real homeserver when `NEXT_PUBLIC_ADMIN_BASE_URL` and `NEXT_PUBLIC_ADMIN_TOKEN` env vars are set.

**Next Priority**: Add toast notifications (Phase 4), then write tests (Phase 5), then packaging/docs (Phase 6).

## MVP Requirements (Priority)

### Must Have

1. **Basic Info Display**
   - Homeserver pubkey
   - IP:port (address)
   - Current version
   - Disk usage (used/total)
   - Uptime (if available)

2. **Usage Data**
   - Total number of signed-up users
   - Disk usage summary
   - Users by invite code (if data available)

3. **Admin Actions**
   - Delete any pubky URL (input URL → confirm → delete)
   - Disable/ban user accounts (input pubkey → confirm)
   - Generate invite codes (single or multiple)

4. **Config Editor** (MVP: read-only or mock until backend adds endpoints)
   - Display Config.toml
   - Edit capability (if backend supports)
   - Save with conflict handling (checksum-based)

### Post-MVP (Not Blocking)

- Trigger homeserver restart
- Activity feed (last sign-ins)
- Heaviest files / disk usage by user
- Filter by extension
- Rate limit controls
- Logs display
- Testnet/mainnet toggle (can be env-based for MVP)

## Implementation Plan (Standalone Dashboard)

### ✅ Phase 0 – Bootstrap (COMPLETE)
- ✅ Scaffolded Next.js + Tailwind + Shadcn; copied Franky's `globals.css`, `components.json`, `utils.ts`
- ✅ Installed Shadcn primitives (button, card, input, textarea, tabs, dialog, alert, skeleton, label)
- ✅ Created `.env.example` with `NEXT_PUBLIC_ADMIN_BASE_URL`, `NEXT_PUBLIC_ADMIN_TOKEN`, `NEXT_PUBLIC_ADMIN_MOCK`
- ✅ Set up TypeScript paths and project structure
- ✅ Added `tw-animate-css` dependency

### ✅ Phase 1 – Services & Hooks (COMPLETE)
- ✅ `src/services/admin`: `getInfo()`, `generateInvite()`, `disableUser()`, `enableUser()`, `deleteUrl()`, `getUsage()`, `getConfig()`, `saveConfig()`
- ✅ Mock adapter with realistic mock data
- ✅ Hooks: `useAdminInfo`, `useAdminUsage`, `useAdminActions`, `useConfigEditor`
- ✅ Error normalization and handling (prevents HTML error pages from showing)
- ✅ Auto-enables mock mode when `baseUrl` is empty (dev-friendly)

### ✅ Phase 2 – UI Shell (COMPLETE)
- ✅ `/dashboard` page with 5 tabs (Overview, Usage, Config, Actions, Invites)
- ✅ Loading/skeleton states for all sections
- ✅ Error states with Alert components
- ✅ Created Shadcn UI components: tabs, card, skeleton, alert, button, textarea, dialog, input, label

### ✅ Phase 3 – Components (COMPLETE)
- ✅ **Atoms**: `StatCard`, `ProgressBar`
- ✅ **Molecules**: `ConfigEditor` (with save/reset, checksum, dirty state), `ActionPanel` (with confirm dialog), `InviteList` (with copy-to-clipboard)
- ✅ **Organisms**: `DashboardOverview`, `DashboardUsage`, `DashboardConfig`, `DashboardActions`
- ✅ All components wired to hooks and functional
- ✅ Config editor works in mock mode (ready for backend endpoints)

### ⚠️ Phase 4 – Polish & UX Safeguards (PARTIAL)
- ✅ Confirm dialogs implemented in `ActionPanel` for delete/disable actions
- ✅ Error handling with Alert components
- ❌ **Missing**: Toast notifications for success/error feedback
- ❌ **Missing**: Clear inputs on successful actions
- ❌ **Missing**: Success feedback messages
- ❌ **Missing**: Optional env selector (mainnet/testnet toggle)

**Remaining work:**
- Add toast notifications (using Sonner) for success/error feedback
- Clear form inputs after successful actions
- Add success messages/feedback
- Optional: Add env selector component

### ❌ Phase 5 – Testing (NOT STARTED)
- ❌ No unit tests written yet
- ❌ No snapshot tests
- ❌ No hook tests
- ❌ No e2e tests

**Remaining work:**
- Write component tests (sanity + snapshots) for all new components
- Write hook tests with mocked services
- Add snapshot tests following Franky's patterns
- Set up Vitest configuration if needed

### ❌ Phase 6 – Packaging & Docs (NOT STARTED)
- ✅ `.env.example` created
- ❌ No README.md
- ❌ No Dockerfile
- ❌ No docker-compose.yml
- ❌ No deployment documentation

**Remaining work:**
- Create comprehensive README with setup instructions
- Add Dockerfile for UI-only container
- Add docker-compose.yml for local dev
- Document CORS requirements and deployment notes

**Why phased?** Unblocks UI quickly with mocks, allows parallel work, and accommodates backend gaps (config/usage breakdown) without stalling.

## Project Setup

### Repository Structure

This is a **standalone Next.js project** (separate from Franky):

```
homeserver-dashboard/
├── .env.example
├── .gitignore
├── components.json                    # Shadcn config (copy from Franky)
├── package.json
├── postcss.config.mjs
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
├── README.md
├── Dockerfile                         # For Umbrel/StartOS packaging
├── docker-compose.yml                 # Optional: for local dev
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Redirect to /dashboard
│   │   ├── globals.css                # Copy Tailwind theme from Franky
│   │   └── dashboard/
│   │       ├── page.tsx               # Main dashboard page (tabbed layout)
│   │       ├── page.test.tsx          # Page tests
│   │       └── loading.tsx            # Loading skeleton
│   │
│   ├── components/
│   │   ├── ui/                        # Shadcn components (install via CLI)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── badge.tsx
│   │   │   └── toast.tsx
│   │   │
│   │   ├── atoms/
│   │   │   ├── StatCard/
│   │   │   │   ├── StatCard.tsx
│   │   │   │   ├── StatCard.test.tsx
│   │   │   │   ├── StatCard.types.ts
│   │   │   │   └── index.ts
│   │   │   └── ProgressBar/
│   │   │       ├── ProgressBar.tsx
│   │   │       ├── ProgressBar.test.tsx
│   │   │       └── index.ts
│   │   │
│   │   ├── molecules/
│   │   │   ├── ConfigEditor/
│   │   │   │   ├── ConfigEditor.tsx
│   │   │   │   ├── ConfigEditor.test.tsx
│   │   │   │   ├── ConfigEditor.types.ts
│   │   │   │   └── index.ts
│   │   │   ├── ActionPanel/
│   │   │   │   ├── ActionPanel.tsx
│   │   │   │   ├── ActionPanel.test.tsx
│   │   │   │   └── index.ts
│   │   │   └── InviteList/
│   │   │       ├── InviteList.tsx
│   │   │       ├── InviteList.test.tsx
│   │   │       └── index.ts
│   │   │
│   │   └── organisms/
│   │       ├── DashboardOverview/
│   │       │   ├── DashboardOverview.tsx
│   │       │   ├── DashboardOverview.test.tsx
│   │       │   └── index.ts
│   │       ├── DashboardUsage/
│   │       │   ├── DashboardUsage.tsx
│   │       │   ├── DashboardUsage.test.tsx
│   │       │   └── index.ts
│   │       ├── DashboardConfig/
│   │       │   ├── DashboardConfig.tsx
│   │       │   ├── DashboardConfig.test.tsx
│   │       │   └── index.ts
│   │       └── DashboardActions/
│   │           ├── DashboardActions.tsx
│   │           ├── DashboardActions.test.tsx
│   │           └── index.ts
│   │
│   ├── libs/
│   │   ├── utils.ts                   # cn() helper (copy from Franky)
│   │   ├── error/                     # Error handling utilities
│   │   │   ├── error.ts
│   │   │   └── error.types.ts
│   │   └── network/                   # HTTP client utilities
│   │       └── fetch.ts
│   │
│   ├── services/
│   │   └── admin/
│   │       ├── admin.test.ts
│   │       ├── admin.ts                # HTTP client for admin endpoints
│   │       ├── admin.types.ts           # Request/response types
│   │       ├── admin.mock.ts            # Mock implementation for dev
│   │       └── index.ts
│   │
│   └── hooks/
│       └── admin/
│           ├── useAdminInfo/
│           │   ├── useAdminInfo.tsx
│           │   ├── useAdminInfo.test.tsx
│           │   ├── useAdminInfo.types.ts
│           │   └── index.ts
│           ├── useAdminUsage/
│           │   ├── useAdminUsage.tsx
│           │   ├── useAdminUsage.test.tsx
│           │   └── index.ts
│           ├── useConfigEditor/
│           │   ├── useConfigEditor.tsx
│           │   ├── useConfigEditor.test.tsx
│           │   └── index.ts
│           └── useAdminActions/
│               ├── useAdminActions.tsx
│               ├── useAdminActions.test.tsx
│               └── index.ts
│
└── .env.example                        # ADMIN_* env vars
```

### Bootstrap Instructions

1. **Create Next.js project:**
   ```bash
   npx create-next-app@latest homeserver-dashboard --typescript --tailwind --app --no-src-dir
   cd homeserver-dashboard
   ```

2. **Install dependencies** (copy from Franky's `package.json`):
   ```bash
   npm install next@16.0.7 react@19.2.1 react-dom@19.2.1
   npm install @radix-ui/react-dialog @radix-ui/react-label @radix-ui/react-select @radix-ui/react-slot @radix-ui/react-toast
   npm install class-variance-authority clsx tailwind-merge lucide-react zod sonner
   npm install -D vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react
   npm install -D tailwindcss@4.1.17 @tailwindcss/postcss postcss prettier prettier-plugin-tailwindcss
   ```

3. **Copy design system from Franky:**
   - Copy `components.json` → configure Shadcn
   - Copy `src/app/globals.css` → includes Tailwind theme variables
   - Copy `src/libs/utils.ts` → `cn()` helper function
   - Copy `postcss.config.mjs` → PostCSS config

4. **Install Shadcn components:**
   ```bash
   npx shadcn@latest add button card input textarea table tabs dialog alert badge toast
   ```

5. **Setup TypeScript paths** (`tsconfig.json`):
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

### Design System Reuse

**Key files to copy from Franky:**
- `src/app/globals.css` - Tailwind theme with CSS variables (colors, radius, shadows)
- `components.json` - Shadcn configuration
- `src/libs/utils.ts` - Utility functions (especially `cn()` for className merging)

**Why standalone but matching design:**
- Same Shadcn components → visual consistency
- Same Tailwind theme → identical colors, spacing, typography
- Same component patterns → familiar codebase structure
- Independent deployment → can version/release separately

### Simplified Architecture

Since this is standalone (not part of Franky's core), use a simpler architecture:

- **Services** (`src/services/admin/`) - HTTP client for admin endpoints
- **Hooks** (`src/hooks/admin/`) - React hooks that call services directly
- **Components** - UI components using Shadcn primitives
- **No controllers/application/pipes layers** - Keep it simple for MVP

This matches the MVP scope while maintaining clean separation of concerns.

### Key Conventions

1. **Routes**: Next.js App Router (`src/app/dashboard/page.tsx`)
2. **Components**: Atomic design (atoms → molecules → organisms)
3. **Services**: HTTP client layer (`src/services/admin/`)
4. **Hooks**: React hooks for data fetching (`src/hooks/admin/`)
5. **Tests**: Co-located (`.test.tsx` or `.test.ts`)
6. **Exports**: Each folder has `index.ts` for clean imports

### File Naming Patterns

- Components: `PascalCase.tsx` (e.g., `StatCard.tsx`)
- Services: `camelCase.ts` (e.g., `admin.ts`)
- Types: `*.types.ts` (e.g., `admin.types.ts`)
- Tests: `*.test.tsx` or `*.test.ts`
- Hooks: `usePascalCase.tsx` (e.g., `useAdminInfo.tsx`)

### Import Paths

- Use `@/` aliases: `@/components`, `@/hooks`, `@/libs`, `@/services`
- Example: `import { StatCard } from '@/components/atoms/StatCard'`
- Example: `import { useAdminInfo } from '@/hooks/admin/useAdminInfo'`

## Tech Stack

**Same as Franky:**
- **Next.js 16** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS 4** (with same theme variables)
- **Shadcn UI** (New York style)
- **Radix UI** primitives
- **Vitest** + React Testing Library
- **Lucide React** icons

**Simplified from Franky:**
- No Dexie/IndexedDB (no local-first storage needed)
- No Zustand (use React state/hooks)
- No complex core layer (services + hooks only)

## Environment Variables

✅ `.env.example` created with the following variables:

```bash
# Homeserver admin endpoint (use NEXT_PUBLIC_ prefix for client-side access)
NEXT_PUBLIC_ADMIN_BASE_URL=http://localhost:8080
NEXT_PUBLIC_ADMIN_TOKEN=your-admin-password-or-token

# Environment (mainnet/testnet) - optional
NEXT_PUBLIC_ADMIN_ENV=testnet

# Mock mode (use mock data instead of real API)
# Defaults to mock mode if NEXT_PUBLIC_ADMIN_BASE_URL is not set
NEXT_PUBLIC_ADMIN_MOCK=1
```

**Note**: All env vars use `NEXT_PUBLIC_` prefix because they're accessed in client-side hooks. Create `.env.local` (gitignored) for local development.

## Backend Endpoint Mapping

The homeserver already exposes admin endpoints (see `pubky-core/pubky-homeserver/src/admin_server/`). Frontend will connect to these:

### Existing Endpoints (No Backend Changes Needed)

| Backend Route | Method | Frontend Service Method | Purpose |
|--------------|--------|------------------------|---------|
| `/info` | GET | `AdminService.getInfo()` | Server stats (users, disk, signup codes) |
| `/generate_signup_token` | GET | `AdminService.generateInvite()` | Generate single invite token |
| `/users/{pubkey}/disable` | POST | `AdminService.disableUser(pubkey)` | Disable user account |
| `/users/{pubkey}/enable` | POST | `AdminService.enableUser(pubkey)` | Enable user account |
| `/webdav/{*entry_path}` | DELETE | `AdminService.deleteUrl(path)` | Delete entry by WebDAV path |

### Auth Model

**Current Implementation:**
- ✅ Reads `NEXT_PUBLIC_ADMIN_TOKEN` from env
- ✅ Sends as `Authorization: Bearer <token>` header
- ✅ Handles non-OK responses as errors (401, 404, etc.)
- ✅ Error messages filtered to avoid showing HTML error pages

**Backend Compatibility:**
- Backend uses `AdminAuthLayer` (password-based)
- Frontend sends Bearer token (may need adjustment based on backend's actual auth mechanism)
- 401 responses handled as auth failures

### Missing Endpoints (Frontend Will Mock/Stub)

**Status:**
- ✅ `GET /config` - **Mocked** in `AdminService.getConfig()` (returns mock TOML config)
- ✅ `PUT /config` - **Mocked** in `AdminService.saveConfig()` (simulates save with checksum)
- ✅ `GET /usage` - **Uses `/info` data** - `AdminService.getUsage()` extracts usage from info response
- ⚠️ `POST /invite` - **Single token only** - Uses existing `/generate_signup_token` endpoint (bulk generation not available)

**Note**: Config endpoints are fully functional in mock mode. When backend adds these endpoints, just remove the mock check in `AdminService`.

## Information Architecture & Screens (MVP)
- Route: `/dashboard` (or `/` redirects to `/dashboard`) with tabbed/sectioned layout.
- Sections:
  - **Overview**: homeserver pubkey, address (IP:port), version, uptime, disk usage (used/total), status badge.
  - **Usage**: total users, users by invite (table), storage by user (top N; optional if data sparse), quick metrics cards.
  - **Config Editor**: load `Config.toml`, edit in textarea/monaco-lite, show checksum/last saved, save with optimistic feedback and conflict handling.
  - **Admin Actions**:
    - Delete URL (input + confirm).
    - Disable/Ban user (user id input, optional reason, confirm).
    - Generate invite codes (count, optional expiry; list recently generated).
  - **System Messages**: inline error/success toasts and banners for degraded state.
- Navigation: left rail or top tabs using existing Shadcn `Tabs`/`Card`/`Alert`. Avoid file explorer. Optional env selector (mainnet/testnet) as non-blocking toggle that swaps base URL/token.

## Admin API Contracts (MVP)
Auth: admin token header `x-admin-token: <token>` (bearer-style allowed). All responses use `application/json`.

Error shape (aligns with `AppError`): `{ type: string; message: string; code?: string | number; details?: Record<string, unknown> }`.

Endpoints:
- `GET /admin/info`
  - Res: `{ pubkey: string; address: string; version: string; uptimeSeconds?: number; disk: { usedBytes: number; totalBytes: number } }`
- `GET /admin/usage`
  - Res: `{ usersTotal: number; usersByInvite?: Record<string, number>; storageByUser?: Array<{ user: string; usedBytes: number }>; period?: string }`
- `GET /admin/config`
  - Res: `{ configToml: string; checksum: string; updatedAt?: string }`
- `PUT /admin/config`
  - Req: `{ configToml: string; checksum?: string }`
  - Res: `{ saved: true; checksum: string; updatedAt?: string }`
  - 409 on checksum mismatch with `{ type: 'CONFIG_CONFLICT', details: { serverChecksum } }`
- `POST /admin/delete-url`
  - Req: `{ url: string }`
  - Res: `{ deleted: boolean }`
- `POST /admin/disable-user`
  - Req: `{ user: string; reason?: string }`
  - Res: `{ disabled: true }`
- `POST /admin/invite`
  - Req: `{ count?: number; expiresAt?: string }`
  - Res: `{ invites: string[] }`

Post-MVP (not blocking): restart endpoint, activity feed, heaviest files, rate-limit tuning, logs tailing.

## UI Architecture & Components

**Simplified standalone architecture:**
- Placement: `src/app/dashboard/page.tsx` with tabbed layout
- Reuse Shadcn primitives: `Card`, `Tabs`, `Button`, `Input`, `Textarea`, `Badge`, `Table`, `Alert`, `Dialog`, `Skeleton`, `Tooltip`, `Toast`
- Proposed new components (Shadcn-based):
  - `StatCard` (atoms) - label/value/icon/intent for overview/usage metrics
  - `ProgressBar` (atoms) - disk usage visualization
  - `ConfigEditor` (molecules) - textarea + checksum display + save/reset buttons + dirty indicator
  - `ActionPanel` (molecules) - form + confirm dialog wrapper for destructive actions
  - `InviteList` (molecules) - shows generated invites with copy affordance
  - `DashboardOverview`, `DashboardUsage`, `DashboardConfig`, `DashboardActions` (organisms) - main dashboard sections

**Data flow (simplified):**
- Hooks (`src/hooks/admin/`) call Services (`src/services/admin/`) directly
- Services handle HTTP requests and error normalization
- Hooks manage React state, loading, error handling
- Components consume hooks and render UI

**No complex layering needed:**
- No controllers/application/pipes (keep it simple for MVP)
- Services → Hooks → Components

## Data & Interaction Flows

**Implemented:**
- ✅ Load overview/usage: Shows skeletons; upon error, renders inline `Alert` component
- ✅ Config save: Fetches `configToml + checksum`; shows "Saving…" state; handles errors with Alert
- ✅ Delete URL / Disable user: Requires confirm dialog via `ActionPanel`; shows error Alert on failure
- ✅ Generate invite: Renders returned token in `InviteList` with copy buttons; keeps last 10 generated invites in state
- ✅ Copy-to-clipboard: Implemented in `InviteList` with visual feedback

**Remaining:**
- ❌ Toast notifications: Success/error toasts not yet implemented (currently using Alert components)
- ❌ Clear inputs: Form inputs not cleared after successful actions
- ❌ Config conflict handling: 409 conflict dialog not implemented (backend endpoint not available yet)
- ❌ Optional env switch: Swapping base URL/token to trigger refetch not implemented

## Testing Strategy

**Status: ❌ NOT STARTED**

**Follow Franky's testing patterns** (reference `franky/.cursor/rules/component-testing.mdc`):

**Planned Tests:**
- **Component tests**: Sanity render, click/hover handlers, single-expect snapshots for key states (loading, error, populated)
  - `StatCard.test.tsx` - Render with different props, icon, intent variants
  - `ProgressBar.test.tsx` - Different percentage values, color states
  - `ConfigEditor.test.tsx` - Edit, save, reset, error states
  - `ActionPanel.test.tsx` - Form submission, confirm dialog, error handling
  - `InviteList.test.tsx` - Generate, copy, empty state
  - `DashboardOverview.test.tsx`, `DashboardUsage.test.tsx`, etc. - Loading/error/data states

- **Hook tests**: Test success/error states with mocked admin service; ensure checksum conflict path covered
  - `useAdminInfo.test.tsx` - Success, error, loading states
  - `useAdminUsage.test.tsx` - Data transformation from info response
  - `useConfigEditor.test.tsx` - Load, edit, save, conflict handling
  - `useAdminActions.test.tsx` - Delete, disable, generate invite flows

- **Snapshot tests**: Grouped in `ComponentName - Snapshots` describe block, max one expect per test
- **Mocking**: Mock `src/services/admin` in tests, use real implementations for utilities
- **E2E** (post-MVP): Load dashboard, view metrics, save config (happy + conflict), delete URL with confirmation, generate invite
- **Time**: Use deterministic timers if uptime formatting is relative (`vi.useFakeTimers()`)

## Delivery & Run Modes

**Current Status:**
- ✅ Config via env: `NEXT_PUBLIC_ADMIN_BASE_URL`, `NEXT_PUBLIC_ADMIN_TOKEN`, `NEXT_PUBLIC_ADMIN_MOCK`
- ✅ Local dev: **Auto-enables mock mode when `baseUrl` is empty** (no env vars needed for development)
- ✅ Real mode: Enabled when `NEXT_PUBLIC_ADMIN_BASE_URL` and `NEXT_PUBLIC_ADMIN_TOKEN` are set
- ✅ Error handling: Prevents HTML error pages from being displayed, shows user-friendly error messages

**Remaining:**
- ❌ Packaging: UI-only Docker image exposing Next app
- ❌ Umbrel/StartOS compose with env/token mounting
- ❌ CORS documentation for admin endpoints
- ❌ Port documentation (default 3000) and base URL mapping

