import {
  AdminConfig,
  AdminInfo,
  AdminServiceDeps,
  DeleteUrlRequest,
  DisableUserRequest,
  GenerateInviteResponse,
  UsageResponse,
} from './admin.types';

export class AdminService {
  private baseUrl: string;
  private token?: string;

  constructor({ baseUrl, token }: AdminServiceDeps) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.baseUrl) {
      throw new Error('Admin API not configured. Set NEXT_PUBLIC_ADMIN_BASE_URL.');
    }

    try {
      const headers = new Headers(init?.headers);
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
      if (this.token) {
        headers.set('X-Admin-Password', this.token);
      }

      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
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
    const headers = new Headers();
    if (this.token) {
      headers.set('X-Admin-Password', this.token);
    }

    const token = await fetch(`${this.baseUrl}/generate_signup_token`, { headers }).then((res) => {
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
    // Placeholder until backend provides config endpoint
    throw new Error('Config endpoint not available yet');
  }

  async saveConfig(_payload: AdminConfig): Promise<AdminConfig> {
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
}
