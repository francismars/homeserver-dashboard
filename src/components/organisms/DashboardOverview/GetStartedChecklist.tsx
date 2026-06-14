'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Circle, CircleCheckBig, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A checklist step is done, still being determined (async signal in flight),
 * or outstanding. 'checking' suppresses the call-to-action so the user is not
 * told to fix something we have not finished evaluating. */
export type StepStatus = 'done' | 'checking' | 'todo';

const STORAGE_KEY = 'setup-guide-dismissed';

/**
 * Dismissal state for the get-started checklist, persisted in localStorage.
 * `dismissed` is null until the stored value has been read (the page is
 * server-rendered first, where localStorage does not exist), so consumers can
 * avoid flashing the card at a user who already dismissed it.
 */
export function useSetupGuideDismissal() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // private mode etc.: the card just comes back next visit
    }
  }, []);

  const restore = useCallback(() => {
    setDismissed(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { dismissed, dismiss, restore };
}

export type GetStartedChecklistProps = {
  /** Reachability of the public domain: 'done' (mode active AND the domain
   * answered the probe), 'checking' (the Cloudflare mode or the probe is
   * still loading - do not yet tell the user to set anything up), or 'todo'. */
  reachableStatus: StepStatus;
  /** At least one signup code exists. */
  inviteDone: boolean;
  /** At least one user account exists. */
  signupDone: boolean;
  /** Opens the Settings dialog on the Cloudflare tab. */
  onSetUpAccess?: () => void;
  /** Switches the dashboard to the Invites tab. */
  onCreateInvite?: () => void;
  onDismiss: () => void;
};

function StepRow({
  status,
  testId,
  title,
  children,
  action,
  checkingLabel = 'Checking…',
}: {
  status: StepStatus;
  testId: string;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  /** Subtext shown in place of `children` while the step is being evaluated. */
  checkingLabel?: string;
}) {
  const done = status === 'done';
  const checking = status === 'checking';
  return (
    <li
      className="flex items-start gap-3"
      data-testid={testId}
      data-state={status === 'done' ? 'done' : status === 'checking' ? 'checking' : 'pending'}
    >
      {done ? (
        <CircleCheckBig className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
      ) : checking ? (
        <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground/60" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', done ? 'text-muted-foreground' : 'text-foreground')}>{title}</p>
        {checking ? (
          <div className="mt-0.5 text-xs text-muted-foreground">{checkingLabel}</div>
        ) : (
          !done && children && <div className="mt-0.5 text-xs text-muted-foreground">{children}</div>
        )}
      </div>
      {/* No call-to-action while checking: do not prompt a fix we have not
          finished evaluating. */}
      {status === 'todo' && action && <div className="shrink-0">{action}</div>}
    </li>
  );
}

function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 shrink-0 px-1.5"
      onClick={onDismiss}
      aria-label="Dismiss setup guide"
      data-testid="setup-guide-dismiss"
    >
      <X className="h-4 w-4" />
    </Button>
  );
}

/**
 * The narrative a fresh install is missing: reachable, then an invite, then
 * an account from the phone. Driven entirely by signals the dashboard already
 * has; collapses to a slim "all set" line once every step is done.
 */
export function GetStartedChecklist({
  reachableStatus,
  inviteDone,
  signupDone,
  onSetUpAccess,
  onCreateInvite,
  onDismiss,
}: GetStartedChecklistProps) {
  const allDone = reachableStatus === 'done' && inviteDone && signupDone;
  // Collapsed by default; the chevron re-reveals the (now all-done) steps so
  // the operator can review what was verified. Ephemeral - no need to persist.
  const [allSetExpanded, setAllSetExpanded] = useState(false);

  if (allDone) {
    return (
      <Card data-testid="setup-guide-allset">
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <CircleCheckBig className="h-4 w-4 shrink-0 text-brand" />
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              All set: your homeserver is reachable, invites work, and your first account is in.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-1.5"
              onClick={() => setAllSetExpanded((e) => !e)}
              aria-label={allSetExpanded ? 'Hide completed steps' : 'Show completed steps'}
              aria-expanded={allSetExpanded}
              data-testid="setup-guide-allset-toggle"
            >
              {allSetExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <DismissButton onDismiss={onDismiss} />
          </div>
          {allSetExpanded && (
            <ul className="mt-3 space-y-3 border-t border-border/60 pt-3" data-testid="setup-guide-allset-steps">
              <StepRow status="done" testId="setup-step-reachable" title="Make your homeserver reachable" />
              <StepRow status="done" testId="setup-step-invite" title="Create your first invite" />
              <StepRow status="done" testId="setup-step-signup" title="Sign up from Pubky Ring" />
            </ul>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="setup-guide">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base sm:text-lg">Get started</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Three steps from a fresh install to your own account
            </CardDescription>
          </div>
          <DismissButton onDismiss={onDismiss} />
        </div>
      </CardHeader>
      <div className="mx-6 h-px bg-border/60" />
      <CardContent className="pt-4">
        <ul className="space-y-4">
          <StepRow
            status={reachableStatus}
            testId="setup-step-reachable"
            title="Make your homeserver reachable"
            checkingLabel="Checking whether your homeserver is reachable…"
            action={
              onSetUpAccess && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={onSetUpAccess}
                  data-testid="setup-step-reachable-cta"
                >
                  Set up access
                </Button>
              )
            }
          >
            Connect a domain through Cloudflare so Pubky apps and web browsers can reach this server from anywhere, even
            behind your router (no port forwarding needed).
          </StepRow>
          <StepRow
            status={inviteDone ? 'done' : 'todo'}
            testId="setup-step-invite"
            title="Create your first invite"
            action={
              onCreateInvite && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={onCreateInvite}
                  data-testid="setup-step-invite-cta"
                >
                  Open Invites
                </Button>
              )
            }
          >
            Your first invite is for your own account.
          </StepRow>
          <StepRow status={signupDone ? 'done' : 'todo'} testId="setup-step-signup" title="Sign up from Pubky Ring">
            Install Pubky Ring on your phone (get it at{' '}
            <a
              href="https://pubky.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline-offset-2 hover:underline"
            >
              pubky.org
            </a>
            ), then scan the invite QR code to create your account on this homeserver.
          </StepRow>
        </ul>
      </CardContent>
    </Card>
  );
}
