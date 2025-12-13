# Homeserver Dashboard

A comprehensive web-based administration tool for managing Pubky homeservers. Built with Next.js, React, and Shadcn UI, providing a modern interface to monitor usage, manage users, edit configuration, view logs, and perform administrative tasks.

## 🎯 Features

### 📊 Overview Tab
- **Server Statistics**: Real-time display of total users, disabled users, disk usage, and signup codes
- **Server & Connection Info**: 
  - Connection status indicator (Connected/Mock Mode/Not Configured)
  - Homeserver pubkey display
  - Server version information
  - Admin endpoint configuration
- **System Health & Status**: 
  - Server uptime
  - Database connection status
  - DHT connectivity status
  - Relay connection status
  - Storage health monitoring

### 📈 Usage Tab
- **Storage Capacity**: Visual display of storage usage with capacity indicators
- **Resource Trends**: Interactive charts showing:
  - Storage usage trends
  - CPU usage trends
  - RAM usage trends
  - Network usage trends
- **Resource Consumption**: System-level resource monitoring
- **Storage Analytics**: Detailed storage breakdown and analytics

### 👥 Users Tab
- **User Management**:
  - **Card View**: Visual card layout with user details
  - **List View**: Table layout with sortable columns
  - **Search & Filter**: Search by pubkey/name, filter by status (all/active/disabled)
  - **Sorting**: Sort by pubkey, storage, activity, or status (in list view)
  - **Pagination**: Navigate through large user lists with configurable items per page
  - **User Details**: View detailed information about each user
  - **File Browser Integration**: Browse user files directly from the user management interface
  
- **User Actions**:
  - **Disable/Enable Users**: Disable or enable user accounts with confirmation
  - **View Files**: Navigate to user's file directory
  - **View Details**: See comprehensive user information
  - **Copy Pubkey**: Quick copy functionality for user pubkeys

- **Disabled Users Management**:
  - Dedicated dialog for managing disabled users
  - List all disabled users with search functionality
  - Disable users by entering their pubkey
  - Enable disabled users
  - Real-time count from API (`num_disabled_users`)

- **Invite Management**:
  - Generate new signup tokens
  - View recently generated invites
  - Copy invite codes to clipboard
  - Invite statistics (mock data for now)

- **User Statistics**:
  - Comprehensive user statistics overlay
  - Activity patterns and metrics
  - Storage breakdown by user

### 📝 Logs Tab
- **Log Viewer**:
  - Real-time log display with color-coded entries by level
  - Scrollable log area (600px height)
  - Timestamp formatting
  - Source information display
  
- **Filtering & Search**:
  - Filter by log level (All, Error, Warning, Info, Debug)
  - Filter by event type (All, Authentication, User Management, Admin Operations, API Requests, Database, Network, Storage, System)
  - Full-text search across log messages, sources, and details
  
- **Auto-Refresh**:
  - Toggle auto-refresh on/off
  - Configurable intervals (10s, 30s, 60s, 5m)
  - Live log count display
  
- **Actions**:
  - Manual refresh
  - Download logs as text file
  - Clear all logs (with confirmation)

### ⚙️ Settings & Configuration
- **Configuration Editor**:
  - **UI View**: Graphical editor for homeserver configuration
    - General settings (database URL, signup mode, storage quota)
    - Drive settings (listen sockets)
    - Storage settings (storage type)
    - Admin settings (enable/disable, listen socket, password)
    - Metrics settings (enable/disable, listen socket)
  - **TOML View**: Raw TOML editor for advanced configuration
  - Toggle between UI and TOML views
  - Save and reload functionality
  - Change tracking and validation

- **Settings Dropdown**:
  - Configuration editor access
  - Theme toggle (mock - dark/light mode)
  - Server control (restart/shutdown - mock)
  - Preferences
  - About

### 👤 User Profile
- **Sign In**:
  - Sign in with secret key (64-character hex)
  - Mock key generator button for testing
  - Paste from clipboard functionality
  - Session management (localStorage)
  
- **Profile Management**:
  - View and edit display name
  - View and copy public key
  - Save profile changes
  
- **Multi-Homeserver Management**:
  - View current homeserver information
  - List other homeservers you own
  - View homeserver details (users, storage, etc.)
  
