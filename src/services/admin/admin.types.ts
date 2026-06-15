export type AdminInfoResponse = {
  num_users: number;
  num_disabled_users: number;
  total_disk_used_mb: number;
  num_signup_codes: number;
  num_unused_signup_codes: number;
  public_key?: string;
  pkarr_pubky_address?: string;
  pkarr_icann_domain?: string;
  version?: string;
  // Legacy field for backward compatibility
  pubkey?: string;
};

export type DeleteUrlRequest = { path: string };
export type DisableUserRequest = { pubkey: string };
export type DisabledUser = { pubkey: string };
export type DisabledUsersResponse = {
  items: DisabledUser[];
  next_cursor: string | null;
};
export type GenerateInviteResponse = { token: string };
