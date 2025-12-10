export type DashboardActionsProps = {
  onDeleteUrl: (path: string) => Promise<void>;
  onDisableUser: (pubkey: string) => Promise<void>;
  isDeletingUrl?: boolean;
  isDisablingUser?: boolean;
  deleteUrlError?: Error | null;
  disableUserError?: Error | null;
};

