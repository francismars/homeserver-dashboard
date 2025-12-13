# Homeserver Dashboard MVP

**Standalone Project**: This is a separate repository from Franky, but uses the same design system, technologies, and UI patterns.

High-level blueprint for a Shadcn/Franky-style homeserver admin UI plus required admin endpoints. Targets modern browsers and runs against real homeserver admin APIs, with a mock mode for local dev.

## 🎯 Implementation Status

**Overall Progress: ~95% Complete**

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
  - **Atoms**: `StatCard`
  - **Molecules**: `Logo`
  - **Organisms**: 
    - `DashboardOverview` - Server stats and system health
    - `DashboardUsage` - Storage capacity and resource trends with interactive charts
    - `DashboardLogs` - Log viewer with filtering and auto-refresh
    - `UserManagement` - Comprehensive user management with card/list views
    - `FileBrowser` - WebDAV file management (integrated into Users tab)
    - `ApiExplorer` - Interactive API testing tool
    - `ConfigDialog` - Configuration editor (UI and TOML views)
    - `InvitesDialog` - Invite management
    - `UserStatsDialog` - User statistics overlay
    - `DisabledUsersDialog` - Disabled users management
    - `UserProfileDialog` - User sign-in and profile management
    - `ServerControlDialog` - Server restart/shutdown controls
    - `DashboardNavbar` - Top navigation bar
  - All components functional and wired to hooks

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

**✅ FULLY FUNCTIONAL:**
- ✅ Basic info display (pubkey, address, version, disk usage, users, signup codes)
- ✅ Usage data visualization (storage capacity, resource trends with interactive charts)
- ✅ Admin actions (delete URL with confirm, disable/enable user with confirm, generate invite)
- ✅ Config editor (UI and TOML views, mock mode, ready for backend endpoints)
- ✅ Copy-to-clipboard for invite codes and pubkeys
- ✅ **File Browser** - WebDAV file management (browse, view, edit, upload, delete, create directories, rename, search, sort)
- ✅ **API Explorer** - Interactive API testing tool for all homeserver endpoints
- ✅ **User Management** - Comprehensive user management with:
  - Card and list view modes
  - Search and filtering
  - Sorting and pagination
  - Disable/enable users
  - View user files
  - View user details
  - Real-time disabled users count from API
- ✅ **Logs Viewer** - Log viewing with:
  - Level and event type filtering
  - Search functionality
  - Auto-refresh
  - Download and clear actions
  - Color-coded entries
- ✅ **User Profile** - Sign-in and profile management:
  - Sign in with secret key
  - Profile editing
  - Multi-homeserver management
  - Settings sync between homeservers
- ✅ **Disabled Users Management** - Dedicated dialog for managing disabled users
- ✅ **Invite Management** - Generate and manage invite codes
- ✅ **User Statistics** - Comprehensive user statistics overlay

**Ready for Testing**: Dashboard is fully functional with both real and mock data. Can connect to real homeserver when `NEXT_PUBLIC_ADMIN_BASE_URL` and `NEXT_PUBLIC_ADMIN_TOKEN` env vars are set.

**Next Priority**: Add toast notifications (Phase 4), then write tests (Phase 5), then packaging/docs (Phase 6).

### 🚧 Known Limitations & Issues

**API Endpoint Limitations:**

1. **`/info` endpoint missing fields** ⚠️
   - **Issue**: The `/info` endpoint doesn't return `pubkey`, `address`, and `version` fields
   - **Impact**: Overview tab shows "N/A" for these fields or uses mock data
   - **Status**: Backend changes were attempted but reverted. Dashboard handles gracefully by showing "N/A" or mock data
   - **Workaround**: None - requires backend update to `/info` endpoint

2. **Config endpoints not implemented** ⚠️
   - **Issue**: `GET /config` and `PUT /config` endpoints don't exist on backend
   - **Impact**: Config Editor works in mock mode only, cannot save real config
   - **Status**: Fully mocked in `AdminService`, ready for backend implementation
   - **Workaround**: Use mock mode for UI testing

