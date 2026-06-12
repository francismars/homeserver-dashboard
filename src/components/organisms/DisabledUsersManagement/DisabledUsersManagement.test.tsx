import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DisabledUsersManagement } from './DisabledUsersManagement';

const PUBKEY = 'x8mmbr5hgsitzp7cigkfewmpqx8j5c9ot4kxe1sfniaeqgys9q6o';

function renderCard(overrides: Partial<React.ComponentProps<typeof DisabledUsersManagement>> = {}) {
  return render(
    <DisabledUsersManagement
      onDisableUser={vi.fn().mockResolvedValue(undefined)}
      onEnableUser={vi.fn().mockResolvedValue(undefined)}
      disabledUsers={[]}
      {...overrides}
    />,
  );
}

async function openDialog() {
  fireEvent.click(screen.getByLabelText('Disable or enable user'));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
  return within(screen.getByRole('dialog'));
}

describe('DisabledUsersManagement copy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('describes what the tab actually does', () => {
    renderCard();
    expect(screen.getByText('Disable or re-enable accounts on this homeserver.')).toBeTruthy();
    expect(screen.queryByText('Manage invites and user access')).toBeNull();
  });

  it('explains the listing, with the user count when available', () => {
    renderCard({ numUsersTotal: 5 });
    expect(screen.getByTestId('disabled-users-explainer').textContent).toBe(
      'Your homeserver has 5 users. Only disabled accounts are listed here.',
    );
  });

  it('omits the count when the total is unknown', () => {
    renderCard();
    expect(screen.getByTestId('disabled-users-explainer').textContent).toBe('Only disabled accounts are listed here.');
  });

  it('dialog uses pubkey wording and states the disable consequence up front', async () => {
    renderCard();
    const d = await openDialog();
    expect(d.getByText("Enter a user's public key (pubkey) to disable or enable their account.")).toBeTruthy();
    expect(d.getByText('User pubkey')).toBeTruthy();
    expect(d.getByTestId('disable-consequence').textContent).toContain(
      'the account can no longer log in or write data; stored files are kept',
    );
    expect(d.queryByText(/pubky to disable/)).toBeNull();
  });
});

describe('DisabledUsersManagement action feedback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a successful disable closes the dialog and confirms what happened', async () => {
    const onDisableUser = vi.fn().mockResolvedValue(undefined);
    renderCard({ onDisableUser });
    const d = await openDialog();
    fireEvent.change(d.getByLabelText('User pubkey input'), { target: { value: PUBKEY } });
    fireEvent.click(d.getByRole('button', { name: 'Disable' }));

    await waitFor(() => expect(screen.getByTestId('user-action-success')).toBeTruthy());
    expect(onDisableUser).toHaveBeenCalledWith(PUBKEY);
    expect(screen.queryByRole('dialog')).toBeNull();
    const feedback = screen.getByTestId('user-action-success').textContent ?? '';
    expect(feedback).toContain('disabled');
    expect(feedback).toContain('can no longer log in or write data; stored files are kept');
  });

  it('a successful enable from the dialog confirms too', async () => {
    const onEnableUser = vi.fn().mockResolvedValue(undefined);
    renderCard({ onEnableUser });
    const d = await openDialog();
    fireEvent.change(d.getByLabelText('User pubkey input'), { target: { value: PUBKEY } });
    fireEvent.click(d.getByRole('button', { name: 'Enable' }));

    await waitFor(() => expect(screen.getByTestId('user-action-success')).toBeTruthy());
    expect(onEnableUser).toHaveBeenCalledWith(PUBKEY);
    expect(screen.getByTestId('user-action-success').textContent).toContain('enabled');
  });

  it('a failed disable keeps the dialog open with the error and no success confirmation', async () => {
    const onDisableUser = vi.fn().mockRejectedValue(new Error('User not found'));
    renderCard({ onDisableUser });
    const d = await openDialog();
    fireEvent.change(d.getByLabelText('User pubkey input'), { target: { value: PUBKEY } });
    fireEvent.click(d.getByRole('button', { name: 'Disable' }));

    await waitFor(() => expect(d.getByText('User not found')).toBeTruthy());
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByTestId('user-action-success')).toBeNull();
  });
});
