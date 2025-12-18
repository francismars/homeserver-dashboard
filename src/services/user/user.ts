import type { User, UserListResponse, UserServiceDeps } from './user.types';
import type { WebDavService } from '../webdav';

/**
 * User service for managing users and signups.
 */
export class UserService {
  private webdavService: WebDavService;

  constructor({ webdavService }: UserServiceDeps) {
    this.webdavService = webdavService;
  }

  /**
   * List all users by scanning WebDAV root directory.
   * Each user has a directory at /dav/{pubkey}/
   * Only lists the root directory to get pubkeys - no additional calls for storage/file counts.
   */
  async listUsers(): Promise<UserListResponse> {
    try {
      // List root directory to get all user directories (single DAV call)
      const rootDir = await this.webdavService.listDirectory('/', 1);
      
      const users: User[] = [];
      
      for (const item of rootDir.files) {
        if (item.isCollection) {
          // Extract pubkey from path (e.g., "/abc123..." -> "abc123...")
          let pubkey = item.path.replace(/^\//, '').replace(/\/$/, '');
          
          // Skip if it's not a valid pubkey format (z-base-32, typically 52 chars)
          // But allow shorter paths in case of nested structures or different formats
          if (pubkey.length < 20 || pubkey.length > 60) {
            continue;
          }

          // Only store the pubkey - storage, file count, and status are mock data
          users.push({
            pubkey,
            displayName: `${pubkey.substring(0, 8)}...${pubkey.substring(pubkey.length - 4)}`,
          });
        }
      }

      return {
        users: users.sort((a, b) => (a.pubkey || '').localeCompare(b.pubkey || '')),
        total: users.length,
      };
    } catch (error) {
      throw new Error(`Failed to list users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

