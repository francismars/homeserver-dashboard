import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardOverview, __resetOverviewStateCache } from './DashboardOverview';
import { PlatformProvider } from '@/components/providers/PlatformProvider';
import type { AdminInfoResponse } from '@/services/admin';

const baseInfo: AdminInfoResponse = {
  num_users: 1,
  num_disabled_users: 0,
  total_disk_used_mb: 1,
  num_signup_codes: 0,
  num_unused_signup_codes: 0,
  public_key: 'x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o',
  pkarr_pubky_address: '1.2.3.4:6287',
  pkarr_icann_domain: 'pubky.example.com:443',
  version: '0.9.1',
};

/** A well-formed /api/pkarr-health payload; gates/records track the verdict. */
function pkarrPayload(verdict: string, overrides: Record<string, unknown> = {}) {
  const found = verdict === 'verified' || verdict === 'mismatch' || verdict === 'invalid';
  return {
    verdict,
    gates:
      verdict === 'mismatch'
        ? { address: 'match', domain: 'mismatch' }
        : { address: found ? 'match' : 'not_compared', domain: found ? 'match' : 'not_compared' },
    published: found
      ? { address: '1.2.3.4:6287', domain: verdict === 'mismatch' ? 'old.example.org' : 'pubky.example.com' }
      : { address: null, domain: null },
    expected: { address: '1.2.3.4:6287', domain: 'pubky.example.com:443' },
    timestamp_ms: found ? Date.now() - 60_000 : null,
    packet_age_ms: found ? 60_000 : null,
    records: found
      ? [
          { name: '@', type: 'HTTPS', value: '1 . port=6287 ipv4hint=1.2.3.4', ttl: 3600 },
          { name: '@', type: 'A', value: '1.2.3.4', ttl: 3600 },
        ]
      : [],
    ...overrides,
  };
}

/** Routes the component's fetches: the public-health probe, the pkarr-health
 * verification, and the restart-pending + mode read from /api/cloudflare-config. */
function mockBackend({
  healthOk = true,
  restartPending = null as boolean | null,
  mode = null as string | null,
  pkarr = 'verified' as string,
  pkarrOverrides = {} as Record<string, unknown>,
} = {}) {
  vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith('/api/pkarr-health') && pkarr === 'http-error') {
      return new Response('upstream broke', { status: 502 });
    }
    const json = url.startsWith('/api/cloudflare-config')
      ? { restart_pending: restartPending, mode }
      : url.startsWith('/api/pkarr-health')
        ? pkarrPayload(pkarr, pkarrOverrides)
        : { ok: healthOk, status: healthOk ? 200 : 530 };
    return new Response(JSON.stringify(json), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}

function pkarrCalls() {
  return (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
    String(c[0]).startsWith('/api/pkarr-health'),
  );
}

function healthCalls() {
  return (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
    String(c[0]).startsWith('/api/public-health'),
  );
}

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