3. **Usage breakdown not available** 📊
   - **Issue**: No dedicated `/usage` endpoint with `usersByInvite` or `storageByUser` breakdowns
   - **Impact**: Usage tab shows aggregate data only (sufficient for MVP)
   - **Status**: Using `/info` data, which is acceptable per MVP requirements
   - **Workaround**: None needed - MVP requirement says "if data available"

4. **Logs endpoint not implemented** 📝
   - **Issue**: `GET /logs` endpoint doesn't exist on backend
   - **Impact**: Logs tab uses mock data
   - **Status**: Fully mocked, ready for backend implementation
   - **Workaround**: Use mock mode for UI testing

5. **User statistics endpoints not implemented** 👥
   - **Issue**: No endpoints for detailed user statistics (storage, activity, etc.)
   - **Impact**: User statistics use mock data
   - **Status**: Mocked, ready for backend implementation
   - **Workaround**: Use mock mode for UI testing

6. **Multi-homeserver discovery not implemented** 🏠
   - **Issue**: No PKARR-based discovery of user's homeservers
   - **Impact**: User profile shows mock homeserver list
   - **Status**: Mocked, ready for backend/PKARR integration
   - **Workaround**: Use mock mode for UI testing

**File Browser Limitations:**

7. **WebDAV path restrictions** ⚠️
   - **Issue**: WebDAV paths must follow `/dav/{pubkey}/pub/{path}` structure
   - **Impact**: Cannot create files/directories at root `/dav/` level
   - **Status**: File browser enforces this restriction with validation and helpful error messages
   - **Workaround**: Navigate to user's `/pub/` directory first, then create files/folders

8. **Path parsing edge cases** 🔧
   - **Issue**: Some PROPFIND responses may include `/dav` in paths, causing phantom "dav" folders
   - **Impact**: Fixed with improved path normalization
   - **Status**: Resolved - path parsing now strips `/dav` prefixes correctly and filters out current directory

**Authentication:**

9. **Admin auth header** ✅
   - **Status**: Fixed - Changed from `Authorization: Bearer` to `X-Admin-Password` header
   - **Impact**: Admin endpoints now authenticate correctly
   - **Note**: WebDAV endpoints use HTTP Basic Auth (`admin:password`), handled separately

10. **User authentication** 🟡
    - **Status**: Mock implementation using localStorage
    - **Impact**: User profile sign-in works but uses mock authentication
    - **Note**: Ready for backend AuthToken integration

**Post-MVP Features (Not Blocking):**

- Toast notifications (currently using Alert components)
- Config conflict handling (409 responses)
- Enhanced usage breakdowns
- Activity feed
- Rate limit controls
- Real-time log streaming (SSE/WebSocket)
- Advanced user analytics
- Backup and export tools
- Health monitoring alerts
- Activity timeline visualization
- Keyboard shortcuts
- Dashboard customization

## MVP Requirements (Priority)

### Must Have

1. **Basic Info Display** ✅
   - Homeserver pubkey
   - IP:port (address)
   - Current version
   - Disk usage (used/total)
   - Uptime (if available)

2. **Usage Data** ✅
   - Total number of signed-up users
   - Disk usage summary
   - Users by invite code (if data available)
   - Resource trends (storage, CPU, RAM, network)

3. **Admin Actions** ✅
   - Delete any pubky URL (input URL → confirm → delete)
   - Disable/ban user accounts (input pubkey → confirm)
   - Enable user accounts
   - Generate invite codes (single or multiple)

4. **Config Editor** ✅ (MVP: mock until backend adds endpoints)
   - Display Config.toml
   - Edit capability (UI and TOML views)
   - Save with conflict handling (checksum-based)
   - Reload functionality

5. **User Management** ✅
   - List all users
   - View user details
   - Disable/enable users
   - View user files
   - Search and filter users
   - Sort users by various criteria

