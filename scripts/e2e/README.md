# Browser e2e suite

End-to-end tests for the Cloudflare setup flows, driven through a real
browser against a real `next dev` server, with everything external faked:

- a **mock Cloudflare v4 API** (`lib/mock-cf-server.mjs`, pointed at via
  `CF_API_BASE`),
- a **fake `cloudflared` binary** (bash script, pointed at via
  `CLOUDFLARED_BIN`) that fakes `login` / `tunnel create` / `route dns` /
  quick tunnels,
- a **mock homeserver admin API** (`/info`, `/users/disabled`),
- temp dirs for `CLOUDFLARE_CONFIG_DIR`, `HOMESERVER_CONFIG_PATH` and
  `HOMESERVER_LOG_PATH`.

Each spec boots its own isolated environment (own temp dirs, own dev server
on a free port), so specs share no state and can run in any order. The
shared boot/teardown/browser logic lives in `lib/harness.mjs`.

## Requirements

- `npm install` (the suite uses the `playwright-core` devDependency; no
  browser download needed)
- system Google Chrome at `/usr/bin/google-chrome` (override with
  `E2E_CHROME=/path/to/chrome`)
- Linux: the dashboard's process-identity checks read `/proc`

## Running

```sh
npm run e2e               # all specs, sequential, with a summary
npm run e2e -- preview    # only specs whose filename matches
node scripts/e2e/cf-auto.spec.mjs   # a single spec directly
```

Each spec needs roughly 15-30 s (dev-server boot + on-demand compile
dominate).

## Specs

| Spec                          | Covers                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cf-auto.spec.mjs`            | API-token automatic setup: domain-only config save rejected without a token (400), invalid-token error, zone loading with pending zones disabled, the shared setup flow lock (409 on concurrent attempts), DNS conflict prompt + invalidation when the subdomain changes, happy path, confirmed overwrite of a conflicting record, manual escape hatch.                                               |
| `preview.spec.mjs`            | Preview mode: limitations list, enable (instant trycloudflare URL from the tunnel log, restart callout, `testdrive.env` marker), disable (honest response message, marker + state cleanup).                                                                                                                                                                                                           |
| `disconnect.spec.mjs`         | Disconnect from a completed Connect setup: self-dismissing restart callout when the domain is reachable, two-click confirm, full on-disk reset (config.yml, credentials, token/domain truncation, homeserver `icann_domain` reset), domain-only save rejected afterwards.                                                                                                                             |
| `overview-health.spec.mjs`    | Overview domain-health chip: reachable / unreachable (+ "Fix it" opens the Cloudflare tab) / not-set-up states.                                                                                                                                                                                                                                                                                       |
| `connect-authorized.spec.mjs` | Connect (browser-auth) flow: prerequisites copy on the idle card, waiting card with auth link, cert-derived subdomain picker with locked suffix and suggestion chips (fixture cert authorizes example.com), client-side subdomain validation, completion artifacts, domain-only save rejected while Connect-managed, full-hostname fallback for an unparseable cert, expired-authorization idle card. |
| `preview-supersede.spec.mjs`  | A real setup supersedes preview: enable preview, complete the token setup, assert preview is fully torn down (`testdrive.env` gone, instant child killed, GET reports disabled) and re-enabling is refused (409) while the permanent setup exists.                                                                                                                                                    |

Notes:

- The preview "did not exit" disable message needs an unkillable child and
  is therefore covered by the route's unit tests, not here; the e2e asserts
  the clean honest variant (`Preview disabled.`).
- The mock CF server is also runnable standalone for manual poking:
  `node scripts/e2e/lib/mock-cf-server.mjs` (port 9911).

## Relation to the live gate

`scripts/validate-live-cloudflare.mjs` is the complementary release gate
that runs the same routes against the real Cloudflare API (real token, real
DNS, real quick tunnel) and now covers every tier: preview enable/disable,
zones, full token setup, idempotent re-run, written files, edge
reachability, and disconnect. It needs a real Cloudflare account and is run
manually before releases; this e2e suite is the hermetic everyday proof.