describe('DashboardOverview domain health', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetOverviewStateCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('probes the domain (without port) once and shows Reachable', async () => {
    mockBackend({ healthOk: true });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} onFixCloudflare={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('domain-health-reachable')).toBeTruthy());
    expect(healthCalls()).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/public-health?domain=pubky.example.com', // port stripped
      expect.anything(),
    );
    expect(screen.queryByTestId('domain-health-fix')).toBeNull();
  });

  it('shows Not reachable + Fix it on failure; Fix it opens the Cloudflare tab', async () => {
    mockBackend({ healthOk: false });
    const onFix = vi.fn();
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} onFixCloudflare={onFix} />);
    await waitFor(() => expect(screen.getByTestId('domain-health-unreachable')).toBeTruthy());
    expect(screen.getByTestId('domain-health-unreachable').textContent).toContain('Not reachable');
    expect(screen.getByTestId('domain-health-unreachable').textContent).not.toContain('Not reachable yet');
    fireEvent.click(screen.getByTestId('domain-health-fix'));
    expect(onFix).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('domain-health-fix').textContent).toBe('Fix it');
  });

  it('unreachable while a restart is pending: "Not reachable yet" + restart hint, no Fix it', async () => {
    mockBackend({ healthOk: false, restartPending: true });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} onFixCloudflare={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('domain-health-restart-hint')).toBeTruthy());
    expect(screen.getByTestId('domain-health-unreachable').textContent).toContain('Not reachable yet');
    expect(screen.getByTestId('domain-health-restart-hint').textContent).toContain('To finish setup');
    expect(screen.getByTestId('domain-health-restart-hint').textContent).toContain(
      'Restart the Pubky Homeserver app from Umbrel',
    );
    expect(screen.queryByTestId('domain-health-fix')).toBeNull();
  });

  it('localhost domain: no probe, "Not set up" + Set up button, localhost value not shown', async () => {
    mockBackend();
    const onFix = vi.fn();
    render(
      <DashboardOverview
        info={{ ...baseInfo, pkarr_icann_domain: 'localhost:6286' }}
        isLoading={false}
        error={null}
        onFixCloudflare={onFix}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('domain-health-not-set-up')).toBeTruthy());
    expect(healthCalls()).toHaveLength(0);
    expect(screen.getByTestId('domain-health-fix').textContent).toBe('Set up');
    expect(screen.queryByText(/localhost:6286/)).toBeNull();
    // no re-check button without a probeable hostname
    expect(screen.queryByTestId('domain-health-recheck')).toBeNull();
  });

  it('missing domain: row still renders as "Not set up" + Set up button', async () => {
    mockBackend();
    render(
      <DashboardOverview
        info={{ ...baseInfo, pkarr_icann_domain: undefined }}
        isLoading={false}
        error={null}
        onFixCloudflare={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('domain-health-not-set-up')).toBeTruthy());
    expect(screen.getByText('Public address:')).toBeTruthy();
    expect(screen.getByTestId('domain-health-fix').textContent).toBe('Set up');
    expect(healthCalls()).toHaveLength(0);
  });

  it('re-check button probes again', async () => {
    mockBackend({ healthOk: true });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('domain-health-reachable')).toBeTruthy());
    fireEvent.click(screen.getByTestId('domain-health-recheck'));
    await waitFor(() => expect(healthCalls()).toHaveLength(2));
  });

  it('probe network failure degrades to Not reachable', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('domain-health-unreachable')).toBeTruthy());
  });

  it('restart_pending true: shows the Umbrel restart callout even while reachable', async () => {
    mockBackend({ healthOk: true, restartPending: true });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} onFixCloudflare={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('restart-callout')).toBeTruthy());
    expect(screen.getByTestId('restart-callout').textContent).toContain('Restart the Pubky Homeserver app from Umbrel');
    // Reachability is separate truth and must not suppress the callout.
    await waitFor(() => expect(screen.getByTestId('domain-health-reachable')).toBeTruthy());
  });

  it.each([
    ['false', false],
    ['null (unknown)', null],
  ])('restart_pending %s: no restart callout', async (_label, restartPending) => {
    mockBackend({ healthOk: true, restartPending });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('domain-health-reachable')).toBeTruthy());
    expect(screen.queryByTestId('restart-callout')).toBeNull();
  });

  it('re-reads cloudflare-config when cloudflareRefreshKey changes (dialog closed)', async () => {
    // Start with nothing pending; flip the backend to pending and bump the key,
    // as the parent does when the Settings dialog closes after a setup.
    let pending = false;
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const json = url.startsWith('/api/cloudflare-config')
        ? { restart_pending: pending, mode: pending ? 'connect' : 'off' }
        : { ok: true, status: 200 };
      return new Response(JSON.stringify(json), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const { rerender } = render(
      <DashboardOverview info={baseInfo} isLoading={false} error={null} cloudflareRefreshKey={0} />,
    );
    await waitFor(() => expect(screen.getByTestId('domain-health-reachable')).toBeTruthy());
    expect(screen.queryByTestId('restart-callout')).toBeNull();

    pending = true;
    rerender(<DashboardOverview info={baseInfo} isLoading={false} error={null} cloudflareRefreshKey={1} />);
    await waitFor(() => expect(screen.getByTestId('restart-callout')).toBeTruthy());
  });

  it('a domain change does not inherit the previous hostname cached reachable verdict', async () => {
    // First mount: old domain is reachable; this seeds the module cache.
    mockBackend({ healthOk: true });
    const { unmount } = render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('domain-health-reachable')).toBeTruthy());
    unmount();

    // New domain, and now the probe says unreachable. The cache holds the OLD
    // hostname's "reachable", which must NOT be shown for the new hostname.
    mockBackend({ healthOk: false });
    render(
      <DashboardOverview
        info={{ ...baseInfo, pkarr_icann_domain: 'different.example.com:443' }}
        isLoading={false}
        error={null}
      />,
    );
    // It must re-probe (show checking, then unreachable), never flash reachable.
    expect(screen.queryByTestId('domain-health-reachable')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('domain-health-unreachable')).toBeTruthy());
  });
});

