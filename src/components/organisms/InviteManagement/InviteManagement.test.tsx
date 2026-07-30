import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InviteManagement } from './InviteManagement';

const noop = vi.fn().mockResolvedValue(undefined);

const HOMESERVER = 'x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o';
const INVITE = 'AAAA-BBBB';
const EXPECTED_URL = `pubkyauth://direct_signup?hs=${HOMESERVER}&st=${INVITE}`;

describe('InviteManagement generation failure', () => {
  it('renders an inline destructive alert with the error and a retry hint', () => {
    render(<InviteManagement invites={[]} onGenerate={noop} generateError="Request failed (502)" />);
    const alert = screen.getByTestId('invite-generate-error');
    expect(alert.textContent).toContain('Could not create an invite');
    expect(alert.textContent).toContain('Request failed (502)');
    expect(alert.textContent).toContain('try again');
    expect(alert.textContent).toContain('no code was created');
  });

  it('no alert without an error', () => {
    render(<InviteManagement invites={[]} onGenerate={noop} generateError={null} />);
    expect(screen.queryByTestId('invite-generate-error')).toBeNull();
  });
});

describe('InviteManagement session-only list', () => {
  it('the list is titled "Created this session" with the cannot-re-display note', () => {
    render(<InviteManagement invites={['AAAA-BBBB']} onGenerate={noop} />);
    expect(screen.getByText('Created this session')).toBeTruthy();
    expect(screen.queryByText('Invite codes')).toBeNull();
    expect(screen.getByText(/Codes stay valid after a reload, but they cannot be displayed again/)).toBeTruthy();
  });

  it('empty state says no invites this session, even when the stats show existing codes', () => {
    render(<InviteManagement invites={[]} onGenerate={noop} signupCodesTotal={5} signupCodesUnused={2} />);
    // 5 codes exist on the server; the session list must not claim "none yet".
    expect(screen.getByText('No invites created in this session yet.')).toBeTruthy();
    expect(screen.queryByText('No invite codes yet')).toBeNull();
  });

  it('empty state offers the Pubky Ring assist with the pubkyring.app link', () => {
    render(<InviteManagement invites={[]} onGenerate={noop} />);
    expect(screen.getByText(/Don't have Pubky Ring yet\?/)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'pubkyring.app' });
    expect(link.getAttribute('href')).toBe('https://pubkyring.app/');
  });
});

describe('InviteManagement QR panel', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  // Pubky Ring reads the intent, not just the params: `signup` is the relayed
  // cookie flow, so an invite must go out as `direct_signup`.
  it('encodes the invite as a direct_signup deeplink, shown and copied verbatim', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<InviteManagement invites={[INVITE]} onGenerate={noop} homeserverPubkey={HOMESERVER} />);
    fireEvent.click(screen.getByLabelText('Show invite QR code'));

    expect(screen.getByText(EXPECTED_URL)).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Copy invite URL 1'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(EXPECTED_URL));
  });

  const watchProps = (total: number, unused: number, onRefreshStats: () => void) => ({
    invites: [INVITE],
    onGenerate: noop,
    homeserverPubkey: HOMESERVER,
    signupCodesTotal: total,
    signupCodesUnused: unused,
    onRefreshStats,
  });

  it('polls the stats only while a QR is open, and stops once a signup lands', async () => {
    vi.useFakeTimers();
    try {
      const onRefreshStats = vi.fn();
      const view = render(<InviteManagement {...watchProps(1, 1, onRefreshStats)} />);

      await vi.advanceTimersByTimeAsync(7000);
      expect(onRefreshStats).not.toHaveBeenCalled();

      fireEvent.click(screen.getByLabelText('Show invite QR code'));
      await vi.advanceTimersByTimeAsync(7000);
      expect(onRefreshStats).toHaveBeenCalled();

      // A signup is the used count going up (total 1 - unused 0).
      const callsBeforeSignup = onRefreshStats.mock.calls.length;
      view.rerender(<InviteManagement {...watchProps(1, 0, onRefreshStats)} />);

      expect(screen.getByTestId('invite-signup-seen-0')).toBeTruthy();
      expect(screen.getByText('Someone just joined')).toBeTruthy();
      // The code cannot be attributed, so its QR and link stay usable.
      expect(screen.getByText(EXPECTED_URL)).toBeTruthy();

      await vi.advanceTimersByTimeAsync(7000);
      expect(onRefreshStats.mock.calls.length).toBe(callsBeforeSignup);
    } finally {
      vi.useRealTimers();
    }
  });

  it('detects a signup even when an invite is created in the same interval', () => {
    const onRefreshStats = vi.fn();
    const view = render(<InviteManagement {...watchProps(1, 1, onRefreshStats)} />);
    fireEvent.click(screen.getByLabelText('Show invite QR code'));

    // One code redeemed and one created between polls: unused is unchanged, so
    // only the used count reveals the signup.
    view.rerender(<InviteManagement {...watchProps(2, 1, onRefreshStats)} />);
    expect(screen.getByTestId('invite-signup-seen-0')).toBeTruthy();
  });

  it('ignores a signup while no QR is open, and opening one afterwards shows no banner', () => {
    const onRefreshStats = vi.fn();
    const view = render(<InviteManagement {...watchProps(1, 1, onRefreshStats)} />);
    view.rerender(<InviteManagement {...watchProps(1, 0, onRefreshStats)} />);

    fireEvent.click(screen.getByLabelText('Show invite QR code'));
    expect(screen.queryByTestId('invite-signup-seen-0')).toBeNull();
    expect(screen.getByText(EXPECTED_URL)).toBeTruthy();
  });

  it('stops polling an unattended QR after the watch window', async () => {
    vi.useFakeTimers();
    try {
      const onRefreshStats = vi.fn();
      render(<InviteManagement {...watchProps(1, 1, onRefreshStats)} />);
      fireEvent.click(screen.getByLabelText('Show invite QR code'));

      await vi.advanceTimersByTimeAsync(60_000);
      const callsInFirstMinute = onRefreshStats.mock.calls.length;
      expect(callsInFirstMinute).toBeGreaterThan(10);

      await vi.advanceTimersByTimeAsync(10 * 60_000);
      const callsAfterWindow = onRefreshStats.mock.calls.length;
      expect(callsAfterWindow).toBeLessThan(callsInFirstMinute * 6);

      const settled = onRefreshStats.mock.calls.length;
      await vi.advanceTimersByTimeAsync(30_000);
      expect(onRefreshStats.mock.calls.length).toBe(settled);
    } finally {
      vi.useRealTimers();
    }
  });

  it('explains the pubkyauth link needs Pubky Ring and links to pubkyring.app', () => {
    render(<InviteManagement invites={[INVITE]} onGenerate={noop} homeserverPubkey={HOMESERVER} />);
    fireEvent.click(screen.getByLabelText('Show invite QR code'));
    expect(screen.getByText(/only opens on a device with Pubky Ring installed/)).toBeTruthy();
    expect(screen.getByText(/Don't have Pubky Ring yet\?/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'pubkyring.app' }).getAttribute('href')).toBe('https://pubkyring.app/');
  });
});
