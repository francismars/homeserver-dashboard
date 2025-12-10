'use client';

import { ActionPanel } from '@/components/molecules/ActionPanel';
import type { DashboardActionsProps } from './DashboardActions.types';

export function DashboardActions({
  onDeleteUrl,
  onDisableUser,
  isDeletingUrl,
  isDisablingUser,
  deleteUrlError,
  disableUserError,
}: DashboardActionsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ActionPanel
        title="Delete URL"
        description="Remove a specific URL from the homeserver by WebDAV path"
        actionLabel="Delete"
        confirmLabel="Delete URL"
        confirmMessage="Are you sure you want to delete this URL? This action cannot be undone."
        placeholder="Enter WebDAV path (e.g., /user/pubkey/file.txt)"
        inputType="text"
        isLoading={isDeletingUrl}
        error={deleteUrlError}
        onAction={onDeleteUrl}
        destructive={true}
      />
      <ActionPanel
        title="Disable User"
        description="Temporarily disable a user account by pubkey"
        actionLabel="Disable"
        confirmLabel="Disable User"
        confirmMessage="Are you sure you want to disable this user? They will not be able to access the homeserver."
        placeholder="Enter user pubkey"
        inputType="text"
        isLoading={isDisablingUser}
        error={disableUserError}
        onAction={onDisableUser}
        destructive={true}
      />
    </div>
  );
}