describe('DashboardOverview server identity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetOverviewStateCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never invents a pubkey or version: missing fields read "Not available"', async () => {
    mockBackend();
    render(
      <DashboardOverview
        info={{ ...baseInfo, public_key: undefined, pubkey: undefined, version: undefined }}
        isLoading={false}
        error={null}
      />,
    );
    expect(screen.getAllByText('Not available')).toHaveLength(2);
    expect(screen.getAllByText(/Not reported by this homeserver/)).toHaveLength(2);
    expect(screen.queryByText(/x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o/)).toBeNull();
    expect(screen.queryByText(/0\.1\.0-dev/)).toBeNull();
    expect(screen.queryByText('Soon')).toBeNull();
  });

  it('renders plain labels with the technical terms as tooltips', async () => {
    mockBackend();
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    expect(screen.queryByText(/PKARR/)).toBeNull();
    const address = screen.getByText('Pubky address:');
    expect(address.getAttribute('title')).toBe('PKARR address');
    expect(screen.getByText('How Pubky apps find this server')).toBeTruthy();
    const domain = screen.getByText('Public address:');
    expect(domain.getAttribute('title')).toBe('PKARR ICANN domain');
    expect(screen.queryByTestId('stale-info-label')).toBeNull();
  });

  it('pubkey, address and domain rows offer copy buttons', async () => {
    mockBackend();
    const writeText = mockClipboard();
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);

    fireEvent.click(screen.getByLabelText('Copy pubkey'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(baseInfo.public_key));
    fireEvent.click(screen.getByLabelText('Copy address'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(baseInfo.pkarr_pubky_address));
    fireEvent.click(screen.getByLabelText('Copy public address'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(baseInfo.pkarr_icann_domain));
  });
});

describe('DashboardOverview address scope badge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetOverviewStateCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderWithAddress = (pkarr_pubky_address: string | undefined) => {
    mockBackend();
    render(<DashboardOverview info={{ ...baseInfo, pkarr_pubky_address }} isLoading={false} error={null} />);
  };

  it('private address (Docker/LAN) gets the amber "Private network" badge with an explanation', () => {
    renderWithAddress('10.21.0.23:6287');
    const badge = screen.getByTestId('address-scope-badge');
    expect(badge.textContent).toBe('Private network');
    expect(badge.getAttribute('data-scope')).toBe('private');
    expect(badge.getAttribute('title')).toBe(
      'This is a private network address (LAN or Docker). Devices on the internet cannot reach your server through it. Set up a public address so Pubky apps can find you.',
    );
  });

  it('loopback address gets the "Localhost only" badge even while public access is not set up', () => {
    mockBackend();
    render(
      <DashboardOverview
        info={{ ...baseInfo, pkarr_pubky_address: '127.0.0.1:6286', pkarr_icann_domain: 'localhost:6286' }}
        isLoading={false}
        error={null}
      />,
    );
    const badge = screen.getByTestId('address-scope-badge');
    expect(badge.textContent).toBe('Localhost only');
    expect(badge.getAttribute('data-scope')).toBe('loopback');
    expect(badge.getAttribute('title')).toBe(
      'Only this machine can reach this address. Other devices and Pubky apps cannot connect through it.',
    );
    // the badge annotates the visible Pubky address; the hidden localhost
    // domain on the Public address row stays hidden
    expect(screen.getByText('127.0.0.1:6286')).toBeTruthy();
    expect(screen.queryByText(/localhost:6286/)).toBeNull();
  });

  it('public IP gets the neutral "Public IP" badge with the no-verification caveat', () => {
    renderWithAddress('203.0.113.7:6287');
    const badge = screen.getByTestId('address-scope-badge');
    expect(badge.textContent).toBe('Public IP');
    expect(badge.getAttribute('data-scope')).toBe('public');
    expect(badge.getAttribute('title')).toBe(
      'This looks like a publicly routable IP address. Reachability from outside your network cannot be verified from here.',
    );
  });

  it.each([
    ['pubky.example.com:6287', 'hostname'],
    ['pubky://x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o', 'pubky URI'],
  ])('no badge for %s (%s)', (address) => {
    renderWithAddress(address);
    expect(screen.queryByTestId('address-scope-badge')).toBeNull();
  });

  it('no address, no badge (the row is not rendered at all)', () => {
    renderWithAddress(undefined);
    expect(screen.queryByText('Pubky address:')).toBeNull();
    expect(screen.queryByTestId('address-scope-badge')).toBeNull();
  });
});

