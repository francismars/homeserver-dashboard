# Homeserver Dashboard

A small web-based admin dashboard for Pubky homeservers. Built with **Next.js (App Router)**, **React**, and **Tailwind + shadcn/ui**.

The UI lives under a single route: **`/dashboard`** (the home page redirects there).

## Current UI

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
# Homeserver admin endpoint
NEXT_PUBLIC_ADMIN_BASE_URL=http://localhost:6288
NEXT_PUBLIC_ADMIN_TOKEN=your-admin-password
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

| Variable                     | Description                   | Required | Default |
| ---------------------------- | ----------------------------- | -------- | ------- |
| `NEXT_PUBLIC_ADMIN_BASE_URL` | Homeserver admin API base URL | Yes\*    | -       |
| `NEXT_PUBLIC_ADMIN_TOKEN`    | Admin password/token          | Yes\*    | -       |

\* Required to use the real homeserver APIs

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