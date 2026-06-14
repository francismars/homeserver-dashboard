# Standalone vs Umbrel Deployment Awareness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Detect Umbrel vs standalone at runtime and hide Umbrel-only Cloudflare setup + reword Umbrel-only copy when standalone, keeping the read-only status views.

**Architecture:** A `PLATFORM` env var read by `getPlatform()` (server); the server root layout seeds a `PlatformProvider` so client components read `usePlatform()` with no fetch. Cloudflare *setup* UI + routes are gated to umbrel; status views (public address, reachability, pkarr) stay. Restart copy and the backup note become platform-aware.

**Tech Stack:** Next.js 16 App Router (server layout + client context), vitest, existing e2e harness.

**Spec:** `docs/superpowers/specs/2026-06-14-standalone-vs-umbrel-design.md`. Decisions: explicit `PLATFORM` env; hide CF setup / keep status; generic restart copy; hide the get-started reachable step standalone; `/cloudflare-guide` shows a "not applicable" notice standalone.

---

### Task 1: Platform detection core

**Files:** Create `src/lib/server/platform.ts`, `src/lib/server/platform.test.ts`

- [ ] **Write failing test** `platform.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest';
import { getPlatform } from './platform';
describe('getPlatform', () => {
  afterEach(() => { delete process.env.PLATFORM; });
  it('umbrel only when PLATFORM=umbrel', () => { process.env.PLATFORM = 'umbrel'; expect(getPlatform()).toBe('umbrel'); });
  it('standalone when unset', () => { delete process.env.PLATFORM; expect(getPlatform()).toBe('standalone'); });
  it('standalone for any other value (fail safe to generic)', () => { process.env.PLATFORM = 'docker'; expect(getPlatform()).toBe('standalone'); });
});
```
- [ ] **Run:** `npx vitest run src/lib/server/platform.test.ts` → FAIL (no module).
- [ ] **Implement** `platform.ts`:
```ts
export type Platform = 'umbrel' | 'standalone';
/** Read lazily (call time). The same image serves both; only the runtime
 * env differs. Anything other than the explicit 'umbrel' is standalone, so
 * a misconfigured value fails safe toward the generic experience. */
export function getPlatform(): Platform {
  return process.env.PLATFORM === 'umbrel' ? 'umbrel' : 'standalone';
}
```
- [ ] **Run → PASS. Commit** `feat: platform detection (PLATFORM env)`.

### Task 2: Client PlatformProvider + layout injection

**Files:** Create `src/components/providers/PlatformProvider.tsx`, `src/components/providers/PlatformProvider.test.tsx`; Modify `src/app/layout.tsx`

- [ ] **Write failing test** `PlatformProvider.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlatformProvider, usePlatform } from './PlatformProvider';
function Probe() { return <span data-testid="p">{usePlatform()}</span>; }
describe('PlatformProvider', () => {
  it('exposes the platform value', () => {
    render(<PlatformProvider platform="standalone"><Probe /></PlatformProvider>);
    expect(screen.getByTestId('p').textContent).toBe('standalone');
  });
  it('defaults to umbrel when no provider (back-compat for untouched trees)', () => {
    render(<Probe />);
    expect(screen.getByTestId('p').textContent).toBe('umbrel');
  });
});
```
- [ ] **Run → FAIL. Implement** `PlatformProvider.tsx`:
```tsx
'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { Platform } from '@/lib/server/platform';
// Default 'umbrel' so any component not yet wrapped keeps today's behavior.
const PlatformContext = createContext<Platform>('umbrel');
export function PlatformProvider({ platform, children }: { platform: Platform; children: ReactNode }) {
  return <PlatformContext.Provider value={platform}>{children}</PlatformContext.Provider>;
}
export function usePlatform(): Platform { return useContext(PlatformContext); }
```
Note: importing the `Platform` *type* from a server module is fine (types are erased; no server code is bundled).
- [ ] **Run → PASS.** Modify `layout.tsx` to inject it:
```tsx
import type { ReactNode } from 'react';
import './globals.css';
import { getPlatform } from '@/lib/server/platform';
import { PlatformProvider } from '@/components/providers/PlatformProvider';
export const metadata = { /* unchanged */ };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PlatformProvider platform={getPlatform()}>{children}</PlatformProvider>
      </body>
    </html>
  );
}
```
(Keep the existing `metadata` object verbatim.)
- [ ] **Run** `npx tsc --noEmit` → OK. **Commit** `feat: PlatformProvider seeded by the server layout`.

