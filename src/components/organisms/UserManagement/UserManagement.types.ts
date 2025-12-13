export type UserManagementProps = {
  onViewUserFiles?: (pubkey: string) => void;
  onDisableUser?: (pubkey: string) => void;
  isDisablingUser?: boolean;
  onOpenInvites?: () => void;
  onOpenStats?: () => void;
};