6. **File Browser** ✅
   - Browse files and directories
   - View and edit file contents
   - Upload files
   - Create directories
   - Delete files/folders
   - Rename files/folders
   - Search and sort files

### Post-MVP (Not Blocking)

- ✅ Logs display (implemented with mock data)
- ✅ User profile and authentication (implemented with mock data)
- ✅ Multi-homeserver management (implemented with mock data)
- ✅ Settings sync (implemented with mock data)
- Trigger homeserver restart (mock implementation)
- Activity feed (last sign-ins) - **See FEATURE_IDEAS.md for implementation plan**
- Heaviest files / disk usage by user - **See FEATURE_IDEAS.md**
- Filter by extension - **See FEATURE_IDEAS.md**
- Rate limit controls
- Testnet/mainnet toggle (can be env-based for MVP)
- **Real-Time Metrics** - Prometheus metrics visualization (see FEATURE_IDEAS.md)
- **File Search** - Search across all files (see FEATURE_IDEAS.md)

## Implementation Plan (Standalone Dashboard)

### ✅ Phase 0 – Bootstrap (COMPLETE)
- ✅ Scaffolded Next.js + Tailwind + Shadcn; copied Franky's `globals.css`, `components.json`, `utils.ts`
- ✅ Installed Shadcn primitives (button, card, input, textarea, tabs, dialog, alert, skeleton, label, select, avatar, dropdown-menu, scroll-area, switch)
- ✅ Created `.env.example` with `NEXT_PUBLIC_ADMIN_BASE_URL`, `NEXT_PUBLIC_ADMIN_TOKEN`, `NEXT_PUBLIC_ADMIN_MOCK`
- ✅ Set up TypeScript paths and project structure
- ✅ Added `tw-animate-css` dependency
- ✅ Added favicon

### ✅ Phase 1 – Services & Hooks (COMPLETE)
- ✅ `src/services/admin`: `getInfo()`, `generateInvite()`, `disableUser()`, `enableUser()`, `deleteUrl()`, `getUsage()`, `getConfig()`, `saveConfig()`
- ✅ `src/services/user`: `listUsers()`, `generateKeypair()`, `signupUser()`, `signupUserDirect()`
- ✅ `src/services/webdav`: `listDirectory()`, `readFile()`, `writeFile()`, `deleteFile()`, `createDirectory()`, `moveFile()`, `copyFile()`
- ✅ Mock adapter with realistic mock data
- ✅ Hooks: `useAdminInfo`, `useAdminUsage`, `useAdminActions`, `useConfigEditor`, `useUserManagement`, `useWebDav`
- ✅ Error normalization and handling (prevents HTML error pages from showing)
- ✅ Auto-enables mock mode when `baseUrl` is empty (dev-friendly)

### ✅ Phase 2 – UI Shell (COMPLETE)
- ✅ `/dashboard` page with 5 tabs (Overview, Usage, Users, Logs, API)
- ✅ Modern navbar with logo, title, settings dropdown, and user profile button
- ✅ Loading/skeleton states for all sections
- ✅ Error states with Alert components
- ✅ Footer with version info and links
- ✅ Created Shadcn UI components: tabs, card, skeleton, alert, button, textarea, dialog, input, label, select, avatar, dropdown-menu, scroll-area, switch

### ✅ Phase 3 – Components (COMPLETE)
- ✅ **Atoms**: `StatCard`
- ✅ **Molecules**: `Logo`
- ✅ **Organisms**: 
  - `DashboardOverview` - Server stats, connection info, system health
  - `DashboardUsage` - Storage capacity, resource trends with interactive charts
  - `DashboardLogs` - Log viewer with filtering, search, auto-refresh
  - `UserManagement` - Comprehensive user management with card/list views, search, filter, sort, pagination
  - `FileBrowser` - WebDAV file management (integrated into Users tab)
  - `ApiExplorer` - Interactive API testing tool
  - `ConfigDialog` - Configuration editor (UI and TOML views)
  - `InvitesDialog` - Invite management
  - `UserStatsDialog` - User statistics overlay
  - `DisabledUsersDialog` - Disabled users management
  - `UserProfileDialog` - User sign-in and profile management
  - `ServerControlDialog` - Server restart/shutdown controls
  - `DashboardNavbar` - Top navigation bar