- **Settings Sync**:
  - Sync configuration settings from other homeservers
  - Selectable settings to sync:
    - Signup mode
    - User storage quota
    - Admin server enabled
    - Metrics server enabled
  - Apply synced settings to current homeserver

### 🔧 API Explorer
- Interactive tool to test homeserver API endpoints
- Support for admin, client, and metrics endpoints
- Request/response viewing

### 📁 File Browser
- **File Management**:
  - Browse files and directories via WebDAV
  - Navigate through user directories
  - Breadcrumb navigation
  - Search and filter files
  - Sort by name, size, or date
  
- **File Operations**:
  - View file contents
  - Upload new files
  - Create directories
  - Rename files/folders
  - Delete files/folders
  - Edit file contents

### 🎨 UI/UX Features
- **Modern Design**:
  - Clean, responsive layout
  - Dark mode support (mock toggle)
  - Consistent design system based on Franky
  - Shadcn UI components
  
- **Navigation**:
  - Top navbar with logo and title
  - Settings and user profile buttons
  - Tabbed interface for main sections
  
- **Performance**:
  - Optimized rendering with React.memo
  - Debounced search inputs
  - Efficient pagination
  - Memoized computations

## 🚀 Prerequisites

- Node.js 18+ and npm
- A running Pubky homeserver (or use mock mode for development)
- PostgreSQL (if running a real homeserver)

## 📦 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your homeserver details:

```bash
# Homeserver admin endpoint
NEXT_PUBLIC_ADMIN_BASE_URL=http://localhost:6288
NEXT_PUBLIC_ADMIN_TOKEN=your-admin-password

# Optional: Client server URL (for user creation)
NEXT_PUBLIC_CLIENT_BASE_URL=http://localhost:6286

# Optional: Environment mode
NEXT_PUBLIC_ADMIN_ENV=testnet

# Optional: Mock mode (use mock data instead of real API)
# Set to 1 to enable mock mode, or leave unset to use real API
NEXT_PUBLIC_ADMIN_MOCK=0
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production

```bash
npm run build
npm start
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|-----------|---------|
| `NEXT_PUBLIC_ADMIN_BASE_URL` | Homeserver admin API base URL | Yes* | - |
| `NEXT_PUBLIC_ADMIN_TOKEN` | Admin password/token | Yes* | - |
| `NEXT_PUBLIC_CLIENT_BASE_URL` | Client server URL (for user creation) | No | `http://localhost:6286` |
| `NEXT_PUBLIC_ADMIN_ENV` | Environment mode (`testnet` or `mainnet`) | No | - |
| `NEXT_PUBLIC_ADMIN_MOCK` | Enable mock mode (`1` or `0`) | No | Auto-enabled if `ADMIN_BASE_URL` is empty |

\* Required unless using mock mode

### Mock Mode

If `NEXT_PUBLIC_ADMIN_BASE_URL` is not set, the dashboard automatically enables mock mode, allowing you to develop and test the UI without a running homeserver. Many features are clearly marked with "Mock" badges to indicate they're using mock data.

## 🏗️ Project Structure

