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

export type SignupRequest = {
  signupToken?: string; // Optional, required if signup_mode is token_required
  authToken: Uint8Array; // Binary AuthToken
};

export type SignupResponse = {
  pubkey: string;
  sessionSecret?: string;
};

export type CreateUserRequest = {
  signupToken?: string; // Optional invite code
  homeserverPubkey?: string; // Homeserver public key (z-base-32) - Optional, only needed for mainnet
};

export type CreateUserResponse = {
  pubkey: string;
  secretKeyHex: string;
  secretKey: Uint8Array;
  recoveryFile?: Uint8Array; // Optional recovery file if passphrase provided
};

export type UserServiceDeps = {
  adminBaseUrl: string;
  clientBaseUrl: string;
  adminToken?: string;
  webdavService: any; // WebDavService instance
};