describe('DashboardOverview preview-mode badge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetOverviewStateCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a *.trycloudflare.com public address shows the Preview mode badge with its caveat tooltip', async () => {
    mockBackend({ healthOk: true });
    render(
      <DashboardOverview
        info={{ ...baseInfo, pkarr_icann_domain: 'chelsea-mpg-evaluating-restore.trycloudflare.com:443' }}
        isLoading={false}
        error={null}
      />,
    );
    const badge = await screen.findByTestId('preview-mode-badge');
    expect(badge.textContent).toBe('Preview mode');
    expect(badge.getAttribute('title')).toContain('temporary Cloudflare Quick Tunnel');
    expect(badge.getAttribute('title')).toContain('/events');
    expect(badge.getAttribute('title')).toContain('indexers');
    expect(badge.getAttribute('title')).toContain('permanent Cloudflare domain');
  });

  it('the dashboard mode "preview" alone shows the badge even for a non-trycloudflare address', async () => {
    mockBackend({ healthOk: true, mode: 'preview' });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('preview-mode-badge')).toBeTruthy());
  });

  it('a real permanent domain shows no Preview badge', async () => {
    mockBackend({ healthOk: true, mode: 'token' });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('domain-health-reachable')).toBeTruthy());
    expect(screen.queryByTestId('preview-mode-badge')).toBeNull();
  });
});

