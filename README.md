# Homeserver Dashboard

A small web-based admin dashboard for Pubky homeservers. Built with **Next.js (App Router)**, **React**, and **Tailwind + shadcn/ui**.

The UI lives under a single route: **`/dashboard`** (the home page redirects there).

## Current UI

The dashboard has 5 tabs:

- **Overview**: Shows homeserver stats from `GET /info` including connection status, public key, addresses, version, and user/storage statistics
- **Users**:
  - Generate signup tokens (invites) via `GET /generate_signup_token` with QR code display for easy mobile app signup
  - Disable / enable a user by pubkey via `POST /users/{pubkey}/disable` and `POST /users/{pubkey}/enable`
  - Shows a **mock** "disabled users list" (the count comes from `/info`, but the list entries are mock until there's an API)
- **Files**: Full WebDAV file browser (list/read/write/delete/move/create directories) using the `/dav/*` endpoint (Basic Auth)
- **Logs**: Mock log viewer (no backend logs API wired yet)
- **API**: API Explorer for admin/client/metrics endpoints (manual requests)

Also in the navbar "Settings" menu:

- **Configuration**: Mock, read-only TOML viewer (no real config endpoints yet)
- **Restart / Shutdown**: Mock dialogs (no backend control endpoint yet)

## Prerequisites

- Node.js 20.9+ and npm (Next.js 16.0.10 requires Node 20.9+)
- A running Pubky homeserver (required for real data; some UI sections are still mock placeholders)

## Quick Start

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
# Homeserver admin endpoint (server-only variables)
ADMIN_BASE_URL=http://localhost:6288
ADMIN_TOKEN=your-admin-password
```

**Note:** These are server-only environment variables (not prefixed with `NEXT_PUBLIC_*`) to keep sensitive credentials secure. They are only accessible in API routes and server-side code, never exposed to the client browser.

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

## Docker Deployment

The dashboard can be deployed using Docker, either standalone or as part of an Umbrel app.

### Standalone Docker

Build the Docker image:

```bash
docker build -t homeserver-dashboard .
```

Run the container:

```bash
docker run -d \
  -p 3000:3000 \
  -e ADMIN_BASE_URL=http://homeserver:6288 \
  -e ADMIN_TOKEN=your-admin-password \
  homeserver-dashboard
```

### Umbrel Deployment

The dashboard is included in the `pubky-homeserver` Umbrel app. When deployed via Umbrel:

- The dashboard runs as the `web` service in `docker-compose.yml`
- Environment variables (`ADMIN_BASE_URL`, `ADMIN_TOKEN`) are automatically configured
- The dashboard connects to the homeserver service via Docker networking (`http://homeserver:6288`)
- Access is provided through Umbrel's app proxy (no direct port exposure needed)

The Dockerfile uses Next.js standalone output for optimal image size and includes:
- Multi-stage build for smaller production image
- Non-root user for security
- Proper handling of server-only environment variables

## Configuration

### Environment Variables

| Variable          | Description                   | Required | Default | Notes                                    |
| ----------------- | ----------------------------- | -------- | ------- | ---------------------------------------- |
| `ADMIN_BASE_URL`  | Homeserver admin API base URL | Yes\*    | -       | Server-only (not exposed to client)      |
| `ADMIN_TOKEN`     | Admin password/token          | Yes\*    | -       | Server-only (not exposed to client)     |

\* Required to use the real homeserver APIs

**Security Note:** These variables are server-only (not prefixed with `NEXT_PUBLIC_*`) to prevent exposing sensitive credentials to the browser. They are automatically loaded from `.env.local` in development and from environment variables in production/Docker.

**Docker Note:** In Docker/Umbrel deployments, use the homeserver service name for `ADMIN_BASE_URL` (e.g., `http://homeserver:6288`) instead of `localhost` to connect via Docker networking.

## Development

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

This is a standalone project. Contributions are welcome! Please ensure:

- Code follows the existing patterns
- Components use Shadcn UI primitives
- TypeScript types are properly defined
- Error handling is comprehensive
- Mock data is clearly marked with badges
- Real vs mock implementations are documented

## Related Projects

- [Pubky Homeserver](https://github.com/synonymdev/pubky) - The homeserver this dashboard manages
- [Franky](https://github.com/synonymdev/franky) - Reference UI implementation (design system source)