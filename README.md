# Homeserver Dashboard

A comprehensive web-based administration tool for managing Pubky homeservers. Built with Next.js, React, and Shadcn UI, providing a modern interface to monitor usage, manage users, edit configuration, view logs, and perform administrative tasks.

## 🎯 Features

### 📊 Overview Tab

- **Server Statistics**: Real-time display of total users, disabled users, disk usage, and signup codes (from `/info` API)
- **Server & Connection Info**:
  - Connection status indicator (Connected/Mock Mode/Not Configured)
  - Homeserver pubkey display (mock - requires backend endpoint)
  - Server version information (mock - requires backend endpoint)
  - Admin endpoint configuration
- **System Health & Status**:
  - Server uptime (mock)
  - Database connection status (mock)
  - DHT connectivity status (mock)
  - Relay connection status (mock)
  - Storage health monitoring (mock)

### 📈 Usage Tab

- **Storage Capacity**:
  - Visual display of storage usage with capacity indicators (mock data)
  - Total capacity, used, and available storage
  - Progress bar visualization
  - Storage breakdown by category (User Data, Database, System Files)
  - Health status badge (Healthy/Warning/Critical)
- **Resource Trends**: Interactive charts showing:
  - Storage usage trends (mock data)
  - CPU usage trends (mock data)
  - RAM usage trends (mock data)
  - Network usage trends (mock data)
  - Chart switcher with icon-based navigation
  - Current value and percentage change display
  - Custom SVG-based line charts with Y-axis labels
- **Resource Consumption**: System-level resource monitoring (mock data)

### 👥 Users Tab

- **User Management**:
  - **Card View**: Visual card layout with user details
  - **List View**: Table layout with sortable columns
  - **Search & Filter**: Search by pubkey/name, filter by status
  - **Sorting**: Sort by pubkey, storage, activity, or status
  - **Pagination**: Navigate large lists with configurable page sizes
  - **User Details**: View comprehensive user information (mock data for storage/activity metrics)
  - **File Browser Integration**: Browse user files directly from user management
- **User Actions**: Disable/enable users, view files, view details, copy pubkey

- **Disabled Users Management**: Dedicated dialog to manage disabled users with search

- **Invite Management**: Generate signup tokens, view invites, copy to clipboard
- **User Statistics**: Comprehensive statistics overlay with activity patterns and storage breakdown

### 📝 Logs Tab

- **Log Viewer**: Real-time log display with color-coded entries by level (mock data - ready for `/logs` endpoint)
- **Filtering & Search**: Filter by log level and event type, full-text search
- **Auto-Refresh**: Configurable intervals with toggle
- **Actions**: Manual refresh, download logs, clear logs

### ⚙️ Settings & Configuration

- **Configuration Editor**: Graphical UI view and raw TOML editor with toggle (mock - requires backend endpoints)
- **Settings Dropdown**: Configuration access, theme toggle (mock), server control (mock), preferences

### 👤 User Profile

- **Sign In**: Authenticate with secret key, mock key generator, session management (localStorage)
- **Profile Management**: View/edit display name, view/copy public key (mock - requires backend)
- **Multi-Homeserver Management**: View and manage multiple homeservers (mock)
- **Settings Sync**: Sync configuration from other homeservers (mock)

### 🔧 API Explorer

- Interactive tool to test homeserver API endpoints
- Support for admin, client, and metrics endpoints
- Request/response viewing
- Useful for debugging and testing