### Task 3: Platform-aware restart copy

**Files:** Modify `src/lib/restart-copy.ts`; Create `src/lib/restart-copy.test.ts`, `src/hooks/useRestartSentence.ts`; Modify every RESTART_APP_SENTENCE call site.

- [ ] **Write failing test** `restart-copy.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { restartAppSentence } from './restart-copy';
describe('restartAppSentence', () => {
  it('umbrel mentions Umbrel', () => { expect(restartAppSentence('umbrel')).toContain('from Umbrel'); });
  it('standalone is generic, no Umbrel', () => {
    const s = restartAppSentence('standalone');
    expect(s.toLowerCase()).toContain('restart your homeserver');
    expect(s).not.toContain('Umbrel');
  });
});
```
- [ ] **Run → FAIL. Implement** in `restart-copy.ts` (keep the doc comment; replace the const):
```ts
import type { Platform } from '@/lib/server/platform';
export function restartAppSentence(platform: Platform): string {
  return platform === 'umbrel'
    ? "Restart the Pubky Homeserver app from Umbrel (open the app's tile, then Restart)."
    : 'Restart your homeserver to apply this.';
}
```
- [ ] **Run → PASS.** Create the client hook `src/hooks/useRestartSentence.ts`:
```ts
import { usePlatform } from '@/components/providers/PlatformProvider';
import { restartAppSentence } from '@/lib/restart-copy';
export function useRestartSentence(): string { return restartAppSentence(usePlatform()); }
```
- [ ] **Convert server call sites** — in each of `src/app/api/server-config/route.ts`, `cloudflare-config/route.ts`, `cloudflare-connect/route.ts`, `cloudflare-auto-setup/route.ts`, `cloudflare-disconnect/route.ts`: replace `import { RESTART_APP_SENTENCE } from '@/lib/restart-copy'` with `import { restartAppSentence } from '@/lib/restart-copy'` and `import { getPlatform } from '@/lib/server/platform'`; inside each handler add `const restart = restartAppSentence(getPlatform());` and replace `${RESTART_APP_SENTENCE}` usages with `${restart}`.
- [ ] **Convert client call sites** — in `DashboardOverview.tsx`, `ConfigDialog.tsx`, `RestartCallout.tsx`, `CloudflarePreview.tsx`, `cloudflare-guide/page.tsx`: replace the import with `import { useRestartSentence } from '@/hooks/useRestartSentence'`, add `const restartSentence = useRestartSentence();` at the top of the component, and replace `{RESTART_APP_SENTENCE}` / `${RESTART_APP_SENTENCE}` with `{restartSentence}` / `${restartSentence}`. (RestartCallout/CloudflarePreview/cloudflare-guide only render on umbrel after later tasks, but converting them keeps the copy uniform and correct if ever shown.)
- [ ] **Run** `npx tsc --noEmit && npx vitest run` → green (update any test asserting the old constant string to call `restartAppSentence('umbrel')`). **Commit** `feat: platform-aware restart copy`.

### Task 4: Cloudflare setup routes refuse on standalone

**Files:** Modify `cloudflare-connect/route.ts` (POST), `cloudflare-auto-setup/route.ts` (POST), `cloudflare-preview/route.ts` (POST), `cloudflare-disconnect/route.ts` (POST), `cloudflare-config/route.ts` (POST only); Tests in each `route.test.ts`.