describe('DashboardOverview get-started checklist', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetOverviewStateCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const wiring = {
    onGoToInvites: () => {},
    setupGuideDismissed: false,
    onDismissSetupGuide: () => {},
  };
  const freshInstall = { ...baseInfo, num_users: 0, num_signup_codes: 0 };

  it('reachable step is done only when the mode is active AND the probe answers ok', async () => {
    mockBackend({ healthOk: true, mode: 'token' });
    render(<DashboardOverview info={freshInstall} isLoading={false} error={null} {...wiring} />);
    await waitFor(() => expect(screen.getByTestId('setup-step-reachable').getAttribute('data-state')).toBe('done'));
    expect(screen.getByTestId('setup-step-invite').getAttribute('data-state')).toBe('pending');
    expect(screen.getByTestId('setup-step-signup').getAttribute('data-state')).toBe('pending');
  });

  it('mode off keeps the reachable step pending even when the probe answers ok', async () => {
    mockBackend({ healthOk: true, mode: 'off' });
    render(<DashboardOverview info={freshInstall} isLoading={false} error={null} {...wiring} />);
    await waitFor(() => expect(screen.getByTestId('domain-health-reachable')).toBeTruthy());
    expect(screen.getByTestId('setup-step-reachable').getAttribute('data-state')).toBe('pending');
  });

  it('an active mode with an unreachable domain keeps the reachable step pending', async () => {
    mockBackend({ healthOk: false, mode: 'connect' });
    render(<DashboardOverview info={freshInstall} isLoading={false} error={null} {...wiring} />);
    await waitFor(() => expect(screen.getByTestId('domain-health-unreachable')).toBeTruthy());
    expect(screen.getByTestId('setup-step-reachable').getAttribute('data-state')).toBe('pending');
  });

  it('while the checks are still loading, the reachable step shows "checking", not a premature Set up CTA', async () => {
    // freshInstall has a real (probeable) domain, so a probe runs. On the
    // first render the cloudflare-config fetch and the probe are both in
    // flight: the step must be a spinner, not "Set up access".
    mockBackend({ healthOk: true, mode: 'token' });
    render(<DashboardOverview info={freshInstall} isLoading={false} error={null} {...wiring} />);
    // Synchronous first render (effects have run, but the fetches have not
    // resolved): checking, with no instruction and no CTA.
    expect(screen.getByTestId('setup-step-reachable').getAttribute('data-state')).toBe('checking');
    expect(screen.queryByTestId('setup-step-reachable-cta')).toBeNull();
    expect(screen.queryByText(/Connect a domain through Cloudflare/)).toBeNull();
    // It resolves to done once the mode and probe land - never flashing the CTA.
    await waitFor(() => expect(screen.getByTestId('setup-step-reachable').getAttribute('data-state')).toBe('done'));
  });

  it('localhost (no domain): after the config loads, the reachable step is a real "todo" with the Set up CTA', async () => {
    mockBackend({ healthOk: true, mode: 'off' });
    render(
      <DashboardOverview
        info={{ ...freshInstall, pkarr_icann_domain: 'localhost:6286' }}
        isLoading={false}
        error={null}
        {...wiring}
        onFixCloudflare={() => {}}
      />,
    );
    // No probe runs for localhost, so the step settles to todo once the
    // cloudflare-config fetch confirms mode 'off'.
    await waitFor(() => expect(screen.getByTestId('setup-step-reachable-cta')).toBeTruthy());
    expect(screen.getByTestId('setup-step-reachable').getAttribute('data-state')).toBe('pending');
  });

  it('/info signals drive the invite and signup steps', async () => {
    mockBackend({ healthOk: false, mode: 'off' });
    render(
      <DashboardOverview
        info={{ ...baseInfo, num_signup_codes: 2, num_users: 1 }}
        isLoading={false}
        error={null}
        {...wiring}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('setup-step-invite').getAttribute('data-state')).toBe('done'));
    expect(screen.getByTestId('setup-step-signup').getAttribute('data-state')).toBe('done');
    expect(screen.getByTestId('setup-step-reachable').getAttribute('data-state')).toBe('pending');
  });

  it('all three done: collapses to the slim all-set state', async () => {
    mockBackend({ healthOk: true, mode: 'connect' });
    render(
      <DashboardOverview
        info={{ ...baseInfo, num_signup_codes: 2, num_users: 1 }}
        isLoading={false}
        error={null}
        {...wiring}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('setup-guide-allset')).toBeTruthy());
    expect(screen.queryByTestId('setup-guide')).toBeNull();
  });

  it('CTAs reuse the existing affordances: Set up access opens Cloudflare, Open Invites switches tabs', async () => {
    mockBackend({ healthOk: false, mode: 'off' });
    const onFixCloudflare = vi.fn();
    const onGoToInvites = vi.fn();
    render(
      <DashboardOverview
        info={freshInstall}
        isLoading={false}
        error={null}
        {...wiring}
        onFixCloudflare={onFixCloudflare}
        onGoToInvites={onGoToInvites}
      />,
    );
    // The reachable CTA appears only after the checks settle (probe says
    // unreachable, mode is off) - it is not shown during the checking window.
    await waitFor(() => expect(screen.getByTestId('setup-step-reachable-cta')).toBeTruthy());
    fireEvent.click(screen.getByTestId('setup-step-reachable-cta'));
    expect(onFixCloudflare).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('setup-step-invite-cta'));
    expect(onGoToInvites).toHaveBeenCalledTimes(1);
  });

  it('dismissed (or dismissal not yet read) renders no checklist', async () => {
    mockBackend();
    const { rerender } = render(
      <DashboardOverview info={freshInstall} isLoading={false} error={null} {...wiring} setupGuideDismissed={true} />,
    );
    expect(screen.queryByTestId('setup-guide')).toBeNull();
    rerender(
      <DashboardOverview info={freshInstall} isLoading={false} error={null} {...wiring} setupGuideDismissed={null} />,
    );
    expect(screen.queryByTestId('setup-guide')).toBeNull();
  });
});