- ✅ All components wired to hooks and functional
- ✅ Config editor works in mock mode (ready for backend endpoints)
- ✅ **File Browser**: Full WebDAV file management with directory navigation, file viewing/editing, upload, delete, create directory, rename, search, sort
- ✅ **API Explorer**: Interactive tool to test all homeserver endpoints (Admin, Client, Metrics servers) with proper auth handling
- ✅ **User Management**: Complete user management system with multiple view modes, filtering, sorting, pagination
- ✅ **Logs Viewer**: Comprehensive log viewing with filtering, search, auto-refresh, export
- ✅ **User Profile**: Sign-in, profile management, multi-homeserver management, settings sync

### ✅ Phase 4 – Polish & UX Safeguards (MOSTLY COMPLETE)
- ✅ Confirm dialogs implemented for all destructive actions
- ✅ Error handling with Alert components
- ✅ Loading states and skeletons
- ✅ Search and filter functionality throughout
- ✅ Pagination for large lists
- ✅ Copy-to-clipboard with visual feedback
- ✅ Mock data indicators (badges showing mock status)
- ✅ Responsive design
- ✅ Performance optimizations (React.memo, useMemo, useCallback, debouncing)
- ✅ Clear buttons and paste functionality in search inputs
- ✅ Breadcrumb navigation in file browser
- ✅ Tooltips for mock data explanations
- ❌ **Missing**: Toast notifications for success/error feedback (using Alert components instead)
- ❌ **Missing**: Clear inputs on successful actions (some implemented, not all)
- ❌ **Missing**: Success feedback messages (some implemented, not all)
- ❌ **Missing**: Optional env selector (mainnet/testnet toggle)

**Remaining work:**
- Add toast notifications (using Sonner) for success/error feedback
- Clear form inputs after successful actions (complete remaining forms)
- Add success messages/feedback (complete remaining actions)
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

### ⚠️ Phase 6 – Packaging & Docs (PARTIAL)
- ✅ `.env.example` created
- ✅ Comprehensive README.md created with full feature documentation
- ❌ No Dockerfile
- ❌ No docker-compose.yml
- ❌ No deployment documentation

