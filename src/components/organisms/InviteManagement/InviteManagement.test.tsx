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

  it('explains the pubkyauth link needs Pubky Ring and links to pubkyring.app', () => {
    render(<InviteManagement invites={[INVITE]} onGenerate={noop} homeserverPubkey={HOMESERVER} />);
    fireEvent.click(screen.getByLabelText('Show invite QR code'));
    expect(screen.getByText(/only opens on a device with Pubky Ring installed/)).toBeTruthy();
    expect(screen.getByText(/Don't have Pubky Ring yet\?/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'pubkyring.app' }).getAttribute('href')).toBe('https://pubkyring.app/');
  });
});
