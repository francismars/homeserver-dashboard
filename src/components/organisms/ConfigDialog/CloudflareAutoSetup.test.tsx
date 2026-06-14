import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudflareAutoSetup } from './CloudflareAutoSetup';

/** Routes the two endpoints the card uses: /zones and the setup POST. */
function mockFetch(zones: unknown[], setup: () => { status?: number; json: Record<string, unknown> }) {
  vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const respond = (json: unknown, status = 200) =>
      new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/api/cloudflare-auto-setup/zones')) return respond({ zones });
    if (url.includes('/api/cloudflare-auto-setup')) {
      const reply = init?.method === 'POST' ? setup() : { json: {} };
      return respond(reply.json, reply.status ?? 200);
    }
    return respond({});
  });
}

async function loadZonesAndRun() {
  fireEvent.change(screen.getByTestId('cf-auto-token'), { target: { value: 'x'.repeat(40) } });
  fireEvent.click(screen.getByTestId('cf-auto-load-zones'));
  await waitFor(() => expect(screen.getByTestId('cf-auto-create')).toBeTruthy());
  fireEvent.click(screen.getByTestId('cf-auto-create'));
}

describe('CloudflareAutoSetup error/conflict deep links', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  const ZONES = [{ id: 'z1', name: 'example.com', status: 'active', account_id: 'acc-1' }];

  it('a DNS conflict renders the record, a deep link, and the Replace button', async () => {
    mockFetch(ZONES, () => ({
      status: 409,
      json: {
        error: 'A DNS record already exists at pubky.example.com',
        type: 'dns_conflict',
        existing_records: [{ type: 'A', content: '1.2.3.4' }],
        dashboard_url: 'https://dash.cloudflare.com/acc-1/example.com/dns',
        dashboard_label: 'Open DNS settings for example.com',
        steps: [{ key: 'dns', status: 'failed' }],
      },
    }));
    render(<CloudflareAutoSetup onConfigured={() => {}} />);
    await loadZonesAndRun();
    await waitFor(() => expect(screen.getByTestId('cf-auto-conflict')).toBeTruthy());
    expect(screen.getByTestId('cf-auto-conflict').textContent).toContain('A → 1.2.3.4');
    const link = screen.getByTestId('cf-auto-conflict-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://dash.cloudflare.com/acc-1/example.com/dns');
    expect(screen.getByTestId('cf-auto-overwrite')).toBeTruthy();
  });

  it('a non-conflict error with a deep link renders the shared error link', async () => {
    mockFetch(ZONES, () => ({
      status: 409,
      json: {
        error: 'A locally-managed tunnel named "pubky-homeserver" already exists.',
        type: 'bad_request',
        dashboard_url: 'https://one.dash.cloudflare.com/acc-1/networks/tunnels',
        dashboard_label: 'Open Cloudflare Tunnels',
        steps: [{ key: 'tunnel', status: 'failed' }],
      },
    }));
    render(<CloudflareAutoSetup onConfigured={() => {}} />);
    await loadZonesAndRun();
    await waitFor(() => expect(screen.getByTestId('cf-auto-error').textContent).toContain('locally-managed'));
    const link = screen.getByTestId('cf-auto-error-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://one.dash.cloudflare.com/acc-1/networks/tunnels');
    expect(link.textContent).toContain('Open Cloudflare Tunnels');
  });
});