**Remaining work:**
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
├── README.md                          # Comprehensive documentation
├── homeserver-dashboard-mvp.md       # This file
├── FEATURE_IDEAS.md                   # Future feature ideas
├── Dockerfile                         # For Umbrel/StartOS packaging (TODO)
├── docker-compose.yml                 # Optional: for local dev (TODO)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Redirect to /dashboard
│   │   ├── globals.css                # Copy Tailwind theme from Franky
│   │   └── dashboard/
│   │       ├── page.tsx               # Main dashboard page (tabbed layout)
│   │       ├── page.test.tsx          # Page tests (TODO)
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
│   │   │   ├── avatar.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── switch.tsx
│   │   │   └── toast.tsx
│   │   │
│   │   ├── atoms/
│   │   │   └── StatCard/
│   │   │       ├── StatCard.tsx
│   │   │       ├── StatCard.test.tsx  # TODO
│   │   │       ├── StatCard.types.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── molecules/
│   │   │   └── Logo/
│   │   │       ├── Logo.tsx
│   │   │       └── index.ts
│   │   │
│   │   └── organisms/
│   │       ├── DashboardOverview/
│   │       │   ├── DashboardOverview.tsx
│   │       │   ├── DashboardOverview.test.tsx  # TODO
│   │       │   ├── DashboardOverview.types.ts
│   │       │   └── index.ts
│   │       ├── DashboardUsage/
│   │       │   ├── DashboardUsage.tsx
│   │       │   ├── DashboardUsage.test.tsx  # TODO
│   │       │   ├── DashboardUsage.types.ts
│   │       │   └── index.ts
│   │       ├── DashboardLogs/
│   │       │   ├── DashboardLogs.tsx
│   │       │   ├── DashboardLogs.test.tsx  # TODO
│   │       │   ├── DashboardLogs.types.ts
│   │       │   └── index.ts
│   │       ├── UserManagement/
│   │       │   ├── UserManagement.tsx
│   │       │   ├── UserManagement.test.tsx  # TODO
│   │       │   ├── UserManagement.types.ts
│   │       │   └── index.ts
│   │       ├── FileBrowser/
│   │       │   ├── FileBrowser.tsx
│   │       │   ├── FileBrowser.test.tsx  # TODO
│   │       │   ├── FileBrowser.types.ts
│   │       │   └── index.ts
│   │       ├── ApiExplorer/
│   │       │   ├── ApiExplorer.tsx
│   │       │   ├── ApiExplorer.test.tsx  # TODO
│   │       │   ├── ApiExplorer.types.ts
│   │       │   └── index.ts
│   │       ├── ConfigDialog/
│   │       │   ├── ConfigDialog.tsx
│   │       │   └── index.ts
│   │       ├── InvitesDialog/
│   │       │   ├── InvitesDialog.tsx
│   │       │   └── index.ts
│   │       ├── UserStatsDialog/
│   │       │   ├── UserStatsDialog.tsx
│   │       │   └── index.ts
│   │       ├── DisabledUsersDialog/
│   │       │   ├── DisabledUsersDialog.tsx
│   │       │   └── index.ts
│   │       ├── UserProfileDialog/
│   │       │   ├── UserProfileDialog.tsx
│   │       │   └── index.ts
│   │       ├── ServerControlDialog/
│   │       │   ├── ServerControlDialog.tsx
│   │       │   └── index.ts
│   │       └── DashboardNavbar/
│   │           ├── DashboardNavbar.tsx
│   │           └── index.ts
│   │
│   ├── libs/
│   │   └── utils.ts                   # cn() helper (copy from Franky)
│   │
│   ├── services/
│   │   ├── admin/
│   │   │   ├── admin.ts                # HTTP client for admin endpoints
│   │   │   ├── admin.types.ts          # Request/response types
│   │   │   └── index.ts
│   │   ├── user/
│   │   │   ├── user.ts                 # User service
│   │   │   ├── user.types.ts           # User types
│   │   │   ├── keyGenerator.ts        # Keypair generation and signup
│   │   │   └── index.ts
│   │   └── webdav/
│   │       ├── webdav.ts               # WebDAV service (PROPFIND, GET, PUT, DELETE, MKCOL, etc.)
│   │       ├── webdav.types.ts         # WebDAV types
│   │       └── index.ts
│   │
│   └── hooks/
│       ├── admin/
│       │   ├── useAdminInfo.tsx
│       │   ├── useAdminUsage.tsx
│       │   ├── useAdminActions.tsx
│       │   └── index.ts
│       ├── user/
│       │   ├── useUserManagement.tsx
│       │   └── index.ts
│       └── webdav/
│           ├── useWebDav.tsx
│           └── index.ts
│
└── public/
    ├── pubky-logo.svg
    └── pubky-favicon.svg
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
   npm install @radix-ui/react-avatar @radix-ui/react-dropdown-menu @radix-ui/react-scroll-area @radix-ui/react-switch
   npm install class-variance-authority clsx tailwind-merge lucide-react zod sonner
   npm install @synonymdev/pubky
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
   npx shadcn@latest add button card input textarea table tabs dialog alert badge toast avatar dropdown-menu scroll-area switch
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
- `public/pubky-logo.svg` - Logo file
- `public/pubky-favicon.svg` - Favicon file

**Why standalone but matching design:**
- Same Shadcn components → visual consistency
- Same Tailwind theme → identical colors, spacing, typography
- Same component patterns → familiar codebase structure
- Independent deployment → can version/release separately