- [ ] **Write failing test** (pattern, per route — example for auto-setup `route.test.ts`):
```ts
it('refuses on standalone with 404 not_supported', async () => {
  process.env.PLATFORM = 'standalone';
  const res = await post(validBody);
  expect(res.status).toBe(404);
  expect((await res.json()).type).toBe('not_supported');
  delete process.env.PLATFORM;
});
```
(Each route test file already sets `process.env.PLATFORM` undefined by default → standalone. So ALSO set `process.env.PLATFORM = 'umbrel'` in those files' `beforeEach` so the EXISTING happy-path tests keep exercising the umbrel path.)
- [ ] **Run → FAIL** (currently returns 200). **Implement** the guard as the first lines of each gated handler:
```ts
import { getPlatform } from '@/lib/server/platform';
// ... at the top of POST(), after getRequestId:
if (getPlatform() !== 'umbrel') {
  return errorResponse(new RouteError(404, 'not_supported', 'Cloudflare setup is only available on Umbrel.'), requestId);
}
```
Verify `RouteError`/`errorResponse` accept a `not_supported` type (it's a free-form string in `RouteError`; confirm in `src/lib/server/errors.ts`). The `cloudflare-config` GET is NOT guarded (status views need it); only its POST is.
- [ ] **Add `process.env.PLATFORM = 'umbrel'`** to the `beforeEach` of every gated route's test file so existing tests stay on the umbrel path; add the new standalone-refusal test to each.
- [ ] **Run → PASS. Commit** `feat: Cloudflare setup routes 404 on standalone`.

### Task 5: Hide Cloudflare setup UI on standalone

**Files:** Modify `ConfigDialog.tsx`, `DashboardOverview.tsx`, `GetStartedChecklist.tsx` + types, `cloudflare-guide/page.tsx`; update their tests.

- [ ] **ConfigDialog CF tab gate.** Add `const platform = usePlatform();` (import from PlatformProvider). Change the tab-visibility derivation so the Cloudflare tab only shows on umbrel: where `setIsCloudflareTabVisible(Boolean(data.supported))` is set (≈ line 205) and the fallback `setIsCloudflareTabVisible(true)` (≈ line 212), wrap with platform: `setIsCloudflareTabVisible(platform === 'umbrel' && Boolean(data.supported))` and `setIsCloudflareTabVisible(platform === 'umbrel')`. (The default-tab effect already redirects away from a hidden CF tab.) Test: render ConfigDialog inside `<PlatformProvider platform="standalone">` → no `{ id: 'cloudflare' }` tab; inside `umbrel` → tab present.
- [ ] **Overview CTAs + get-started step.** In `DashboardOverview.tsx`: `const platform = usePlatform();`. Gate the domain-health "Fix it"/"Set up" button and the get-started checklist on `platform === 'umbrel'`:
  - The `onFixCloudflare` CTA in the Public-address row: render only when `platform === 'umbrel'` (wrap the existing `&& onFixCloudflare` condition with `platform === 'umbrel' && ...`).
  - Pass a new optional prop to `GetStartedChecklist` to omit the reachable step: add `showReachableStep?: boolean` to `GetStartedChecklistProps`, default true; pass `showReachableStep={platform === 'umbrel'}`. In `GetStartedChecklist`, when `!showReachableStep`, drop the reachable `StepRow` and exclude `reachableStatus` from `allDone` (so `allDone = (!showReachableStep || reachableStatus === 'done') && inviteDone && signupDone`), and the all-set expanded list omits the reachable step too.
- [ ] **Tests:** Overview standalone → no `domain-health-fix`, no `setup-step-reachable`; status rows (`domain-health-*`, `pkarr-health-*`) still present. Umbrel → unchanged. GetStartedChecklist `showReachableStep={false}` → only invite+signup steps; all-set when those two done.
- [ ] **cloudflare-guide standalone notice.** `cloudflare-guide/page.tsx` is a server component — read `getPlatform()`; when standalone, return a minimal card: "Cloudflare setup runs as part of the Umbrel app and isn't available in a standalone deployment. Set up your own reverse proxy or tunnel to expose your homeserver." Test by rendering with `PLATFORM` set/unset (or assert the exported component branches — if it's hard to unit test a server page, cover it in the e2e standalone spec instead and note that here).
- [ ] **Run** `npx tsc --noEmit && npx vitest run` → green. **Commit** `feat: hide Cloudflare setup UI on standalone`.

### Task 6: Platform-aware backup note

**Files:** Modify `DashboardOverview.tsx`; update `DashboardOverview.test.tsx`.

- [ ] In the backup-note `<p data-testid="backup-note">`, branch on `platform`:
  - umbrel (unchanged): "Backups: your homeserver's identity and all user data live in this app's data directory, and umbrelOS 1.5+ built-in backups include app data automatically. Just don't exclude this app in your backup settings; losing this data means losing this server's identity."
  - standalone: "Backups: your homeserver's identity and all user data live in this app's data directory. Back it up regularly — losing this data means losing this server's identity."
- [ ] **Tests:** umbrel note contains 'umbrelOS'; standalone note does not contain 'umbrel' (case-insensitive) and contains 'Back it up'. **Run → green. Commit** `feat: platform-aware backup note`.

### Task 7: Umbrel compose + README

**Files:** Modify `umbrel-app-store/pubky-homeserver/docker-compose.yml` (the `web` service env); `README.md`.

- [ ] Add `PLATFORM: umbrel` to the `web` service `environment:` block (next to `ADMIN_PASSWORD_MANAGED`). Validate: `python3 -c "import yaml; yaml.safe_load(open('pubky-homeserver/docker-compose.yml'))"`.
- [ ] README: document `PLATFORM` (umbrel|unset) under the config table, and a short "Standalone deployment" note that Cloudflare setup is Umbrel-only and copy is generic. **Commit** (umbrel repo commit happens at release; dashboard README commit `docs: document PLATFORM`).

### Task 8: e2e + Docker reality check

**Files:** Create `scripts/e2e/standalone.spec.mjs`; Modify `scripts/e2e/lib/harness.mjs` (the harness sets `PLATFORM=umbrel` by default so all existing specs stay on the umbrel path; the new spec overrides to standalone).

- [ ] Harness: add `PLATFORM: 'umbrel'` to the dev-server env in `startDashboard`, plus a `platform` option (default 'umbrel') so a spec can request standalone.
- [ ] `standalone.spec.mjs`: boot with `platform: 'standalone'`; assert on `/dashboard`: no Cloudflare tab in Settings, no `setup-step-reachable`, no `domain-health-fix`; the public-address status row + `pkarr-health-*` still render; the backup note has no 'umbrel'. Assert `/cloudflare-guide` shows the standalone notice. Add to `run-all.mjs` SPECS.
- [ ] **Docker reality check:** `docker build`; run the image with `PLATFORM` unset → curl `/dashboard` HTML lacks the Cloudflare tab markers and a CF setup route returns 404; run with `-e PLATFORM=umbrel` → CF surfaces present. Document the commands run.
- [ ] **Commit** `test: standalone e2e + platform harness wiring`.

### Task 9: Gates, version, release

- [ ] Full gates: `npx vitest run` (note the known-flaky `cloudflared-process` concurrent-steal test — re-run if only that fails), `npx vitest run --coverage`, `npm run lint`, `npx tsc --noEmit`, `npm run format:check`, full e2e.
- [ ] CHANGELOG + package.json bump (next patch); PR → CI → merge → tag → image; umbrel-app-store `release.sh <ver> --dashboard-image <v> --notes-file <notes>` (this commit also carries the `PLATFORM: umbrel` compose change + the already-committed Preview-badge/All-set-expand work + the token-collapse if not yet released).
