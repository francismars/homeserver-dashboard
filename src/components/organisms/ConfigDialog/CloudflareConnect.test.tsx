import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudflareConnect } from './CloudflareConnect';

type ConnectGet = Record<string, unknown>;
type ConnectPost = { status?: number; json: Record<string, unknown> };

/** Routes the component's fetches: GET /api/cloudflare-connect from `get`,
 * POST from `post(body)`; anything else (public-health probe) gets {}. */
function mockFetch(get: () => ConnectGet, post?: (body: Record<string, unknown>) => ConnectPost) {
  const posts: Array<Record<string, unknown>> = [];
  vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const respond = (json: unknown, status = 200) =>
      new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.startsWith('/api/cloudflare-connect')) {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        posts.push(body);
        const reply = post ? post(body) : { json: {} };
        return respond(reply.json, reply.status ?? 200);
      }
      return respond({ supported: true, ...get() });
    }
    return respond({});
  });
  return posts;
}

describe('CloudflareConnect subdomain picker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const authorized = (domain: string | null): ConnectGet => ({ status: 'authorized', authorized_domain: domain });

  it('renders the subdomain input with the locked domain suffix; chips fill the input', async () => {
    mockFetch(() => authorized('example.com'));
    render(<CloudflareConnect onConfigured={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('cf-connect-subdomain')).toBeTruthy());
    expect(screen.getByTestId('cf-connect-domain-suffix').textContent).toBe('.example.com');
    expect(screen.queryByTestId('cf-connect-hostname')).toBeNull();
    for (const chip of ['pubky', 'hs', 'homeserver']) {
      fireEvent.click(screen.getByTestId(`cf-connect-chip-${chip}`));
      expect((screen.getByTestId('cf-connect-subdomain') as HTMLInputElement).value).toBe(chip);
    }
  });

  it('composes subdomain + authorized domain for the complete call', async () => {
    const posts = mockFetch(
      () => authorized('example.com'),
      () => ({ json: { ok: true, hostname: 'hs.example.com', steps: [] } }),
    );
    const onConfigured = vi.fn();
    render(<CloudflareConnect onConfigured={onConfigured} />);
    await waitFor(() => expect(screen.getByTestId('cf-connect-subdomain')).toBeTruthy());
    fireEvent.click(screen.getByTestId('cf-connect-chip-hs'));
    fireEvent.click(screen.getByTestId('cf-connect-complete'));
    await waitFor(() => expect(onConfigured).toHaveBeenCalledWith('hs.example.com'));
    expect(posts).toContainEqual({ action: 'complete', hostname: 'hs.example.com' });
  });

  it('blocks an invalid subdomain (dots, leading/trailing hyphen, empty)', async () => {
    mockFetch(() => authorized('example.com'));
    render(<CloudflareConnect onConfigured={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('cf-connect-subdomain')).toBeTruthy());
    const input = screen.getByTestId('cf-connect-subdomain') as HTMLInputElement;
    const finish = () => screen.getByTestId('cf-connect-complete') as HTMLButtonElement;
    expect(finish().disabled).toBe(true); // empty
    for (const bad of ['a.b', '-bad', 'bad-', 'b@d']) {
      fireEvent.change(input, { target: { value: bad } });
      expect(finish().disabled).toBe(true);
      expect(screen.getByTestId('cf-connect-subdomain-invalid')).toBeTruthy();
    }
    fireEvent.change(input, { target: { value: 'my-pubky1' } });
    expect(finish().disabled).toBe(false);
    expect(screen.queryByTestId('cf-connect-subdomain-invalid')).toBeNull();
  });

  it('falls back to the full-hostname input when authorized_domain is null', async () => {
    mockFetch(() => authorized(null));
    render(<CloudflareConnect onConfigured={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('cf-connect-hostname')).toBeTruthy());
    expect(screen.queryByTestId('cf-connect-subdomain')).toBeNull();
    expect(screen.queryByTestId('cf-connect-chip-pubky')).toBeNull();
  });

  it('shows the expired hint next to the Connect button', async () => {
    mockFetch(() => ({ status: 'idle', expired: true }));
    render(<CloudflareConnect onConfigured={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('cf-connect-expired')).toBeTruthy());
    expect(screen.getByTestId('cf-connect-expired').textContent).toContain('authorization link expired');
    expect(screen.getByTestId('cf-connect-start')).toBeTruthy();
  });

  it('a pre-existing completed setup renders the pure action, not a success card', async () => {
    mockFetch(() => ({ status: 'completed', hostname: 'pubky.example.com' }));
    render(<CloudflareConnect onConfigured={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('cf-connect-start')).toBeTruthy());
    expect(screen.queryByTestId('cf-connect-success')).toBeNull();
    expect(screen.queryByText(/account connected/i)).toBeNull();
  });

  it('an in-card completion shows the success feedback', async () => {
    mockFetch(
      () => authorized('example.com'),
      () => ({ json: { ok: true, hostname: 'pubky.example.com', steps: [] } }),
    );
    render(<CloudflareConnect onConfigured={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('cf-connect-subdomain')).toBeTruthy());
    fireEvent.click(screen.getByTestId('cf-connect-chip-pubky'));
    fireEvent.click(screen.getByTestId('cf-connect-complete'));
    await waitFor(() => expect(screen.getByTestId('cf-connect-success')).toBeTruthy());
    expect(screen.getByTestId('cf-connect-success').textContent).toContain('pubky.example.com');
  });

  it('a complete that 409s resets the card to idle with the error visible', async () => {
    mockFetch(
      () => authorized(null),
      () => ({ status: 409, json: { error: 'Not authorized yet. Open the Cloudflare link first.' } }),
    );
    render(<CloudflareConnect onConfigured={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('cf-connect-hostname')).toBeTruthy());
    fireEvent.change(screen.getByTestId('cf-connect-hostname'), { target: { value: 'pubky.example.com' } });
    fireEvent.click(screen.getByTestId('cf-connect-complete'));
    await waitFor(() => expect(screen.getByTestId('cf-connect-start')).toBeTruthy());
    expect(screen.getByTestId('cf-connect-error').textContent).toContain('Not authorized yet');
  });
});