### Simplified Architecture

Since this is standalone (not part of Franky's core), use a simpler architecture:

- **Services** (`src/services/admin/`, `src/services/user/`, `src/services/webdav/`) - HTTP client for endpoints
- **Hooks** (`src/hooks/admin/`, `src/hooks/user/`, `src/hooks/webdav/`) - React hooks that call services directly
- **Components** - UI components using Shadcn primitives
- **No controllers/application/pipes layers** - Keep it simple for MVP

This matches the MVP scope while maintaining clean separation of concerns.

### Key Conventions

1. **Routes**: Next.js App Router (`src/app/dashboard/page.tsx`)
2. **Components**: Atomic design (atoms → molecules → organisms)
3. **Services**: HTTP client layer (`src/services/`)
4. **Hooks**: React hooks for data fetching (`src/hooks/`)
5. **Tests**: Co-located (`.test.tsx` or `.test.ts`) - TODO
6. **Exports**: Each folder has `index.ts` for clean imports

### File Naming Patterns

- Components: `PascalCase.tsx` (e.g., `StatCard.tsx`)
- Services: `camelCase.ts` (e.g., `admin.ts`)
- Types: `*.types.ts` (e.g., `admin.types.ts`)
- Tests: `*.test.tsx` or `*.test.ts` - TODO
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

| Backend Route | Method | Frontend Service Method | Purpose |
|--------------|--------|------------------------|---------|
| `/info` | GET | `AdminService.getInfo()` | Server stats (users, disk, signup codes) |
| `/generate_signup_token` | GET | `AdminService.generateInvite()` | Generate single invite token |
| `/users/{pubkey}/disable` | POST | `AdminService.disableUser(pubkey)` | Disable user account |
| `/users/{pubkey}/enable` | POST | `AdminService.enableUser(pubkey)` | Enable user account |
| `/webdav/{*entry_path}` | DELETE | `AdminService.deleteUrl(path)` | Delete entry by WebDAV path |
| `/dav/*` | PROPFIND/GET/PUT/DELETE/MKCOL/MOVE/COPY | `WebDavService.*()` | WebDAV file operations |

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

### Missing Endpoints (Frontend Will Mock/Stub)

**Status:**
- ✅ `GET /config` - **Mocked** in `AdminService.getConfig()` (returns mock TOML config)
- ✅ `PUT /config` - **Mocked** in `AdminService.saveConfig()` (simulates save with checksum)
- ✅ `GET /usage` - **Uses `/info` data** - `AdminService.getUsage()` extracts usage from info response
- ✅ `GET /logs` - **Mocked** in `DashboardLogs` component (returns mock log entries)
- ⚠️ `POST /invite` - **Single token only** - Uses existing `/generate_signup_token` endpoint (bulk generation not available)

**Note**: Config and logs endpoints are fully functional in mock mode. When backend adds these endpoints, just remove the mock checks in `AdminService` and `DashboardLogs`.

## Information Architecture & Screens (MVP)
- Route: `/dashboard` (or `/` redirects to `/dashboard`) with tabbed/sectioned layout.
- Sections:
  - **Overview**: homeserver pubkey, address (IP:port), version, uptime, disk usage (used/total), status badge, system health.
  - **Usage**: total users, storage capacity, resource trends (storage, CPU, RAM, network) with interactive charts.
  - **Users**: comprehensive user management with card/list views, search, filter, sort, pagination, disable/enable, view files, view details, invite management, user statistics.
  - **Logs**: log viewer with level/event filtering, search, auto-refresh, download, clear.
  - **API**: interactive API explorer for testing endpoints.
- Navigation: top navbar with logo, title, settings dropdown, and user profile button. Tabbed interface for main sections.
- Dialogs: Configuration editor, Invite management, User statistics, Disabled users management, User profile, Server control.

## Admin API Contracts (MVP)
Auth: admin token header `X-Admin-Password: <token>`. All responses use `application/json`.

Error shape (aligns with `AppError`): `{ type: string; message: string; code?: string | number; details?: Record<string, unknown> }`.

Endpoints:
- `GET /admin/info`
  - Res: `{ pubkey?: string; address?: string; version?: string; num_users: number; num_disabled_users: number; total_disk_used_mb: number; num_signup_codes: number; num_unused_signup_codes: number }`
- `GET /admin/usage` (uses `/info` data)
  - Res: `{ usersTotal: number; numUnusedSignupCodes: number; totalDiskUsedMB: number }`
- `GET /admin/config` (mocked)
  - Res: `{ configToml: string; checksum: string; updatedAt?: string }`
- `PUT /admin/config` (mocked)
  - Req: `{ configToml: string; checksum?: string }`
  - Res: `{ saved: true; checksum: string; updatedAt?: string }`
  - 409 on checksum mismatch with `{ type: 'CONFIG_CONFLICT', details: { serverChecksum } }`
- `POST /admin/delete-url`
  - Req: `{ path: string }`
  - Res: `{ deleted: boolean }`
- `POST /admin/disable-user`
  - Req: `{ pubkey: string }`
  - Res: `{ disabled: true }`
- `POST /admin/enable-user`
  - Req: `{ pubkey: string }`
  - Res: `{ enabled: true }`
- `GET /admin/generate_signup_token`
  - Res: `{ token: string }`
- `GET /admin/logs` (not yet implemented, mocked)
  - Res: `{ logs: LogEntry[] }`

Post-MVP (not blocking): restart endpoint, activity feed, heaviest files, rate-limit tuning, logs tailing, user statistics endpoints.

## UI Architecture & Components

**Simplified standalone architecture:**
- Placement: `src/app/dashboard/page.tsx` with tabbed layout
- Reuse Shadcn primitives: `Card`, `Tabs`, `Button`, `Input`, `Textarea`, `Badge`, `Table`, `Alert`, `Dialog`, `Skeleton`, `Tooltip`, `Toast`, `Avatar`, `DropdownMenu`, `ScrollArea`, `Switch`
- Implemented components:
  - `StatCard` (atoms) - label/value/icon/intent for overview/usage metrics
  - `Logo` (molecules) - Pubky logo component
  - `DashboardOverview` (organisms) - Server info, connection status, system health
  - `DashboardUsage` (organisms) - Storage capacity, resource trends with charts
  - `DashboardLogs` (organisms) - Log viewer with filtering and auto-refresh
  - `UserManagement` (organisms) - Comprehensive user management
  - `FileBrowser` (organisms) - WebDAV file management
  - `ApiExplorer` (organisms) - Interactive API testing
  - `ConfigDialog` (organisms) - Configuration editor (UI and TOML views)
  - `InvitesDialog` (organisms) - Invite management
  - `UserStatsDialog` (organisms) - User statistics overlay
  - `DisabledUsersDialog` (organisms) - Disabled users management
  - `UserProfileDialog` (organisms) - User sign-in and profile management
  - `ServerControlDialog` (organisms) - Server restart/shutdown controls
  - `DashboardNavbar` (organisms) - Top navigation bar

**Data flow (simplified):**
- Hooks (`src/hooks/`) call Services (`src/services/`) directly
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
- ✅ Delete URL / Disable user: Requires confirm dialog; shows error Alert on failure
- ✅ Enable user: Requires confirm dialog; shows error Alert on failure
- ✅ Generate invite: Renders returned token in `InviteList` with copy buttons; keeps last 10 generated invites in state
- ✅ Copy-to-clipboard: Implemented with visual feedback (checkmark)
- ✅ **File Browser**: Browse directories, view/edit files, upload files, create directories, delete files/folders, rename, search, sort
- ✅ **API Explorer**: Test all homeserver endpoints with proper authentication
- ✅ **Path validation**: File browser enforces WebDAV path structure (`/dav/{pubkey}/pub/{path}`)
- ✅ **User Management**: List users, search, filter, sort, paginate, disable/enable, view files, view details
- ✅ **Logs Viewer**: View logs, filter by level/event, search, auto-refresh, download, clear
- ✅ **User Profile**: Sign in, edit profile, view homeservers, sync settings
- ✅ **Disabled Users**: Manage disabled users, disable by pubkey, enable users

**Remaining:**
- ❌ Toast notifications: Success/error toasts not yet implemented (currently using Alert components)
- ❌ Clear inputs: Some form inputs not cleared after successful actions
- ❌ Success feedback: Some actions don't show success messages
- ❌ Config conflict handling: 409 conflict dialog not implemented (backend endpoint not available yet)
- ❌ Optional env switch: Swapping base URL/token to trigger refetch not implemented

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
- ❌ Packaging: UI-only Docker image exposing Next app
- ❌ Umbrel/StartOS compose with env/token mounting
- ❌ CORS documentation for admin endpoints
- ❌ Port documentation (default 3000) and base URL mapping
- ❌ File storage location documentation (default: `~/.pubky/data/files/`)

## File Storage

**Default Location:**
- **Windows**: `C:\Users\{USERNAME}\.pubky\data\files\`
- **macOS/Linux**: `~/.pubky/data/files/`

**Structure**: Files are organized by user pubkey: `{data_dir}/data/files/{pubkey}/pub/{file_path}`

**Access**: Files can be accessed via:
- WebDAV file browser in dashboard
- Direct filesystem access (not recommended while homeserver is running)
- WebDAV clients (Windows Explorer, macOS Finder, rclone, etc.)

## Recent Additions (Latest Session)

### New Features
1. **Logs Tab** - Comprehensive log viewer with:
   - Level and event type filtering
   - Full-text search
   - Auto-refresh with configurable intervals
   - Download and clear actions
   - Color-coded log entries

2. **User Profile Dialog** - User authentication and management:
   - Sign in with secret key (with mock key generator)
   - Profile editing (display name)
   - Multi-homeserver management
   - Settings sync between homeservers

3. **Disabled Users Management** - Dedicated dialog for:
   - Viewing all disabled users
   - Disabling users by pubkey
   - Enabling disabled users
   - Real-time count from API

4. **Enhanced User Management**:
   - Card and list view modes
   - Advanced search and filtering
   - Sorting (by pubkey, storage, activity, status)
   - Pagination with configurable items per page
   - Clear and paste buttons in search input
   - Real disabled users count from API

5. **Enhanced File Browser**:
   - Search and filter files
   - Sort by name, size, or date
   - Rename files/folders
   - Removed home icon from breadcrumbs (can't navigate to root)
   - Removed edit icon (click file to edit)

6. **Configuration Editor Improvements**:
   - UI view with graphical editor
   - TOML view toggle
   - Reload functionality (merged with reset)
   - Better spacing and layout

7. **Dashboard Navbar**:
   - Modern design matching Franky
   - Logo and title
   - Settings dropdown with configuration, theme toggle, server controls
   - User profile button
   - Integrated header information

8. **Usage Tab Enhancements**:
   - Storage capacity visualization
   - Interactive resource trends charts (storage, CPU, RAM, network)
   - Chart type switching with icons
   - Removed user-specific stats (moved to User Stats dialog)

9. **Footer**:
   - Version information
   - Copyright and attribution
   - Links to GitHub, Documentation, Support

### Performance Optimizations
- React.memo for expensive components
- useMemo for computed values
- useCallback for event handlers
- Debounced search inputs
- Efficient pagination
- Optimized re-renders

### UI/UX Improvements
- Mock data clearly marked with badges
- Tooltips explaining mock implementations
- Consistent design system
- Responsive layouts
- Loading states and skeletons
- Error handling with user-friendly messages
- Copy-to-clipboard with visual feedback
- Clear and paste buttons in inputs
