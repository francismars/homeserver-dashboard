import type { WebDavService } from '../webdav';

export type User = {
  pubkey: string;
  displayName: string; // Shortened pubkey for display
  storageUsedMB?: number;
  fileCount?: number;
  lastActivity?: string;
  isDisabled?: boolean;
  signupDate?: string;
};

export type UserListResponse = {
  users: User[];
  total: number;
};

export type UserServiceDeps = {
  webdavService: WebDavService;
};