describe('DashboardOverview pkarr verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetOverviewStateCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('auto-checks once with pubkey + both expectations and shows Published', async () => {
    mockBackend({ pkarr: 'verified' });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('pkarr-health-verified')).toBeTruthy());
    expect(pkarrCalls()).toHaveLength(1);
    const url = String(pkarrCalls()[0][0]);
    expect(url).toContain(`pubkey=${baseInfo.public_key}`);
    expect(url).toContain(`expected_address=${encodeURIComponent('1.2.3.4:6287')}`);
    expect(url).toContain(`expected_domain=${encodeURIComponent('pubky.example.com:443')}`);
  });

  it('localhost domain: still verifies, but expects no domain', async () => {
    mockBackend({ pkarr: 'verified' });
    render(
      <DashboardOverview info={{ ...baseInfo, pkarr_icann_domain: 'localhost:6286' }} isLoading={false} error={null} />,
    );
    await waitFor(() => expect(pkarrCalls()).toHaveLength(1));
    expect(String(pkarrCalls()[0][0])).not.toContain('expected_domain');
  });

  it('a legacy pubky:// address is an identifier, not an expectation: omitted from the check', async () => {
    mockBackend({ pkarr: 'verified' });
    render(
      <DashboardOverview
        info={{ ...baseInfo, pkarr_pubky_address: `pubky://${baseInfo.public_key}` }}
        isLoading={false}
        error={null}
      />,
    );
    await waitFor(() => expect(pkarrCalls()).toHaveLength(1));
    expect(String(pkarrCalls()[0][0])).not.toContain('expected_address');
  });

  it('no pubkey: no row, no check', async () => {
    mockBackend();
    render(
      <DashboardOverview
        info={{ ...baseInfo, public_key: undefined, pubkey: undefined }}
        isLoading={false}
        error={null}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('domain-health-reachable')).toBeTruthy());
    expect(screen.queryByText('Pubky network:')).toBeNull();
    expect(pkarrCalls()).toHaveLength(0);
  });

  it('mismatch: amber chip, restartless hint absent, View shows the comparison', async () => {
    mockBackend({ pkarr: 'mismatch' });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('pkarr-health-mismatch')).toBeTruthy());
    expect(screen.queryByTestId('pkarr-health-restart-hint')).toBeNull();
    fireEvent.click(screen.getByTestId('pkarr-view-record'));
    await waitFor(() => expect(screen.getByTestId('pkarr-record-viewer')).toBeTruthy());
    const mismatchBox = screen.getByTestId('pkarr-viewer-mismatch');
    expect(mismatchBox.textContent).toContain('pubky.example.com:443'); // expected
    expect(mismatchBox.textContent).toContain('old.example.org'); // published
  });

  it('mismatch while a restart is pending explains the record updates on restart', async () => {
    mockBackend({ pkarr: 'mismatch', restartPending: true });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('pkarr-health-restart-hint')).toBeTruthy());
    expect(screen.getByTestId('pkarr-health-restart-hint').textContent).toContain('restarts');
  });

  it('not_found: "Not published" and no View button (nothing to view)', async () => {
    mockBackend({ pkarr: 'not_found' });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('pkarr-health-not-found')).toBeTruthy());
    expect(screen.queryByTestId('pkarr-view-record')).toBeNull();
  });

  it('unavailable: muted "Can\'t verify" copy that does not blame the server', async () => {
    mockBackend({ pkarr: 'unavailable' });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('pkarr-health-unavailable')).toBeTruthy());
    expect(screen.getByTestId('pkarr-health-unavailable').getAttribute('title')).toContain(
      'does not mean anything is wrong',
    );
  });

  it('a route error degrades to unavailable, never a crash', async () => {
    mockBackend({ pkarr: 'http-error' });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('pkarr-health-unavailable')).toBeTruthy());
  });

  it('a malformed payload (no records array) degrades to unavailable', async () => {
    mockBackend({ pkarr: 'verified', pkarrOverrides: { records: undefined } });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('pkarr-health-unavailable')).toBeTruthy());
  });

  it('an out-of-allowlist or missing verdict degrades to unavailable', async () => {
    mockBackend({ pkarr: 'verified', pkarrOverrides: { verdict: 'bogus' } });
    const { unmount } = render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('pkarr-health-unavailable')).toBeTruthy());
    unmount();
    __resetOverviewStateCache();
    mockBackend({ pkarr: 'verified', pkarrOverrides: { verdict: undefined } });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('pkarr-health-unavailable')).toBeTruthy());
  });

  it('re-check button verifies again', async () => {
    mockBackend({ pkarr: 'verified' });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('pkarr-health-verified')).toBeTruthy());
    fireEvent.click(screen.getByTestId('pkarr-health-recheck'));
    await waitFor(() => expect(pkarrCalls()).toHaveLength(2));
  });

  it('viewer renders the records table, the age line, and the pkdns link', async () => {
    mockBackend({ pkarr: 'verified' });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('pkarr-view-record')).toBeTruthy());
    fireEvent.click(screen.getByTestId('pkarr-view-record'));
    await waitFor(() => expect(screen.getByTestId('pkarr-record-viewer')).toBeTruthy());
    const records = screen.getByTestId('pkarr-viewer-records');
    expect(records.textContent).toContain('HTTPS');
    expect(records.textContent).toContain('port=6287');
    expect(records.textContent).toContain('3600');
    expect(screen.getByTestId('pkarr-viewer-age').textContent).toContain('1 minute ago');
    expect(screen.queryByTestId('pkarr-viewer-mismatch')).toBeNull();
    expect(screen.getByTestId('pkarr-viewer-pkdns-link').getAttribute('href')).toBe(
      `https://pkdns.net/?id=${baseInfo.public_key}`,
    );
  });

  it('a tab return reuses the cached verdict without flashing Checking…', async () => {
    mockBackend({ pkarr: 'verified' });
    const { unmount } = render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('pkarr-health-verified')).toBeTruthy());
    unmount();

    mockBackend({ pkarr: 'verified' });
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    // Cached verdict shows immediately; the silent revalidation never
    // surfaces a "Checking…" state.
    expect(screen.getByTestId('pkarr-health-verified')).toBeTruthy();
    expect(screen.queryByTestId('pkarr-health-checking')).toBeNull();
    // The spy is shared across both mounts (spyOn returns the existing spy):
    // one check per mount = 2 cumulative, proving the remount revalidated.
    await waitFor(() => expect(pkarrCalls()).toHaveLength(2));
  });

  it('a pubkey change does not inherit the previous cached verdict', async () => {
    mockBackend({ pkarr: 'verified' });
    const { unmount } = render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('pkarr-health-verified')).toBeTruthy());
    unmount();

    mockBackend({ pkarr: 'not_found' });
    render(
      <DashboardOverview
        info={{ ...baseInfo, public_key: 'o4dksfbqk85ogzdb5osziw6befigbuxmuxkuxq8434q89uj56uyy' }}
        isLoading={false}
        error={null}
      />,
    );
    expect(screen.queryByTestId('pkarr-health-verified')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('pkarr-health-not-found')).toBeTruthy());
  });

  it('an in-place pubkey change (live refetch, no remount) never shows the old record', async () => {
    // First verdict for pubkey A, with an open viewer.
    mockBackend({ pkarr: 'verified' });
    const { rerender } = render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('pkarr-view-record')).toBeTruthy());
    fireEvent.click(screen.getByTestId('pkarr-view-record'));
    await waitFor(() => expect(screen.getByTestId('pkarr-record-viewer')).toBeTruthy());
    expect(screen.getByTestId('pkarr-viewer-pkdns-link').getAttribute('href')).toContain(baseInfo.public_key);

    // A live refetch swaps the pubkey WHILE mounted (the bug case: useState
    // seeds don't re-run, so the old result/verdict linger in state).
    const newKey = 'o4dksfbqk85ogzdb5osziw6befigbuxmuxkuxq8434q89uj56uyy';
    mockBackend({ pkarr: 'not_found' });
    rerender(<DashboardOverview info={{ ...baseInfo, public_key: newKey }} isLoading={false} error={null} />);
    // Immediately after the prop change: must NOT still show pubkey A's
    // verdict, View button, or open viewer (which carried A's pkdns link).
    expect(screen.queryByTestId('pkarr-health-verified')).toBeNull();
    expect(screen.queryByTestId('pkarr-view-record')).toBeNull();
    expect(screen.queryByTestId('pkarr-record-viewer')).toBeNull();
    // Then it resolves to the new pubkey's verdict.
    await waitFor(() => expect(screen.getByTestId('pkarr-health-not-found')).toBeTruthy());
  });
});

