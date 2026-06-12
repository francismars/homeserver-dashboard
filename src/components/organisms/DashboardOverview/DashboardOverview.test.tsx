import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardOverview } from './DashboardOverview';
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

/** Routes the component's two fetches: the public-health probe and the
 * restart-pending read from /api/cloudflare-config. */
function mockBackend({ healthOk = true, restartPending = null as boolean | null } = {}) {
  vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const json = url.startsWith('/api/cloudflare-config')
      ? { restart_pending: restartPending }
      : { ok: healthOk, status: healthOk ? 200 : 530 };
    return new Response(JSON.stringify(json), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}

function healthCalls() {
  return (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
    String(c[0]).startsWith('/api/public-health'),
  );
}

describe('DashboardOverview domain health', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
    fireEvent.click(screen.getByTestId('domain-health-fix'));
    expect(onFix).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('domain-health-fix').textContent).toBe('Fix it');
  });

  it('localhost domain: no probe, "Not set up" + Set up button', async () => {
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
    // no re-check button without a probeable hostname
    expect(screen.queryByTestId('domain-health-recheck')).toBeNull();
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
    expect(screen.getByTestId('restart-callout').textContent).toContain('Restart the app from Umbrel');
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
});
