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

function mockHealth(ok: boolean) {
  vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ ok, status: ok ? 200 : 530 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
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
    mockHealth(true);
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} onFixCloudflare={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('domain-health-reachable')).toBeTruthy());
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/public-health?domain=pubky.example.com', // port stripped
      expect.anything(),
    );
    expect(screen.queryByTestId('domain-health-fix')).toBeNull();
  });

  it('shows Not reachable + Fix it on failure; Fix it opens the Cloudflare tab', async () => {
    mockHealth(false);
    const onFix = vi.fn();
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} onFixCloudflare={onFix} />);
    await waitFor(() => expect(screen.getByTestId('domain-health-unreachable')).toBeTruthy());
    fireEvent.click(screen.getByTestId('domain-health-fix'));
    expect(onFix).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('domain-health-fix').textContent).toBe('Fix it');
  });

  it('localhost domain: no probe, "Not set up" + Set up button', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
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
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('domain-health-fix').textContent).toBe('Set up');
    // no re-check button without a probeable hostname
    expect(screen.queryByTestId('domain-health-recheck')).toBeNull();
  });

  it('re-check button probes again', async () => {
    mockHealth(true);
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('domain-health-reachable')).toBeTruthy());
    fireEvent.click(screen.getByTestId('domain-health-recheck'));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  it('probe network failure degrades to Not reachable', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    render(<DashboardOverview info={baseInfo} isLoading={false} error={null} />);
    await waitFor(() => expect(screen.getByTestId('domain-health-unreachable')).toBeTruthy());
  });
});
