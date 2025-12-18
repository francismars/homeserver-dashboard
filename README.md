# Homeserver Dashboard

A small web-based admin dashboard for Pubky homeservers. Built with **Next.js (App Router)**, **React**, and **Tailwind + shadcn/ui**.

The UI lives under a single route: **`/dashboard`** (the home page redirects there).

## 🎯 Current UI (what exists today)

The dashboard has 5 tabs:

- **Overview**: shows homeserver stats from `GET /info`
- **Users**:
  - Generate signup tokens (invites) via `GET /generate_signup_token`
  - Disable / enable a user by pubkey via `POST /users/{pubkey}/disable` and `POST /users/{pubkey}/enable`
  - Shows a **mock** “disabled users list” (the count comes from `/info`, but the list entries are mock until there’s an API)
- **Files**: WebDAV file browser (list/read/write/delete/move) using the `/dav/*` endpoint (Basic Auth)
- **Logs**: mock log viewer (no backend logs API wired yet)
- **API**: API Explorer for admin/client/metrics endpoints (manual requests)

Also in the navbar “Settings” menu:

- **Configuration**: mock, read-only TOML viewer (no real config endpoints yet)
- **Restart / Shutdown**: mock dialogs (no backend control endpoint yet)

## 🚀 Prerequisites

- Node.js 20.9+ and npm (Next.js 16.0.10 requires Node 20.9+)
- A running Pubky homeserver (or use mock mode for development)

## 📦 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` (or create `.env.local` manually):

```bash
cp .env.example .env.local
```

Edit `.env.local` with your homeserver details:

```bash
# Homeserver admin endpoint
NEXT_PUBLIC_ADMIN_BASE_URL=http://localhost:6288
NEXT_PUBLIC_ADMIN_TOKEN=your-admin-password

# Optional: Mock mode (use mock data instead of real API)
# Set to 1 to force mock mode, or leave unset/0 to use real API.
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

| Variable                     | Description                   | Required | Default |
| ---------------------------- | ----------------------------- | -------- | ------- |
| `NEXT_PUBLIC_ADMIN_BASE_URL` | Homeserver admin API base URL | Yes\*    | -       |
| `NEXT_PUBLIC_ADMIN_TOKEN`    | Admin password/token          | Yes\*    | -       |
| `NEXT_PUBLIC_ADMIN_MOCK`     | Force mock mode (`1` or `0`)  | No       | `0`     |

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
- **Vitest** - Testing framework (installed; no tests currently live in this package)
- **ESLint / Prettier / Knip** - Repo hygiene tooling

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint (`eslint .`)
- `npm run lint:fix` - Fix lint issues (`eslint . --fix`)
- `npm run format` - Format files with Prettier
- `npm run format:check` - Check formatting (CI-friendly)
- `npm run knip` - Check for unused files/deps/exports (see `knip.json`)
- `npm test` - Run Vitest

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

| Feature / endpoint area               | Status  | Notes |
| ------------------------------------- | ------- | ----- |
| Configuration read/edit (`/config`)   | 🟡 Mock | UI is read-only mock; backend endpoints required |
| Logs API (`/logs`)                    | 🟡 Mock | UI generates mock logs |
| Server control (restart/shutdown)     | 🟡 Mock | UI only; backend control endpoints required |
| Disabled users list endpoint          | 🟡 Mock | UI shows a mock list sized to match `/info.num_disabled_users` |

## 📝 Known Limitations

The following features use mock data and require backend implementation:

1. **Configuration Management**: backend endpoints for reading/writing `config.toml`
2. **Logs Viewer**: backend `/logs` endpoint (or SSE) for real logs
3. **Server Control**: backend endpoints for restart/shutdown
4. **Disabled users list**: backend endpoint to list actual disabled users (UI currently shows mock entries)

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