describe('DashboardOverview standalone (no Umbrel)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetOverviewStateCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const wiring = { onGoToInvites: () => {}, setupGuideDismissed: false, onDismissSetupGuide: () => {} };
  const freshInstall = { ...baseInfo, num_users: 0, num_signup_codes: 0 };

  it('hides the Cloudflare "Set up"/"Fix it" CTA and the get-started reachable step, keeps the status rows', async () => {
    mockBackend({ healthOk: false, mode: 'off' });
    render(
      <PlatformProvider platform="standalone">
        <DashboardOverview info={freshInstall} isLoading={false} error={null} onFixCloudflare={() => {}} {...wiring} />
      </PlatformProvider>,
    );
    // Status rows still present (a standalone operator may run their own proxy).
    await waitFor(() => expect(screen.getByTestId('domain-health-unreachable')).toBeTruthy());
    // No Cloudflare-setup CTA, no reachable get-started step.
    expect(screen.queryByTestId('domain-health-fix')).toBeNull();
    expect(screen.queryByTestId('setup-step-reachable')).toBeNull();
    // The other get-started steps remain.
    expect(screen.getByTestId('setup-step-invite')).toBeTruthy();
    expect(screen.getByTestId('setup-step-signup')).toBeTruthy();
  });

  it('keeps the pkarr "Pubky network" row standalone', async () => {
    mockBackend({ healthOk: true, pkarr: 'verified' });
    render(
      <PlatformProvider platform="standalone">
        <DashboardOverview info={baseInfo} isLoading={false} error={null} />
      </PlatformProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('pkarr-health-verified')).toBeTruthy());
  });
});

