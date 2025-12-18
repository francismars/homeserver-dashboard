# Homeserver Dashboard MVP

**Standalone Project**: This is a separate repository from Franky, but uses the same design system, technologies, and UI patterns.

High-level blueprint for a Shadcn/Franky-style homeserver admin UI plus required admin endpoints. Targets modern browsers and runs against real homeserver admin APIs, with a mock mode for local dev.

## 🎯 Implementation Status

**Progress Breakdown:**

- **UI Implementation**: ~95% Complete (all components built, some polish remaining)
- **Backend Integration**: ~50% Complete (many features use mock data, waiting for API endpoints)
- **Testing**: 0% Complete (not started)
- **Packaging/Deployment**: ~20% Complete (README done, Docker/deployment docs missing)

**Overall Assessment**: The dashboard has a complete UI with all features implemented, but approximately half of the features are using mock data and waiting for backend API endpoints. Testing and packaging are not yet started. The dashboard is functional for development and UI testing, but not production-ready without backend integration.

### ✅ Completed Phases

- ✅ **Phase 0**: Bootstrap - COMPLETE
  - Next.js project scaffolded, dependencies installed, design system copied
  - Shadcn components installed (tabs, card, button, input, textarea, dialog, alert, skeleton, label, select, avatar, dropdown-menu, scroll-area, switch)
  - `.env.example` created with proper `NEXT_PUBLIC_` prefixes
  - Favicon added

- ✅ **Phase 1**: Services & Hooks - COMPLETE
  - `AdminService` with all endpoints (info, usage, config, delete, disable, enable, invite)
  - `WebDavService` with PROPFIND, GET, PUT, DELETE, MKCOL, MOVE, COPY operations
  - `UserService` for user listing and management
  - Mock adapter with realistic data
  - All hooks implemented (`useAdminInfo`, `useAdminUsage`, `useAdminActions`, `useConfigEditor`, `useWebDav`, `useUserManagement`)
  - Auto-mock mode when env vars missing (dev-friendly)

- ✅ **Phase 2**: UI Shell - COMPLETE
  - `/dashboard` page with 5-tab navigation (Overview, Usage, Users, Logs, API)
  - Modern navbar with logo, title, settings dropdown, and user profile button
  - Loading skeletons and error states
  - All Shadcn UI components created
  - Footer with version info and links

- ✅ **Phase 3**: Components - COMPLETE
  - All components implemented (atoms, molecules, organisms) - see "MVP Core Features Status" for details

