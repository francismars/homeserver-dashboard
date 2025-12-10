export type AdminInfoResponse = {
  num_users: number;
  num_disabled_users: number;
  total_disk_used_mb: number;
  num_signup_codes: number;
  num_unused_signup_codes: number;
  pubkey?: string;
  address?: string;
  version?: string;
};

export type AdminInfo = AdminInfoResponse; // Alias for backward compatibility

export type DeleteUrlRequest = { path: string };
export type DisableUserRequest = { pubkey: string };
export type GenerateInviteResponse = { token: string };
export type AdminUsageResponse = {
  usersTotal: number;
  numUnusedSignupCodes: number;
  totalDiskUsedMB: number;
  usersByInvite?: Record<string, number>;
  storageByUser?: Array<{ user: string; usedBytes: number }>;
};

export type UsageResponse = AdminUsageResponse; // Alias for backward compatibility

export type AdminConfigResponse = {
  configToml: string;
  checksum: string;
  updatedAt?: string;
};

export type AdminConfig = AdminConfigResponse; // Alias for backward compatibility

export type AdminServiceDeps = {
  baseUrl: string;
  token?: string;
  mock?: boolean;
};

