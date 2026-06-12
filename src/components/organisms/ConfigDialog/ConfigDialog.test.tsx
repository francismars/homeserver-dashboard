import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigDialog } from './ConfigDialog';

type CloudflareMode = 'connect' | 'token' | 'preview' | 'off';
type JsonResponse = { status?: number; json: Record<string, unknown> };

/** Mutable fake backend for everything the dialog fetches. */
function mockBackend(initial: {
  cloudflareConfig: JsonResponse;
  connect?: Record<string, unknown>;
  preview?: Record<string, unknown>;
}) {
  const backend = {
    cloudflareConfig: initial.cloudflareConfig,
    connect: initial.connect ?? { supported: true, status: 'idle' },
    preview: initial.preview ?? { enabled: false, instant: { status: 'stopped' }, supported: true },
    disconnect: { status: 200, json: { ok: true, message: 'Disconnected. Restart the app from Umbrel to finish.' } },
    disconnectCalls: 0,
  };
  vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const respond = (json: unknown, status = 200) =>
      new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.startsWith('/api/cloudflare-config') && init?.method !== 'POST') {
      return respond(backend.cloudflareConfig.json, backend.cloudflareConfig.status ?? 200);
    }
    if (url.startsWith('/api/cloudflare-connect')) return respond(backend.connect);
    if (url.startsWith('/api/cloudflare-preview')) return respond(backend.preview);
    if (url.startsWith('/api/cloudflare-disconnect')) {
      backend.disconnectCalls++;
      return respond(backend.disconnect.json, backend.disconnect.status);
    }
    if (url.startsWith('/api/public-health')) return respond({ ok: true });
    if (url.startsWith('/api/server-config')) return respond({ error: 'not available' }, 404);
    return respond({});
  });
  return backend;
}

const cfConfig = (mode: CloudflareMode, domain: string | null = null): JsonResponse => ({
  json: { domain, mode, configured: mode === 'connect' || mode === 'token', supported: true },
});

function renderDialog() {
  return render(<ConfigDialog open onOpenChange={() => {}} />);
}