```
homeserver-dashboard/
├── src/
│   ├── app/                          # Next.js app router pages
│   │   ├── dashboard/                # Main dashboard page
│   │   │   ├── page.tsx             # Dashboard component
│   │   │   └── loading.tsx          # Loading state
│   │   └── globals.css              # Global styles
│   ├── components/                   # React components
│   │   ├── atoms/                   # Basic UI components
│   │   │   └── StatCard/           # Statistic card component
│   │   ├── molecules/               # Composite components
│   │   │   └── Logo/               # Logo component
│   │   ├── organisms/               # Complex feature components
│   │   │   ├── ApiExplorer/        # API testing tool
│   │   │   ├── ConfigDialog/        # Configuration editor
│   │   │   ├── DashboardLogs/      # Logs viewer
│   │   │   ├── DashboardNavbar/    # Top navigation bar
│   │   │   ├── DashboardOverview/  # Overview tab
│   │   │   ├── DashboardUsage/      # Usage statistics
│   │   │   ├── DisabledUsersDialog/ # Disabled users management
│   │   │   ├── FileBrowser/        # WebDAV file browser
│   │   │   ├── InvitesDialog/      # Invite management
│   │   │   ├── ServerControlDialog/ # Server control
│   │   │   ├── UserManagement/     # User management
│   │   │   ├── UserProfileDialog/   # User profile & sign-in
│   │   │   └── UserStatsDialog/     # User statistics
│   │   └── ui/                      # Shadcn UI components
│   ├── hooks/                        # React hooks
│   │   ├── admin/                   # Admin API hooks
│   │   │   ├── useAdminActions.tsx # Admin actions (disable user, generate invite)
│   │   │   ├── useAdminInfo.tsx    # Server info
│   │   │   └── useAdminUsage.tsx   # Usage statistics
│   │   ├── user/                    # User management hooks
│   │   │   └── useUserManagement.tsx # User listing
│   │   └── webdav/                  # WebDAV hooks
│   │       └── useWebDav.tsx        # WebDAV operations
│   ├── services/                    # API clients
│   │   ├── admin/                   # Admin API service
│   │   │   ├── admin.ts            # AdminService class
│   │   │   └── admin.types.ts      # Type definitions
│   │   ├── user/                    # User service
│   │   │   ├── user.ts            # UserService class
│   │   │   ├── keyGenerator.ts   # Keypair generation & signup
│   │   │   └── user.types.ts     # Type definitions
│   │   └── webdav/                  # WebDAV service
│   │       ├── webdav.ts           # WebDavService class
│   │       └── webdav.types.ts    # Type definitions
│   └── libs/                        # Utility functions
│       └── utils.ts                # Helper functions
├── public/                          # Static assets
│   └── pubky-logo.svg              # Logo file
├── .env.example                     # Environment variables template
└── package.json                     # Dependencies
```

## 🛠️ Development

### Tech Stack

- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **Shadcn UI** - Component library
- **Lucide React** - Icon library
- **@synonymdev/pubky** - Pubky SDK for keypair generation and signup
- **Vitest** - Testing framework

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode

### Adding New Components

Components follow atomic design principles:

- **Atoms**: Basic UI elements (`Button`, `Input`, `Card`)
- **Molecules**: Composite components (`Logo`, `StatCard`)
- **Organisms**: Complex features (`DashboardOverview`, `FileBrowser`, `UserManagement`)

Use Shadcn UI components as the foundation:

```bash
npx shadcn@latest add [component-name]
```

## 📡 API Integration

### Implemented Endpoints

| Endpoint | Method | Service Method | Status |
|----------|--------|----------------|--------|
| `/info` | GET | `AdminService.getInfo()` | ✅ Real |
| `/generate_signup_token` | GET | `AdminService.generateInvite()` | ✅ Real |
| `/users/{pubkey}/disable` | POST | `AdminService.disableUser()` | ✅ Real |
| `/users/{pubkey}/enable` | POST | `AdminService.enableUser()` | ✅ Real |
| `/webdav/{*entry_path}` | DELETE | `AdminService.deleteUrl()` | ✅ Real |
| `/dav/*` | PROPFIND/GET/PUT/DELETE/MKCOL | `WebDavService.*()` | ✅ Real |

### Mocked Endpoints

| Endpoint | Method | Service Method | Status |
|----------|--------|----------------|--------|
| `/config` | GET | `AdminService.getConfig()` | 🟡 Mock |
| `/config` | PUT | `AdminService.saveConfig()` | 🟡 Mock |
| `/logs` | GET | (Not yet implemented) | 🟡 Mock |
| User profile endpoints | Various | (Not yet implemented) | 🟡 Mock |
| Multi-homeserver discovery | Various | (Not yet implemented) | 🟡 Mock |

## 🎨 Features in Detail

### User Management

The Users tab provides comprehensive user management capabilities:

- **Dual View Modes**: Switch between card view and list view
- **Advanced Filtering**: Search by pubkey or name, filter by status
- **Smart Sorting**: Sort by multiple criteria (pubkey, storage, activity, status)
- **Pagination**: Handle large user lists efficiently
- **User Actions**: Disable/enable, view files, view details
- **Real-time Data**: Uses actual API data for user counts and lists
- **Mock Details**: Storage and activity data is mocked (requires additional API endpoints)

### Configuration Editor

The configuration editor provides two views:

1. **UI View**: Graphical editor with form fields for each configuration section
2. **TOML View**: Raw TOML text editor for advanced users

