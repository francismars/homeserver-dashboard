# Homeserver Dashboard

A web-based administration tool for managing Pubky homeservers. Built with Next.js, React, and Shadcn UI, providing a clean interface to monitor usage, manage users, edit configuration, and perform administrative tasks.

## Features

- **Server Overview**: View homeserver information (pubkey, address, version, disk usage)
- **Usage Statistics**: Monitor user count, storage usage, and signup codes
- **Configuration Editor**: Edit `config.toml` directly from the dashboard
- **Admin Actions**: Delete URLs, disable/enable users, generate invite codes
- **File Browser**: Browse and manage files via WebDAV
- **API Explorer**: Interactive tool to test homeserver API endpoints
- **User Management**: List users, view storage, create new users

## Prerequisites

- Node.js 18+ and npm
- A running Pubky homeserver (or use mock mode for development)
- PostgreSQL (if running a real homeserver)

## Quick Start

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

## Configuration

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

If `NEXT_PUBLIC_ADMIN_BASE_URL` is not set, the dashboard automatically enables mock mode, allowing you to develop and test the UI without a running homeserver.

## Running with a Homeserver

### Local Development Setup

1. **Start your homeserver** (see [Pubky Homeserver documentation](https://github.com/synonymdev/pubky))

2. **Configure the dashboard** to point to your homeserver:
   ```bash
   NEXT_PUBLIC_ADMIN_BASE_URL=http://localhost:6288
   NEXT_PUBLIC_ADMIN_TOKEN=your-admin-password
   NEXT_PUBLIC_CLIENT_BASE_URL=http://localhost:6286
   ```

3. **Start the dashboard**:
   ```bash
   npm run dev
   ```

### Testnet Setup

For local testnet development:

1. **Run `pubky-testnet`** (provides PKARR relay and test homeserver):
   ```bash
   cd pubky-core
   $env:TEST_PUBKY_CONNECTION_STRING="postgres://postgres:123@localhost:5432/postgres"
   .\target\debug\pubky-testnet.exe --homeserver-config pubky-testnet-config.toml
   ```

2. **Configure the dashboard**:
   ```bash
   NEXT_PUBLIC_ADMIN_BASE_URL=http://localhost:6288
   NEXT_PUBLIC_ADMIN_TOKEN=admin
   NEXT_PUBLIC_CLIENT_BASE_URL=http://localhost:6286
   NEXT_PUBLIC_ADMIN_ENV=testnet
   ```

**Note**: If the homeserver fails to start due to DHT publishing issues, you can run the homeserver separately. The PKARR relay will continue running, but you'll need the homeserver running for signup to work.

## Project Structure

```
homeserver-dashboard/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── dashboard/          # Main dashboard page
│   │   └── globals.css         # Global styles
│   ├── components/             # React components
│   │   ├── atoms/              # Basic UI components
│   │   ├── molecules/          # Composite components
│   │   ├── organisms/          # Complex components
│   │   └── ui/                 # Shadcn UI components
│   ├── hooks/                  # React hooks
│   │   ├── admin/              # Admin API hooks
│   │   ├── user/               # User management hooks
│   │   └── webdav/             # WebDAV hooks
│   └── services/               # API clients
│       ├── admin/              # Admin API service
│       ├── user/               # User service
│       └── webdav/             # WebDAV service
├── .env.example                # Environment variables template
└── package.json                # Dependencies
```

## Development

### Tech Stack

- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **Shadcn UI** - Component library
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
- **Molecules**: Composite components (`ConfigEditor`, `ActionPanel`)
- **Organisms**: Complex features (`DashboardOverview`, `FileBrowser`)

Use Shadcn UI components as the foundation:

```bash
npx shadcn@latest add [component-name]
```

## Troubleshooting

### "Error loading server info" / 404 Errors

**Problem**: Dashboard can't connect to the homeserver.

**Solutions**:
1. Verify `NEXT_PUBLIC_ADMIN_BASE_URL` is set correctly
2. Ensure the homeserver is running
3. Check that `NEXT_PUBLIC_ADMIN_TOKEN` matches your homeserver's admin password
4. Verify CORS is enabled on the homeserver (should be enabled by default)

### "N/A" for Server Information

**Problem**: The `/info` endpoint doesn't return `pubkey`, `address`, or `version`.

**Solution**: This is a known limitation. The homeserver's `/info` endpoint may not include these fields. The dashboard handles this gracefully by showing "N/A".

### User Creation Fails with PKARR Errors

**Problem**: Creating a user fails with errors about PKARR resolution.

**Solutions**:
1. **For local/testnet**: Ensure the homeserver is running. The PKARR relay alone is not sufficient.
2. **For mainnet**: Ensure your homeserver is published to the DHT and accessible.
3. The SDK requires the homeserver pubkey even for local homeservers. Find it in your `config.toml` file (`homeserver_pubkey` field) or startup logs.

### WebDAV File Browser Shows "dav" Folder

**Problem**: A phantom "dav" folder appears in the file browser.

**Solution**: This has been fixed. If you still see it, ensure you're using the latest version of the dashboard.

### Config Editor Shows Mock Data

**Problem**: Config editor doesn't save changes.

**Solution**: The `GET /config` and `PUT /config` endpoints are not yet implemented on the homeserver. The dashboard works in mock mode for these endpoints. When the backend adds these endpoints, remove the mock check in `AdminService`.

## Known Limitations

1. **Config Endpoints**: `GET /config` and `PUT /config` are mocked. Backend implementation pending.
2. **Server Info Fields**: `/info` endpoint may not return `pubkey`, `address`, or `version` (shows "N/A").
3. **PKARR Resolution**: SDK's testnet mode still attempts PKARR resolution, which can fail for local homeservers.
4. **User Signup**: Requires homeserver to be running (PKARR relay alone is not sufficient).

## Contributing

This is a standalone project. Contributions are welcome! Please ensure:

- Code follows the existing patterns
- Components use Shadcn UI primitives
- TypeScript types are properly defined
- Error handling is comprehensive

## License

[Add your license here]

## Related Projects

- [Pubky Homeserver](https://github.com/synonymdev/pubky) - The homeserver this dashboard manages
- [Franky](https://github.com/synonymdev/franky) - Reference UI implementation (design system source)

## Support

For issues related to:
- **Dashboard**: Open an issue in this repository
- **Homeserver**: See [Pubky Homeserver issues](https://github.com/synonymdev/pubky/issues)