describe('ConfigDialog Cloudflare status surface', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mode off: badge says Off, all four setup cards render directly, no disconnect', async () => {
    mockBackend({ cloudflareConfig: cfConfig('off') });
    renderDialog();
    await waitFor(() => expect(screen.getByTestId('cf-mode-badge')).toBeTruthy());
    expect(screen.getByTestId('cf-mode-badge').textContent).toBe('Off');
    expect(screen.getByTestId('cf-connect')).toBeTruthy();
    expect(screen.getByTestId('cf-api-token-toggle')).toBeTruthy();
    expect(screen.getByTestId('cf-preview')).toBeTruthy();
    expect(screen.getByTestId('cf-manual-toggle')).toBeTruthy();
    expect(screen.queryByTestId('cf-switch-method-toggle')).toBeNull();
    expect(screen.queryByTestId('cf-disconnect')).toBeNull();
  });

  it('mode connect: badge, domain, reachability chip and a single disconnect; cards collapsed', async () => {
    mockBackend({
      cloudflareConfig: cfConfig('connect', 'pubky.example.com'),
      connect: { supported: true, status: 'completed', hostname: 'pubky.example.com' },
    });
    renderDialog();
    await waitFor(() => expect(screen.getByTestId('cf-mode-badge')).toBeTruthy());
    expect(screen.getByTestId('cf-mode-badge').textContent).toBe('Connected account');
    expect(screen.getByTestId('cf-status-address').textContent).toBe('pubky.example.com');
    await waitFor(() => expect(screen.getByTestId('cf-status-reachable')).toBeTruthy());
    expect(screen.getAllByTestId('cf-disconnect')).toHaveLength(1);
    // Cards are demoted to the disclosure and assert nothing themselves.
    expect(screen.queryByTestId('cf-connect')).toBeNull();
    expect(screen.queryByTestId('cf-connect-success')).toBeNull();
    fireEvent.click(screen.getByTestId('cf-switch-method-toggle'));
    await waitFor(() => expect(screen.getByTestId('cf-connect')).toBeTruthy());
    // Even though the server reports the connect flow as completed, the card
    // is a pure action again: no second success state, no second disconnect.
    expect(screen.getByTestId('cf-connect-start')).toBeTruthy();
    expect(screen.queryByTestId('cf-connect-success')).toBeNull();
    expect(screen.getAllByTestId('cf-disconnect')).toHaveLength(1);
  });

  it('mode token: badge says API token', async () => {
    mockBackend({ cloudflareConfig: cfConfig('token', 'pubky.example.com') });
    renderDialog();
    await waitFor(() => expect(screen.getByTestId('cf-mode-badge')).toBeTruthy());
    expect(screen.getByTestId('cf-mode-badge').textContent).toBe('API token');
    expect(screen.getByTestId('cf-status-address').textContent).toBe('pubky.example.com');
  });

  it('mode preview: badge says Preview and the address comes from the preview endpoint', async () => {
    mockBackend({
      cloudflareConfig: cfConfig('preview'),
      preview: {
        enabled: true,
        instant: { status: 'stopped' },
        published_url: 'https://random.trycloudflare.com',
        supported: true,
      },
    });
    renderDialog();
    await waitFor(() => expect(screen.getByTestId('cf-mode-badge')).toBeTruthy());
    expect(screen.getByTestId('cf-mode-badge').textContent).toBe('Preview');
    await waitFor(() =>
      expect(screen.getByTestId('cf-status-address').textContent).toBe('https://random.trycloudflare.com'),
    );
    expect(screen.getByTestId('cf-disconnect')).toBeTruthy();
  });

  it('disconnect re-syncs everything: no card can keep claiming connected', async () => {
    const backend = mockBackend({
      cloudflareConfig: cfConfig('connect', 'pubky.example.com'),
      connect: { supported: true, status: 'completed', hostname: 'pubky.example.com' },
    });
    renderDialog();
    await waitFor(() => expect(screen.getByTestId('cf-disconnect')).toBeTruthy());
    // Open the disclosure first so a stale card would be visible if it cached.
    fireEvent.click(screen.getByTestId('cf-switch-method-toggle'));
    await waitFor(() => expect(screen.getByTestId('cf-connect')).toBeTruthy());

    fireEvent.click(screen.getByTestId('cf-disconnect'));
    expect(screen.getByTestId('cf-disconnect').textContent).toBe('Confirm?');
    // After the disconnect lands, the server reports mode off everywhere.
    backend.cloudflareConfig = cfConfig('off');
    backend.connect = { supported: true, status: 'idle' };
    fireEvent.click(screen.getByTestId('cf-disconnect'));

    await waitFor(() => expect(screen.getByTestId('cf-mode-badge').textContent).toBe('Off'));
    expect(backend.disconnectCalls).toBe(1);
    expect(screen.queryByTestId('cf-disconnect')).toBeNull();
    expect(screen.queryByTestId('cf-switch-method-toggle')).toBeNull();
    // Cards render directly again as pure actions; the old contradiction
    // (a card claiming "connected" under an Off status) must be impossible.
    await waitFor(() => expect(screen.getByTestId('cf-connect-start')).toBeTruthy());
    expect(screen.queryByTestId('cf-connect-success')).toBeNull();
    expect(screen.queryByText(/account connected/i)).toBeNull();
    const callout = screen.getByTestId('restart-callout');
    expect(callout.textContent).toContain('Disconnected');
  });

  it('a 500 keeps the tab with a retry state instead of hiding it as unsupported', async () => {
    const backend = mockBackend({
      cloudflareConfig: { status: 500, json: { error: 'Could not read the Cloudflare configuration' } },
    });
    renderDialog();
    await waitFor(() => expect(screen.getByTestId('cf-unavailable')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Cloudflare' })).toBeTruthy();
    expect(within(screen.getByTestId('cf-unavailable')).getByText(/temporarily unavailable/)).toBeTruthy();

    backend.cloudflareConfig = cfConfig('off');
    fireEvent.click(screen.getByTestId('cf-retry'));
    await waitFor(() => expect(screen.getByTestId('cf-mode-badge')).toBeTruthy());
    expect(screen.queryByTestId('cf-unavailable')).toBeNull();
  });

  it('supported:false still hides the tab (genuine unsupported environment)', async () => {
    mockBackend({
      cloudflareConfig: { json: { domain: null, mode: 'off', configured: false, supported: false } },
    });
    renderDialog();
    await waitFor(() => expect(screen.getByText('Settings are not available in this environment.')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Cloudflare' })).toBeNull();
  });
});
