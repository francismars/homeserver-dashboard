import {
  AdminConfig,
  AdminInfo,
  AdminServiceDeps,
  DeleteUrlRequest,
  DisableUserRequest,
  GenerateInviteResponse,
  UsageResponse,
} from './admin.types';

const defaultHeaders = (token?: string) =>
  token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};

export class AdminService {
  private baseUrl: string;
  private token?: string;
  private mock: boolean;

  constructor({ baseUrl, token, mock = false }: AdminServiceDeps) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.mock = mock;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (this.mock || !this.baseUrl) {
      return this.mockResponse<T>(path);
    }

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...defaultHeaders(this.token),
          ...(init?.headers || {}),
        },
      });

      if (!res.ok) {
        const contentType = res.headers.get('content-type');
        let message = `Request failed: ${res.status}`;
        
        if (contentType?.includes('application/json')) {
          try {
            const json = await res.json();
            message = json.message || json.error || message;
          } catch {
            // Fall through to text parsing
          }
        } else {
          const text = await res.text();
          // Don't show HTML error pages, just status
          if (!text.includes('<!DOCTYPE') && !text.includes('<html')) {
            message = text || message;
          }
        }
        
        throw new Error(message);
      }

      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error: Failed to connect to homeserver');
    }
  }

  async getInfo(): Promise<AdminInfo> {
    return this.request<AdminInfo>('/info');
  }

  async generateInvite(): Promise<GenerateInviteResponse> {
    // Backend returns plain string, not JSON
    if (this.mock) {
      return { token: 'MOCK-INVITE-TOKEN-' + Date.now() };
    }
    const token = await fetch(`${this.baseUrl}/generate_signup_token`, {
      headers: {
        ...defaultHeaders(this.token),
      },
    }).then((res) => {
      if (!res.ok) throw new Error(`Failed to generate invite: ${res.status}`);
      return res.text();
    });
    return { token };
  }

  async getUsage(): Promise<UsageResponse> {
    // No dedicated endpoint yet; reuse /info if available
    const info = await this.getInfo();
    return {
      usersTotal: info.num_users,
      numUnusedSignupCodes: info.num_unused_signup_codes,
      totalDiskUsedMB: info.total_disk_used_mb,
    };
  }

  async getConfig(): Promise<AdminConfig> {
    if (this.mock) {
      return this.mockConfig();
    }
    // Placeholder until backend provides config endpoint
    throw new Error('Config endpoint not available yet');
  }

  async saveConfig(payload: AdminConfig): Promise<AdminConfig> {
    if (this.mock) {
      return { ...payload, checksum: 'mock-checksum', updatedAt: new Date().toISOString() };
    }
    // Placeholder until backend provides config endpoint
    throw new Error('Config endpoint not available yet');
  }

  async disableUser(payload: DisableUserRequest): Promise<void> {
    await this.request(`/users/${payload.pubkey}/disable`, { method: 'POST' });
  }

  async enableUser(payload: DisableUserRequest): Promise<void> {
    await this.request(`/users/${payload.pubkey}/enable`, { method: 'POST' });
  }

  async deleteUrl(payload: DeleteUrlRequest): Promise<void> {
    await this.request(`/webdav/${payload.path}`, { method: 'DELETE' });
  }

  private mockResponse<T>(path: string): T {
    if (path === '/info') {
      return {
        num_users: 42,
        num_disabled_users: 2,
        total_disk_used_mb: 512,
        num_signup_codes: 10,
        num_unused_signup_codes: 5,
        pubkey: 'pk:mock1234567890abcdef',
        address: '127.0.0.1:8080',
        version: '0.0.0-mock',
      } as T;
    }
    if (path === '/generate_signup_token') {
      return 'MOCK-INVITE-TOKEN-' + Date.now() as T;
    }
    return undefined as T;
  }

  private mockConfig(): AdminConfig {
    return {
      configToml: '# Mock Config\n[server]\nport = 8080\n',
      checksum: 'mock-checksum',
      updatedAt: new Date().toISOString(),
    };
  }
}