- ✅ **Phase 4**: Polish & UX - MOSTLY COMPLETE
  - ✅ Confirm dialogs implemented for all destructive actions
  - ✅ Error handling with Alert components
  - ✅ Loading states and skeletons
  - ✅ Search and filter functionality
  - ✅ Pagination for large lists
  - ✅ Copy-to-clipboard with visual feedback
  - ✅ Mock data indicators (badges showing mock status)
  - ✅ Responsive design
  - ✅ Performance optimizations (React.memo, useMemo, useCallback, debouncing)
  - ❌ Toast notifications (using Sonner) - NOT IMPLEMENTED (using Alert components instead)
  - ❌ Success feedback messages - PARTIAL (some actions show success, others don't)
  - ❌ Env selector (mainnet/testnet toggle) - NOT IMPLEMENTED

### ⚠️ Partially Complete

- ⚠️ **Phase 5**: Testing - NOT STARTED
  - No unit tests, snapshot tests, or hook tests written yet
  - Vitest configured but no test files created

- ⚠️ **Phase 6**: Packaging & Docs - PARTIAL
  - ✅ Comprehensive README.md created
  - ❌ No Dockerfile
  - ❌ No docker-compose.yml
  - ❌ No deployment documentation

### MVP Core Features Status

**✅ FULLY FUNCTIONAL (Real API Integration):**

- ✅ **Basic Info Display** - Real data from `/info` endpoint (users, disk usage, signup codes)
- ✅ **Admin Actions** - Real API integration:
  - Delete URL with confirmation (`/webdav/{*entry_path}` DELETE)
  - Disable/enable users with confirmation (`/users/{pubkey}/disable|enable` POST)
  - Generate invite codes (`/generate_signup_token` GET)
- ✅ **File Browser** - Full WebDAV integration:
  - Browse files and directories (PROPFIND)
  - View and edit file contents (GET, PUT)
  - Upload files (PUT)
  - Create directories (MKCOL)
  - Delete files/folders (DELETE)
  - Rename files/folders (MOVE)
  - Search and sort files
  - Breadcrumb navigation (no root access)
- ✅ **User Management** - Real API integration:
  - List all users (WebDAV root directory scan)
  - Card and list view modes
  - Search and filtering (by pubkey/name, status)
  - Sorting (pubkey, storage, activity, status)
  - Pagination with configurable page sizes
  - Disable/enable users (real API)
  - View user files (integrated FileBrowser)
  - View user details
  - Real-time disabled users count from API (`num_disabled_users`)
- ✅ **API Explorer** - Interactive tool to test all homeserver endpoints (Admin, Client, Metrics)
- ✅ **Copy-to-clipboard** - For invite codes and pubkeys with visual feedback

**✅ FULLY FUNCTIONAL (Mock Data - Ready for Backend):**

- ✅ **Logs Viewer** - Complete UI implementation:
  - Level and event type filtering
  - Full-text search
  - Auto-refresh with configurable intervals
  - Download and clear actions
  - Color-coded entries
  - ⚠️ Uses mock data (ready for `/logs` endpoint)
- ✅ **Config Editor** - Complete UI implementation:
  - UI view with graphical editor
  - TOML view toggle
  - Save and reload functionality
  - Change tracking
  - ⚠️ Uses mock data (ready for `GET /config` and `PUT /config` endpoints)
- ✅ **User Statistics** - Comprehensive statistics overlay:
  - Activity patterns and metrics
  - Storage breakdown by user
  - ⚠️ Uses mock data (requires additional API endpoints)
- ✅ **User Profile** - Sign-in and profile management:
  - Sign in with secret key (with mock key generator)
  - Profile editing (display name)
  - Multi-homeserver management
  - Settings sync between homeservers
  - ⚠️ Uses mock data (requires backend AuthToken integration and PKARR discovery)
- ✅ **Server Control** - Restart/shutdown controls:
  - ⚠️ Mock implementation (requires backend endpoints)

**⚠️ PARTIALLY FUNCTIONAL (Mock Data for Some Features):**

- ⚠️ **Overview Tab**:
  - ✅ Real: User counts, disk usage, signup codes
  - ⚠️ Mock: Server pubkey, address, version (not in `/info` endpoint)
  - ⚠️ Mock: System health (uptime, database status, DHT/relay connectivity)
- ⚠️ **Usage Tab**:
  - ✅ Real: Total users, disk usage from `/info`
  - ⚠️ Mock: Storage capacity (total capacity, breakdown)
  - ⚠️ Mock: Resource trends (CPU, RAM, Network - requires metrics endpoint)
  - ✅ Real: Storage trends chart UI (with mock data)
- ⚠️ **Invite Management**:
  - ✅ Real: Generate signup tokens
  - ✅ Real: View recently generated invites
  - ⚠️ Mock: Invite statistics (usage per code, trends)

**Current State**: Dashboard UI is complete and functional for development/testing. Many features use mock data and require backend API endpoints to be production-ready. Can connect to real homeserver when `NEXT_PUBLIC_ADMIN_BASE_URL` and `NEXT_PUBLIC_ADMIN_TOKEN` env vars are set. All mock features are clearly marked with badges.

**Production Readiness**: Not production-ready until:

1. Backend API endpoints are implemented (see "Known Limitations" below)
2. Testing is completed
3. Packaging/deployment documentation is added

**Next Priority**:

1. Write tests (Phase 5)
2. Add packaging/deployment docs (Phase 6)
3. Optional: Toast notifications (Phase 4 enhancement)
4. Optional: Login & Connection Management (see FEATURE_IDEAS.md)

### 🚧 Known Limitations & Issues

**API Endpoint Limitations (Mock Data):**

All features using mock data are clearly marked with "Mock" badges and tooltips explaining what's needed.

1. **`/info` endpoint missing fields** ⚠️
   - **Issue**: The `/info` endpoint doesn't return `pubkey`, `address`, and `version` fields
   - **Impact**: Overview tab shows mock data for these fields
   - **Status**: Dashboard handles gracefully with mock data and clear indicators
   - **Backend Required**: Add `pubkey`, `address`, `version` to `/info` response

2. **Config endpoints not implemented** ⚠️
   - **Issue**: `GET /config` and `PUT /config` endpoints don't exist on backend
   - **Impact**: Config Editor works in mock mode only
   - **Status**: Fully mocked, ready for backend implementation
   - **Backend Required**: Implement `GET /config` and `PUT /config` endpoints

3. **Logs endpoint not implemented** 📝
   - **Issue**: `GET /logs` endpoint doesn't exist on backend
   - **Impact**: Logs tab uses mock data
   - **Status**: Fully mocked, ready for backend implementation
   - **Backend Required**: Implement `GET /logs` endpoint (optionally with SSE stream)

4. **User statistics endpoints not implemented** 👥
   - **Issue**: No endpoints for detailed user statistics (storage, activity, etc.)
   - **Impact**: User statistics use mock data
   - **Status**: Mocked, ready for backend implementation
   - **Backend Required**: Add endpoints for per-user storage, activity, file counts

5. **Storage capacity endpoint not implemented** 💾
   - **Issue**: No endpoint for total storage capacity and breakdown
   - **Impact**: Storage capacity shows mock data
   - **Status**: Mocked, ready for backend implementation
   - **Backend Required**: Add storage capacity and breakdown to `/info` or `/usage` endpoint

6. **Metrics endpoint not implemented** 📊
   - **Issue**: No `/metrics` endpoint for CPU, RAM, Network usage
   - **Impact**: Resource trends show mock data
   - **Status**: Mocked, ready for backend implementation
   - **Backend Required**: Implement Prometheus-style `/metrics` endpoint

7. **Multi-homeserver discovery not implemented** 🏠
   - **Issue**: No PKARR-based discovery of user's homeservers
   - **Impact**: User profile shows mock homeserver list
   - **Status**: Mocked, ready for PKARR integration
   - **Backend Required**: PKARR integration for homeserver discovery

8. **Server control endpoints not implemented** ⚙️
   - **Issue**: No endpoints for restart/shutdown
   - **Impact**: Server control is mock only
   - **Status**: Mocked, ready for backend implementation
   - **Backend Required**: Implement `POST /restart` and `POST /shutdown` endpoints

**Other Limitations:**

- **WebDAV path restrictions**: Paths must follow `/dav/{pubkey}/pub/{path}` structure (enforced by file browser)
- **User authentication**: Mock implementation using localStorage (ready for backend AuthToken integration)

**Post-MVP Features (Not Blocking):**

See `FEATURE_IDEAS.md` for detailed feature ideas. High-priority future features:

- **Login & Connection Management** (CRITICAL) - Enable flexible deployment without env vars, multi-homeserver support
- Activity feed / event stream
- Real-time metrics dashboard
- Advanced user analytics
- Backup and export tools
- Health monitoring alerts
- Activity timeline visualization
- Keyboard shortcuts
- Dashboard customization
- Toast notifications (currently using Alert components)
- Config conflict handling (409 responses)

## Project Structure

**Standalone Next.js project** using atomic design (atoms → molecules → organisms):

- `src/services/` - HTTP clients (admin, user, webdav)
- `src/hooks/` - React hooks for data fetching
- `src/components/` - UI components (atoms, molecules, organisms)
- Uses `@/` path aliases for imports

**Design System**: Copied from Franky (Shadcn UI, Tailwind theme, component patterns) for visual consistency.

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
- **@synonymdev/pubky** - Pubky SDK

**Simplified from Franky:**

- No Dexie/IndexedDB (no local-first storage needed)
- No Zustand (use React state/hooks)
- No complex core layer (services + hooks only)

## Environment Variables

✅ `.env.example` created with the following variables:

```bash
# Homeserver admin endpoint (use NEXT_PUBLIC_ prefix for client-side access)
NEXT_PUBLIC_ADMIN_BASE_URL=http://localhost:6288
NEXT_PUBLIC_ADMIN_TOKEN=your-admin-password-or-token

# Optional: Client server URL (for user creation)
NEXT_PUBLIC_CLIENT_BASE_URL=http://localhost:6286

# Optional: Environment (mainnet/testnet)
NEXT_PUBLIC_ADMIN_ENV=testnet

# Optional: PKARR relays (for mainnet)
NEXT_PUBLIC_PKARR_RELAYS=https://pkarr.pubky.app,https://pkarr.pubky.org

# Mock mode (use mock data instead of real API)
# Defaults to mock mode if NEXT_PUBLIC_ADMIN_BASE_URL is not set
NEXT_PUBLIC_ADMIN_MOCK=0
```

**Note**: All env vars use `NEXT_PUBLIC_` prefix because they're accessed in client-side hooks. Create `.env.local` (gitignored) for local development.

## Backend Endpoint Mapping

The homeserver already exposes admin endpoints (see `pubky-core/pubky-homeserver/src/admin_server/`). Frontend will connect to these:

### Existing Endpoints (No Backend Changes Needed)

| Backend Route             | Method                                  | Frontend Service Method            | Purpose                                  |
| ------------------------- | --------------------------------------- | ---------------------------------- | ---------------------------------------- |
| `/info`                   | GET                                     | `AdminService.getInfo()`           | Server stats (users, disk, signup codes) |
| `/generate_signup_token`  | GET                                     | `AdminService.generateInvite()`    | Generate single invite token             |
| `/users/{pubkey}/disable` | POST                                    | `AdminService.disableUser(pubkey)` | Disable user account                     |
| `/users/{pubkey}/enable`  | POST                                    | `AdminService.enableUser(pubkey)`  | Enable user account                      |
| `/webdav/{*entry_path}`   | DELETE                                  | `AdminService.deleteUrl(path)`     | Delete entry by WebDAV path              |
| `/dav/*`                  | PROPFIND/GET/PUT/DELETE/MKCOL/MOVE/COPY | `WebDavService.*()`                | WebDAV file operations                   |

### Auth Model

**Current Implementation:**

- ✅ Reads `NEXT_PUBLIC_ADMIN_TOKEN` from env
- ✅ Sends as `X-Admin-Password: <token>` header for admin endpoints
- ✅ Uses HTTP Basic Auth (`admin:password`) for WebDAV endpoints
- ✅ Handles non-OK responses as errors (401, 404, etc.)
- ✅ Error messages filtered to avoid showing HTML error pages

**Backend Compatibility:**

- Backend uses `AdminAuthLayer` (password-based)
- Frontend sends `X-Admin-Password` header (matches backend)
- 401 responses handled as auth failures

## Architecture

**Data flow**: Services → Hooks → Components

- Services handle HTTP requests and error normalization
- Hooks manage React state, loading, error handling
- Components consume hooks and render UI

## Testing Strategy

**Status: ❌ NOT STARTED**

**Follow Franky's testing patterns** (reference `franky/.cursor/rules/component-testing.mdc`):

**Planned Tests:**

- **Component tests**: Sanity render, click/hover handlers, single-expect snapshots for key states (loading, error, populated)
  - `StatCard.test.tsx` - Render with different props, icon, intent variants
  - `DashboardOverview.test.tsx`, `DashboardUsage.test.tsx`, etc. - Loading/error/data states
  - `UserManagement.test.tsx` - Card/list views, filtering, sorting, pagination
  - `FileBrowser.test.tsx` - File operations, navigation
  - `DashboardLogs.test.tsx` - Filtering, search, auto-refresh
  - All dialog components

- **Hook tests**: Test success/error states with mocked services; ensure checksum conflict path covered
  - `useAdminInfo.test.tsx` - Success, error, loading states
  - `useAdminUsage.test.tsx` - Data transformation from info response
  - `useConfigEditor.test.tsx` - Load, edit, save, conflict handling
  - `useAdminActions.test.tsx` - Delete, disable, enable, generate invite flows
  - `useUserManagement.test.tsx` - User listing, filtering
  - `useWebDav.test.tsx` - WebDAV operations

- **Snapshot tests**: Grouped in `ComponentName - Snapshots` describe block, max one expect per test
- **Mocking**: Mock `src/services/` in tests, use real implementations for utilities
- **E2E** (post-MVP): Load dashboard, view metrics, save config (happy + conflict), delete URL with confirmation, generate invite, manage users, view logs
- **Time**: Use deterministic timers if uptime formatting is relative (`vi.useFakeTimers()`)

## Delivery & Run Modes

**Current Status:**

- ✅ Config via env: `NEXT_PUBLIC_ADMIN_BASE_URL`, `NEXT_PUBLIC_ADMIN_TOKEN`, `NEXT_PUBLIC_ADMIN_MOCK`
- ✅ Local dev: **Auto-enables mock mode when `baseUrl` is empty** (no env vars needed for development)
- ✅ Real mode: Enabled when `NEXT_PUBLIC_ADMIN_BASE_URL` and `NEXT_PUBLIC_ADMIN_TOKEN` are set
- ✅ Error handling: Prevents HTML error pages from being displayed, shows user-friendly error messages
- ✅ **WebDAV integration**: File browser uses HTTP Basic Auth (`admin:password`) automatically from env vars
- ✅ **API Explorer**: Supports testing Admin, Client, and Metrics servers with proper auth handling
- ✅ **Performance optimizations**: React.memo, useMemo, useCallback, debouncing throughout

**Remaining:**

- ❌ Packaging: Dockerfile, docker-compose.yml, deployment documentation

## File Storage

**Default Location:**

- **Windows**: `C:\Users\{USERNAME}\.pubky\data\files\`
- **macOS/Linux**: `~/.pubky/data/files/`

**Structure**: Files are organized by user pubkey: `{data_dir}/data/files/{pubkey}/pub/{file_path}`

**Access**: Files can be accessed via:

- WebDAV file browser in dashboard
- Direct filesystem access (not recommended while homeserver is running)
- WebDAV clients (Windows Explorer, macOS Finder, rclone, etc.)

## Remaining Work

**High Priority:**

1. **Backend API Endpoints** - 8+ endpoints needed (see "Known Limitations" above)
2. **Testing** - Write component, hook, and snapshot tests
3. **Packaging** - Dockerfile, docker-compose.yml, deployment docs

**Optional Enhancements:**

- Toast notifications (currently using Alert components)
- Config conflict handling (409 responses)
- Login & Connection Management (see FEATURE_IDEAS.md)
- Future features (see FEATURE_IDEAS.md)
