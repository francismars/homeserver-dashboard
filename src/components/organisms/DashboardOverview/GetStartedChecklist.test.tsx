import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetStartedChecklist, useSetupGuideDismissal } from './GetStartedChecklist';

const baseProps = {
  reachableDone: false,
  inviteDone: false,
  signupDone: false,
  onDismiss: () => {},
};

describe('GetStartedChecklist steps', () => {
  it('all pending: three steps render unchecked with their titles', () => {
    render(<GetStartedChecklist {...baseProps} />);
    expect(screen.getByTestId('setup-guide')).toBeTruthy();
    expect(screen.getByTestId('setup-step-reachable').getAttribute('data-state')).toBe('pending');
    expect(screen.getByTestId('setup-step-invite').getAttribute('data-state')).toBe('pending');
    expect(screen.getByTestId('setup-step-signup').getAttribute('data-state')).toBe('pending');
    expect(screen.getByText('Make your homeserver reachable')).toBeTruthy();
    expect(screen.getByText('Create your first invite')).toBeTruthy();
    expect(screen.getByText('Sign up from Pubky Ring')).toBeTruthy();
  });

  it.each([
    ['reachableDone', 'setup-step-reachable'],
    ['inviteDone', 'setup-step-invite'],
    ['signupDone', 'setup-step-signup'],
  ] as const)('%s marks only its own step done', (prop, testId) => {
    render(<GetStartedChecklist {...baseProps} {...{ [prop]: true }} />);
    for (const id of ['setup-step-reachable', 'setup-step-invite', 'setup-step-signup']) {
      expect(screen.getByTestId(id).getAttribute('data-state')).toBe(id === testId ? 'done' : 'pending');
    }
  });

  it('pending invite step explains the first invite is for your own account', () => {
    render(<GetStartedChecklist {...baseProps} />);
    expect(screen.getByText(/Your first invite is for your own account/)).toBeTruthy();
  });

  it('signup step links to pubky.org for Pubky Ring', () => {
    render(<GetStartedChecklist {...baseProps} />);
    const link = screen.getByRole('link', { name: 'pubky.org' });
    expect(link.getAttribute('href')).toBe('https://pubky.org');
  });

  it('a done step hides its CTA and helper copy', () => {
    render(<GetStartedChecklist {...baseProps} inviteDone onSetUpAccess={() => {}} onCreateInvite={() => {}} />);
    expect(screen.queryByTestId('setup-step-invite-cta')).toBeNull();
    expect(screen.queryByText(/Your first invite is for your own account/)).toBeNull();
    expect(screen.getByTestId('setup-step-reachable-cta')).toBeTruthy();
  });

  it('CTAs call their callbacks', () => {
    const onSetUpAccess = vi.fn();
    const onCreateInvite = vi.fn();
    render(<GetStartedChecklist {...baseProps} onSetUpAccess={onSetUpAccess} onCreateInvite={onCreateInvite} />);
    fireEvent.click(screen.getByTestId('setup-step-reachable-cta'));
    expect(onSetUpAccess).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('setup-step-invite-cta'));
    expect(onCreateInvite).toHaveBeenCalledTimes(1);
  });

  it('all steps done: collapses to the slim all-set state, still dismissible', () => {
    const onDismiss = vi.fn();
    render(<GetStartedChecklist reachableDone inviteDone signupDone onDismiss={onDismiss} />);
    expect(screen.queryByTestId('setup-guide')).toBeNull();
    expect(screen.getByTestId('setup-guide-allset')).toBeTruthy();
    expect(screen.getByText(/All set/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('setup-guide-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

/** Mirrors the page wiring: the checklist while not dismissed, the footer
 * "Setup guide" link once dismissed. */
function Harness() {
  const { dismissed, dismiss, restore } = useSetupGuideDismissal();
  if (dismissed === null) return null;
  return dismissed ? (
    <button onClick={restore} data-testid="setup-guide-link">
      Setup guide
    </button>
  ) : (
    <GetStartedChecklist {...baseProps} onDismiss={dismiss} />
  );
}

describe('GetStartedChecklist dismissal persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('dismiss persists to localStorage and swaps the card for the reappear link', async () => {
    render(<Harness />);
    fireEvent.click(await screen.findByTestId('setup-guide-dismiss'));
    expect(screen.queryByTestId('setup-guide')).toBeNull();
    expect(screen.getByTestId('setup-guide-link')).toBeTruthy();
    expect(localStorage.getItem('setup-guide-dismissed')).toBe('1');
  });

  it('a fresh mount stays dismissed (reload survives)', async () => {
    localStorage.setItem('setup-guide-dismissed', '1');
    render(<Harness />);
    expect(await screen.findByTestId('setup-guide-link')).toBeTruthy();
    expect(screen.queryByTestId('setup-guide')).toBeNull();
  });

  it('the reappear link restores the card and clears the stored flag', async () => {
    localStorage.setItem('setup-guide-dismissed', '1');
    render(<Harness />);
    fireEvent.click(await screen.findByTestId('setup-guide-link'));
    expect(await screen.findByTestId('setup-guide')).toBeTruthy();
    expect(localStorage.getItem('setup-guide-dismissed')).toBeNull();
  });
});
