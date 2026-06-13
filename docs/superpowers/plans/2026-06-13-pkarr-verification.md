# Pkarr Record Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overview auto-verifies the homeserver's published PKARR record (fetch from relays, signature, content vs `/info`) with a verdict chip and a "View" record viewer.

**Architecture:** Server module `src/lib/server/pkarr-verify.ts` (resolve via `@synonymdev/pkarr` + pure verdict function) behind `GET /api/pkarr-health`; Overview adds a chip row + Dialog viewer, cached in `overviewStateCache` like domain health. E2E gets a mock pkarr relay; relays are env-overridable via `PKARR_RELAYS`.

**Tech Stack:** Next.js 16 route handlers, `@synonymdev/pkarr` 0.1.4 (WASM, CJS, loaded natively via `serverExternalPackages`), vitest, existing e2e harness.

**Spike facts this plan relies on (verified in this repo today):**
- `require('@synonymdev/pkarr')` and Node ESM `import` both load fine; only bundlers break it → `serverExternalPackages` required.
- `SignedPacket.builder()` + `Keypair` build real signed fixtures; records come back as `{name: '<52-char pubkey>' | '_x.<pubkey>', ttl, rdata: {type:'HTTPS', priority, target:''|'host', params:{port?:'6287', ipv4hint?:'1.2.3.4'}} | {type:'A', address}}`.
- `packet.timestampMs` is MICROSECONDS. `Keypair` methods are snake_case (`public_key_string()`).
- `resolveMostRecent()` returns `undefined` for BOTH not-found and all-relays-down → route must classify via raw fetch (live relays 404 a nonexistent key after ~7 s DHT lookup).

---

### Task 1: Verdict module with pure logic + tests

**Files:**
- Create: `src/lib/server/pkarr-verify.ts`
- Test: `src/lib/server/pkarr-verify.test.ts`

- [ ] **Step 1: Write failing tests** using real signed packets:

```ts
import { describe, expect, it } from 'vitest';
import { Keypair, SignedPacket } from '@synonymdev/pkarr';
import { computePkarrVerdict, summarizeRecords } from './pkarr-verify';

function buildPacket(opts: { ip?: string; port?: number; domain?: string }) {
  const kp = new Keypair();
  const b = SignedPacket.builder();
  if (opts.ip && opts.port) b.addHttpsRecord('.', 1, '.', 3600, { port: opts.port, ipv4hint: opts.ip });
  if (opts.domain) b.addHttpsRecord('.', 10, opts.domain, 3600, {});
  if (opts.ip) b.addARecord('.', opts.ip, 3600);
  return b.buildAndSign(kp);
}
// cases: verified (both match), address mismatch (wrong ip / wrong port),
// domain mismatch, expected-domain-but-none-published => mismatch,
// no expectations => verified with both gates not_compared,
// invalid (valid=false) => 'invalid', summarizeRecords humanizes names/values.
```

- [ ] **Step 2: Run, verify fails** (`npx vitest run src/lib/server/pkarr-verify.test.ts`)
- [ ] **Step 3: Implement** `computePkarrVerdict(packetFacts, expected)` + `summarizeRecords` + types (`PkarrVerdict`, gates) + `resolvePkarr(pubkey)` (Client per call, relays from `PKARR_RELAYS` env or the three defaults, 8 s timeout, classification fetch on undefined: any 404 → not_found, any 200 → parse retry, else unavailable).
- [ ] **Step 4: Tests pass; commit.**

Gate semantics (user-approved deviation refined): with a packet found, an expected value that cannot be matched against the packet (record absent OR differing) is a `mismatch`; gates are `not_compared` only when the expectation itself is absent/unparseable. Staleness NEVER affects the verdict — age is returned for display only.

### Task 2: `/api/pkarr-health` route + tests

**Files:**
- Create: `src/app/api/pkarr-health/route.ts`, `src/app/api/pkarr-health/route.test.ts`
- Modify: `next.config.mjs` (add `serverExternalPackages: ['@synonymdev/pkarr']`)

- [ ] Validate `pubkey` with `/^[ybndrfg8ejkmcpqxot1uwisza345h769]{52}$/` → 400 otherwise; cap expected params at 260 chars. Route returns 200 with `{verdict, gates, published, expected, timestamp_ms, packet_age_ms, records, requestId}`; `not_found`/`unavailable` are verdicts, not errors. Log via logRouteInfo/logRouteError.
- [ ] Tests: 400 on bad pubkey; verdict pass-through with `resolvePkarr` mocked; not_found and unavailable shapes. Commit.

### Task 3: Overview chip row + viewer dialog + cache

**Files:**
- Modify: `src/components/organisms/DashboardOverview/DashboardOverview.tsx`
- Test: `src/components/organisms/DashboardOverview/DashboardOverview.test.tsx`

- [ ] State `pkarrHealth: 'unknown'|'checking'|'verified'|'mismatch'|'not_found'|'invalid'|'unavailable'` + `pkarrResult` (route payload), seeded from `overviewStateCache` when cached key (pubkey|expectedAddress|expectedDomain) matches; silent revalidate on tab return when cached verdict exists; manual re-check button; row label "Pubky network:".
- [ ] Chips: checking → spinner "Checking…"; verified → brand check "Published"; mismatch/invalid → destructive "Mismatch"/"Invalid record"; not_found → destructive "Not published"; unavailable → muted "Can't verify".
- [ ] "View" button (whenever a result with records exists) opens Dialog: records table (Type/Name/Value/TTL), "Published <relative age>" line (informational tone, never an alarm), expected-vs-published rows when mismatch, pkdns.net link in footer.
- [ ] Component tests for each chip state + viewer + cache-no-flash. Commit.

### Task 4: E2E mock relay + spec

**Files:**
- Create: `scripts/e2e/lib/mock-pkarr-relay.mjs`, `scripts/e2e/pkarr-verify.spec.mjs`
- Modify: `scripts/e2e/lib/harness.mjs` (start mock relay, export PKARR_RELAYS, expose fixture pubkey + expectations via the mock homeserver `/info`)

- [ ] Mock relay: node http server; GET `/<key>` → fixture key: 200 + `packet.bytes()` (the relay payload), unknown key: 404; a "down" mode for unavailable.
- [ ] Spec walks: verified chip appears; viewer shows records; mismatch case (info expectations differ); not_found (unpublished key); unavailable (relay stopped). Commit.

### Task 5: Docker/WASM reality check

- [ ] `npm run build` → confirm `.next/standalone/node_modules/@synonymdev/pkarr/pkarr_js_bg.wasm` exists (file tracing). If absent: explicit COPY in Dockerfile.
- [ ] Build the production image, run as uid 1001, hit `/api/pkarr-health` with a real published pubkey against live relays → expect a verdict. Commit any Dockerfile fix.

### Task 6: Docs, version, release

- [ ] CHANGELOG 0.1.17 entry; package.json 0.1.17; spec doc amendments if behavior shifted.
- [ ] Full gates: vitest, vitest --coverage, lint, tsc, e2e, build.
- [ ] PR → merge to main; tag v0.1.17; build+push `synonymsoft/homeserver-dashboard:v0.1.17` (multi-arch as before); umbrel-app-store `scripts/release.sh 0.9.1-9 --dashboard-image synonymsoft/homeserver-dashboard:v0.1.17 --notes-file <notes> --push`.