> **Note**: See [API Integration](#-api-integration) section below for detailed endpoint documentation.

### 📁 File Browser

- **File Management**: Browse files via WebDAV, search/filter, sort by name/size/date
- **File Operations**: View, upload, create, rename, delete, edit files and directories

### 🎨 UI/UX Features

- **Modern Design**: Responsive layout, dark mode support (mock), consistent design system based on Franky
- **Navigation**: Top navbar with logo, settings, user profile, tabbed interface, footer

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

| Variable                      | Description                               | Required | Default                                   |
| ----------------------------- | ----------------------------------------- | -------- | ----------------------------------------- |
| `NEXT_PUBLIC_ADMIN_BASE_URL`  | Homeserver admin API base URL             | Yes\*    | -                                         |
| `NEXT_PUBLIC_ADMIN_TOKEN`     | Admin password/token                      | Yes\*    | -                                         |
| `NEXT_PUBLIC_CLIENT_BASE_URL` | Client server URL (for user creation)     | No       | `http://localhost:6286`                   |
| `NEXT_PUBLIC_ADMIN_ENV`       | Environment mode (`testnet` or `mainnet`) | No       | -                                         |
| `NEXT_PUBLIC_ADMIN_MOCK`      | Enable mock mode (`1` or `0`)             | No       | Auto-enabled if `ADMIN_BASE_URL` is empty |

\* Required unless using mock mode

### Mock Mode

If `NEXT_PUBLIC_ADMIN_BASE_URL` is not set, the dashboard automatically enables mock mode. Features using mock data are clearly marked with "Mock" badges.

## 🏗️ Project Structure

```
homeserver-dashboard/
├── src/
│   ├── app/                    # Next.js app router
│   ├── components/             # React components (atoms/molecules/organisms)
│   ├── hooks/                  # React hooks (admin/user/webdav)
│   ├── services/               # API clients (admin/user/webdav)
│   └── libs/                   # Utility functions
├── public/                     # Static assets
├── .env.example
├── FEATURE_IDEAS.md
└── package.json
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

### Adding New Components

Components follow atomic design principles (atoms/molecules/organisms). Use Shadcn UI as the foundation:

```bash
npx shadcn@latest add [component-name]
```

## 📡 API Integration

### Implemented Endpoints (Real API)

| Endpoint                  | Method   | Service Method                    | Status  |
| ------------------------- | -------- | --------------------------------- | ------- |
| `/info`                   | GET      | `AdminService.getInfo()`          | ✅ Real |
| `/generate_signup_token`  | GET      | `AdminService.generateInvite()`   | ✅ Real |
| `/users/{pubkey}/disable` | POST     | `AdminService.disableUser()`      | ✅ Real |
| `/users/{pubkey}/enable`  | POST     | `AdminService.enableUser()`       | ✅ Real |
| `/webdav/{*entry_path}`   | DELETE   | `AdminService.deleteUrl()`        | ✅ Real |
| `/dav/*`                  | PROPFIND | `WebDavService.listDirectory()`   | ✅ Real |
| `/dav/*`                  | GET      | `WebDavService.readFile()`        | ✅ Real |
| `/dav/*`                  | PUT      | `WebDavService.writeFile()`       | ✅ Real |
| `/dav/*`                  | DELETE   | `WebDavService.deleteFile()`      | ✅ Real |
| `/dav/*`                  | MKCOL    | `WebDavService.createDirectory()` | ✅ Real |
| `/dav/*`                  | MOVE     | `WebDavService.moveFile()`        | ✅ Real |

### Mocked Endpoints

| Endpoint                          | Method  | Service Method              | Status  | Notes                           |
| --------------------------------- | ------- | --------------------------- | ------- | ------------------------------- |
| `/config`                         | GET     | `AdminService.getConfig()`  | 🟡 Mock | Requires backend implementation |
| `/config`                         | PUT     | `AdminService.saveConfig()` | 🟡 Mock | Requires backend implementation |
| `/logs`                           | GET     | (Not yet implemented)       | 🟡 Mock | Ready for backend integration   |
| User profile endpoints            | Various | (Not yet implemented)       | 🟡 Mock | Requires backend implementation |
| Multi-homeserver discovery        | Various | (Not yet implemented)       | 🟡 Mock | Requires PKARR integration      |
| Settings sync                     | Various | (Not yet implemented)       | 🟡 Mock | Requires backend implementation |
| Server control (restart/shutdown) | POST    | (Not yet implemented)       | 🟡 Mock | Requires backend implementation |
| System health metrics             | GET     | (Not yet implemented)       | 🟡 Mock | Requires backend implementation |
| Usage trends (CPU/RAM/Network)    | GET     | (Not yet implemented)       | 🟡 Mock | Requires metrics endpoint       |

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

**Solution**: This is intentional. Features marked with "Mock" badges are using mock data because the backend endpoints are not yet implemented. See the [Mocked Endpoints](#mocked-endpoints) table and [Known Limitations](#-known-limitations) section for a complete list.

When backend endpoints are available, remove the mock checks in the respective services.

## 📝 Known Limitations

The following features use mock data and require backend implementation:

1. **Configuration Management**: `GET /config` and `PUT /config` endpoints
2. **Logs Viewer**: `GET /logs` endpoint
3. **User Statistics**: Additional API endpoints for detailed user metrics
4. **Multi-Homeserver**: PKARR-based homeserver discovery
5. **Settings Sync**: Backend endpoints for fetching/configuring multiple homeservers
6. **User Profile**: Backend authentication and profile management (currently uses localStorage)
7. **System Health**: Endpoints for uptime, database status, DHT/relay connectivity
8. **Usage Trends**: Metrics endpoint for CPU, RAM, and Network data
9. **Storage Capacity**: Backend implementation for total capacity and breakdown
10. **Connection Management**: Currently requires environment variables (see `FEATURE_IDEAS.md` for planned login & connection management feature)

See the [Mocked Endpoints](#mocked-endpoints) table for API-specific details.

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

Future enhancements planned (see `FEATURE_IDEAS.md` for details):

- [ ] **Login & Connection Management** (CRITICAL) - Enable flexible deployment without env vars, multi-homeserver support
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
- [ ] Activity feed / event stream
- [ ] Storage analytics
- [ ] Real-time metrics dashboard