describe('DashboardOverview backup note', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetOverviewStateCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tells the operator where the data lives and not to exclude the app from umbrelOS backups', async () => {
    mockBackend();
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    const note = screen.getByTestId('backup-note');
    expect(note.textContent).toContain("this app's data directory");
    expect(note.textContent).toContain('include app data automatically');
    expect(note.textContent).toContain("don't exclude this app");
    expect(note.textContent).toContain("losing this server's identity");
  });

  it('standalone: generic backup note, no umbrelOS wording', async () => {
    mockBackend();
    render(
      <PlatformProvider platform="standalone">
        <DashboardOverview info={baseInfo} isLoading={false} error={null} />
      </PlatformProvider>,
    );
    const note = screen.getByTestId('backup-note');
    expect(note.textContent).toContain("this app's data directory");
    expect(note.textContent).toContain('Back it up regularly');
    expect(note.textContent?.toLowerCase()).not.toContain('umbrel');
  });
});

describe('DashboardOverview connection error', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetOverviewStateCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('leads with operator guidance and collapses the developer details', async () => {
    mockBackend();
    const onRetry = vi.fn();
    render(
      <DashboardOverview info={null} isLoading={false} error={new Error('Request failed: 500')} onRetry={onRetry} />,
    );

    expect(screen.getByText(/Your homeserver may still be starting/)).toBeTruthy();
    expect(screen.getByText(/this page retries automatically/)).toBeTruthy();
    expect(screen.getByText(/Restart the Pubky Homeserver app from Umbrel/)).toBeTruthy();

    const details = screen.getByTestId('connection-dev-details');
    expect(details.hasAttribute('open')).toBe(false);
    expect(details.textContent).toContain('Developer details');
    expect(details.textContent).toContain('Request failed: 500');
    expect(details.textContent).toContain('ADMIN_BASE_URL');
    expect(details.textContent).toContain('ADMIN_TOKEN');

    fireEvent.click(screen.getByTestId('connection-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('labels stale details "Last known state" while errored', async () => {
    mockBackend();
    render(<DashboardOverview info={baseInfo} isLoading={false} error={new Error('Request failed: 502')} />);

    expect(screen.getByText('Not Connected')).toBeTruthy();
    expect(screen.getByTestId('stale-info-label').textContent).toBe('Last known state');
    // the stale values are still shown, just labeled as such
    expect(screen.getByText(baseInfo.public_key as string)).toBeTruthy();
    expect(screen.getByTestId('connection-error')).toBeTruthy();
  });
});
