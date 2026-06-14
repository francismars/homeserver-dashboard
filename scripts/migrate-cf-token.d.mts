export interface MigrateResult {
  migrated: boolean;
  reason?: string;
  tunnelId?: string;
}
export interface MigrateOpts {
  runtimeDir?: string;
  ingressService?: string;
}
export interface DecodedCredentials {
  AccountTag: string;
  TunnelSecret: string;
  TunnelID: string;
  Endpoint?: string;
}
export function tokenToCredentials(token: string): DecodedCredentials;
export function buildConfigYml(hostname: string, tunnelId: string, runtimeDir: string, ingressService: string): string;
export function migrate(dir: string, opts?: MigrateOpts): Promise<MigrateResult>;
