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
    // Use API route instead of direct homeserver URL
    // Token is handled server-side, not sent from client
    this.baseUrl = '/api/admin';
    this.token = ''; // Not needed, handled by API route
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    // Always use API route - no need to check baseUrl
    try {
      const headers = new Headers(init?.headers);
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
      // Don't set X-Admin-Password - API route handles it server-side

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
    // Use API route which handles token server-side
    const res = await fetch(`${this.baseUrl}/generate_signup_token`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: `Failed to generate invite: ${res.status}` }));
      throw new Error(error.error || `Failed to generate invite: ${res.status}`);
    }
    const data = await res.json();
    return { token: data.token };
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
