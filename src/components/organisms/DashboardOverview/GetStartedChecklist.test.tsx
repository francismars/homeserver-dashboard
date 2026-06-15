import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetStartedChecklist, useSetupGuideDismissal } from './GetStartedChecklist';

const baseProps = {
  reachableStatus: 'todo' as const,
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

  it('reachable done marks only its own step done', () => {
    render(<GetStartedChecklist {...baseProps} reachableStatus="done" />);
    expect(screen.getByTestId('setup-step-reachable').getAttribute('data-state')).toBe('done');
    expect(screen.getByTestId('setup-step-invite').getAttribute('data-state')).toBe('pending');
    expect(screen.getByTestId('setup-step-signup').getAttribute('data-state')).toBe('pending');
  });

  it.each([
    ['inviteDone', 'setup-step-invite'],
    ['signupDone', 'setup-step-signup'],
  ] as const)('%s marks only its own step done', (prop, testId) => {
    render(<GetStartedChecklist {...baseProps} {...{ [prop]: true }} />);
    for (const id of ['setup-step-invite', 'setup-step-signup']) {
      expect(screen.getByTestId(id).getAttribute('data-state')).toBe(id === testId ? 'done' : 'pending');
    }
    expect(screen.getByTestId('setup-step-reachable').getAttribute('data-state')).toBe('pending');
  });

  it('reachable "checking": spinner state, helper-copy replaced, and NO "Set up access" CTA', () => {
    render(<GetStartedChecklist {...baseProps} reachableStatus="checking" onSetUpAccess={() => {}} />);
    expect(screen.getByTestId('setup-step-reachable').getAttribute('data-state')).toBe('checking');
    expect(screen.getByText(/Checking whether your homeserver is reachable/)).toBeTruthy();
    // The instruction and the CTA must not appear while we are still checking.
    expect(screen.queryByTestId('setup-step-reachable-cta')).toBeNull();
    expect(screen.queryByText(/Connect a domain through Cloudflare/)).toBeNull();
  });

  it('reachable "todo": shows the instruction and the CTA', () => {
    render(<GetStartedChecklist {...baseProps} reachableStatus="todo" onSetUpAccess={() => {}} />);
    expect(screen.getByTestId('setup-step-reachable').getAttribute('data-state')).toBe('pending');
    expect(screen.getByText(/Connect a domain through Cloudflare/)).toBeTruthy();
    expect(screen.getByTestId('setup-step-reachable-cta')).toBeTruthy();
  });

  it('pending invite step explains the first invite is for your own account', () => {
    render(<GetStartedChecklist {...baseProps} />);
    expect(screen.getByText(/Your first invite is for your own account/)).toBeTruthy();
  });

  it('signup step links to pubkyring.app for Pubky Ring', () => {
    render(<GetStartedChecklist {...baseProps} />);
    const link = screen.getByRole('link', { name: 'pubkyring.app' });
    expect(link.getAttribute('href')).toBe('https://pubkyring.app/');
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
    render(<GetStartedChecklist reachableStatus="done" inviteDone signupDone onDismiss={onDismiss} />);
    expect(screen.queryByTestId('setup-guide')).toBeNull();
    expect(screen.getByTestId('setup-guide-allset')).toBeTruthy();
    expect(screen.getByText(/All set/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('setup-guide-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('all-set: the chevron expands to the three verified (done) steps and collapses again', () => {
    render(<GetStartedChecklist reachableStatus="done" inviteDone signupDone onDismiss={() => {}} />);
    const toggle = screen.getByTestId('setup-guide-allset-toggle');
    // Collapsed by default: steps hidden, label invites showing them.
    expect(screen.queryByTestId('setup-guide-allset-steps')).toBeNull();
    expect(toggle.getAttribute('aria-label')).toBe('Show completed steps');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    const steps = screen.getByTestId('setup-guide-allset-steps');
    expect(steps).toBeTruthy();
    // All three render as done.
    for (const id of ['setup-step-reachable', 'setup-step-invite', 'setup-step-signup']) {
      expect(screen.getByTestId(id).getAttribute('data-state')).toBe('done');
    }
    expect(toggle.getAttribute('aria-label')).toBe('Hide completed steps');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(toggle);
    expect(screen.queryByTestId('setup-guide-allset-steps')).toBeNull();
  });

  it('reachable "checking" does not collapse to all-set even when invite and signup are done', () => {
    render(<GetStartedChecklist {...baseProps} reachableStatus="checking" inviteDone signupDone />);
    expect(screen.queryByTestId('setup-guide-allset')).toBeNull();
    expect(screen.getByTestId('setup-guide')).toBeTruthy();
  });

  it('showReachableStep=false (standalone): the reachable step is gone; checklist is invite + signup', () => {
    render(
      <GetStartedChecklist {...baseProps} showReachableStep={false} reachableStatus="todo" onSetUpAccess={() => {}} />,
    );
    expect(screen.queryByTestId('setup-step-reachable')).toBeNull();
    expect(screen.queryByTestId('setup-step-reachable-cta')).toBeNull();
    expect(screen.getByTestId('setup-step-invite')).toBeTruthy();
    expect(screen.getByTestId('setup-step-signup')).toBeTruthy();
    expect(screen.getByText(/Two steps/)).toBeTruthy();
  });

  it('showReachableStep=false: all-set once invite + signup are done, ignoring reachable status', () => {
    render(
      <GetStartedChecklist {...baseProps} showReachableStep={false} reachableStatus="todo" inviteDone signupDone />,
    );
    expect(screen.getByTestId('setup-guide-allset')).toBeTruthy();
    // Expanding the all-set list shows only invite + signup, no reachable.
    fireEvent.click(screen.getByTestId('setup-guide-allset-toggle'));
    expect(screen.queryByTestId('setup-step-reachable')).toBeNull();
    expect(screen.getByTestId('setup-step-invite')).toBeTruthy();
    expect(screen.getByTestId('setup-step-signup')).toBeTruthy();
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
