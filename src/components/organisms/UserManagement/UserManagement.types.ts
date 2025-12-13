export type UserManagementProps = {
  onViewUserFiles?: (pubkey: string) => void;
  onDisableUser?: (pubkey: string) => void;
  onEnableUser?: (pubkey: string) => void;
  isDisablingUser?: boolean;
  onOpenInvites?: () => void;
  onOpenStats?: () => void;
  onOpenDisabledUsers?: (users: { all: any[]; disabled: any[] }) => void;
  numDisabledUsers?: number; // Real count from API
};