Features:
- Toggle between views
- Change tracking
- Save and reload functionality
- Validation and error handling

### Logs Viewer

The logs tab provides comprehensive log viewing:

- **Real-time Display**: Color-coded log entries by level
- **Advanced Filtering**: Filter by level and event type
- **Search**: Full-text search across all log fields
- **Auto-refresh**: Configurable automatic refresh intervals
- **Export**: Download logs as text files
- **Clear**: Remove all logs (with confirmation)

Currently uses mock data. Ready for backend integration when `/logs` endpoint is available.

### User Profile & Authentication

The user profile dialog provides:

- **Sign In**: Authenticate with secret key
- **Profile Management**: Edit display name and view pubkey
- **Multi-Homeserver**: View and manage multiple homeservers
- **Settings Sync**: Sync configuration between homeservers

Currently uses localStorage for session management. Ready for backend authentication integration.

## 🐛 Troubleshooting

### "Error loading server info" / 404 Errors

**Problem**: Dashboard can't connect to the homeserver.

**Solutions**:
1. Verify `NEXT_PUBLIC_ADMIN_BASE_URL` is set correctly
2. Ensure the homeserver is running
3. Check that `NEXT_PUBLIC_ADMIN_TOKEN` matches your homeserver's admin password
4. Verify CORS is enabled on the homeserver (should be enabled by default)

### "N/A" for Server Information

**Problem**: The `/info` endpoint doesn't return `pubkey`, `address`, or `version`.

**Solution**: This is a known limitation. The homeserver's `/info` endpoint may not include these fields. The dashboard handles this gracefully by showing "N/A" or using mock data where appropriate.

### User Creation Fails with PKARR Errors

**Problem**: Creating a user fails with errors about PKARR resolution.

**Solutions**:
1. **For local/testnet**: Ensure the homeserver is running. The PKARR relay alone is not sufficient.
2. **For mainnet**: Ensure your homeserver is published to the DHT and accessible.
3. The SDK requires the homeserver pubkey even for local homeservers. Find it in your `config.toml` file (`homeserver_pubkey` field) or startup logs.

### Mock Data Indicators

**Problem**: Some features show "Mock" badges.

**Solution**: This is intentional. Features marked with "Mock" badges are using mock data because the backend endpoints are not yet implemented. These include:
- Configuration editor (GET/PUT `/config`)
- Logs viewer (GET `/logs`)
- Some user statistics
- Multi-homeserver discovery
- Settings sync

When backend endpoints are available, remove the mock checks in the respective services.

## 📝 Known Limitations

1. **Config Endpoints**: `GET /config` and `PUT /config` are mocked. Backend implementation pending.
2. **Logs Endpoint**: `GET /logs` is not yet implemented. Using mock data.
3. **User Statistics**: Some user statistics require additional API endpoints (currently mocked).
4. **Multi-Homeserver**: Homeserver discovery via PKARR is not yet implemented (using mock data).
5. **Settings Sync**: Requires backend endpoints for fetching configs from multiple homeservers.
6. **User Profile**: Authentication and profile management use localStorage (mock implementation).

## 🤝 Contributing

This is a standalone project. Contributions are welcome! Please ensure:

- Code follows the existing patterns
- Components use Shadcn UI primitives
- TypeScript types are properly defined
- Error handling is comprehensive
- Mock data is clearly marked with badges
- Real vs mock implementations are documented

## 📄 License

[Add your license here]

## 🔗 Related Projects

- [Pubky Homeserver](https://github.com/synonymdev/pubky) - The homeserver this dashboard manages
- [Franky](https://github.com/synonymdev/franky) - Reference UI implementation (design system source)

## 💬 Support

For issues related to:
- **Dashboard**: Open an issue in this repository
- **Homeserver**: See [Pubky Homeserver issues](https://github.com/synonymdev/pubky/issues)

## 🎯 Roadmap

Future enhancements planned:

- [ ] Real-time log streaming (SSE/WebSocket)
- [ ] Advanced user analytics
- [ ] Backup and export tools
- [ ] Health monitoring alerts
- [ ] Activity timeline visualization
- [ ] Keyboard shortcuts
- [ ] Dashboard customization
- [ ] Real authentication with backend
- [ ] Multi-homeserver discovery via PKARR
- [ ] Real-time configuration sync
