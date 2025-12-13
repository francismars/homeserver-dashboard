import type { User, UserListResponse, SignupRequest, SignupResponse, CreateUserRequest, CreateUserResponse, UserServiceDeps } from './user.types';
import type { WebDavService } from '../webdav';
import { generateKeypair, signupUser } from './keyGenerator';
import { createRecoveryFile } from '@synonymdev/pubky';

/**
 * User service for managing users and signups.
 */
export class UserService {
  private adminBaseUrl: string;
  private clientBaseUrl: string;
  private adminToken?: string;
  private webdavService: WebDavService;

  constructor({ adminBaseUrl, clientBaseUrl, adminToken, webdavService }: UserServiceDeps) {
    this.adminBaseUrl = adminBaseUrl.replace(/\/$/, '');
    this.clientBaseUrl = clientBaseUrl.replace(/\/$/, '');
    this.adminToken = adminToken;
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

  /**
   * Create a new user by generating a keypair and signing them up.
   * This is the preferred method for creating users from the dashboard.
   */
  async createUser(request: CreateUserRequest, recoveryPassphrase?: string): Promise<CreateUserResponse> {
    try {
      console.log('[UserService.createUser] Starting user creation...');
      console.log('[UserService.createUser] Request:', {
        hasHomeserverPubkey: !!request.homeserverPubkey,
        hasSignupToken: !!request.signupToken,
        clientBaseUrl: this.clientBaseUrl,
        adminBaseUrl: this.adminBaseUrl,
      });

      // Generate a new keypair
      console.log('[UserService.createUser] Generating keypair...');
      const generated = generateKeypair();
      console.log('[UserService.createUser] Keypair generated:', {
        pubkey: generated.publicKey,
        secretKeyLength: generated.secretKey.length,
      });

      // Sign up the user to the homeserver
      // For local/testnet, we can call the client API directly without needing the homeserver pubkey
      // The SDK's testnet client automatically rewrites URLs to localhost
      console.log('[UserService.createUser] Signing up user...');
      await signupUser(
        generated.keypair, 
        request.homeserverPubkey || null, // Optional for local/testnet
        request.signupToken,
        this.clientBaseUrl // Pass client base URL for direct signup
      );
      console.log('[UserService.createUser] User signed up successfully!');

      // Optionally create a recovery file
      let recoveryFile: Uint8Array | undefined;
      if (recoveryPassphrase) {
        console.log('[UserService.createUser] Creating recovery file...');
        recoveryFile = createRecoveryFile(generated.keypair, recoveryPassphrase);
        console.log('[UserService.createUser] Recovery file created, size:', recoveryFile.length);
      }

      console.log('[UserService.createUser] User creation complete!');
      return {
        pubkey: generated.publicKey,
        secretKeyHex: generated.secretKeyHex,
        secretKey: generated.secretKey,
        recoveryFile,
      };
    } catch (error) {
      console.error('[UserService.createUser] User creation failed:', error);
      
      // Log full error details
      if (error instanceof Error) {
        console.error('[UserService.createUser] Error name:', error.name);
        console.error('[UserService.createUser] Error message:', error.message);
        console.error('[UserService.createUser] Error stack:', error.stack);
        
        if ('cause' in error) {
          console.error('[UserService.createUser] Error cause:', error.cause);
        }
      } else {
        console.error('[UserService.createUser] Unknown error type:', typeof error, error);
      }
      
      throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sign up a new user (legacy method using raw AuthToken).
   * Requires an AuthToken (binary) and optionally a signup_token.
   */
  async signup(request: SignupRequest): Promise<SignupResponse> {
    const url = new URL(`${this.clientBaseUrl}/signup`);
    
    // Add signup_token as query param if provided
    if (request.signupToken) {
      url.searchParams.set('signup_token', request.signupToken);
    }

    // Convert Uint8Array to ArrayBuffer for fetch
    const body = request.authToken.buffer.slice(
      request.authToken.byteOffset,
      request.authToken.byteOffset + request.authToken.byteLength
    );

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Signup failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Response is binary session data, but we need to extract pubkey
    // The pubkey might be in response headers or we need to parse it
    // For now, we'll return a placeholder - the actual pubkey extraction
    // depends on the response format
    const sessionData = await response.arrayBuffer();
    
    // TODO: Parse session data to extract pubkey
    // This might require understanding the session format
    
    return {
      pubkey: '', // Will be populated once we understand the response format
      sessionSecret: undefined,
    };
  }

  /**
   * Get user details including storage and activity.
   */
  async getUserDetails(pubkey: string): Promise<User> {
    try {
      // Get storage info
      const userPubDir = await this.webdavService.listDirectory(`/${pubkey}/pub/`, 1);
      const totalBytes = userPubDir.files
        .filter(f => !f.isCollection)
        .reduce((sum, f) => sum + (f.contentLength || 0), 0);
      const storageUsedMB = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;
      const fileCount = userPubDir.files.filter(f => !f.isCollection).length;

      return {
        pubkey,
        displayName: `${pubkey.substring(0, 8)}...${pubkey.substring(pubkey.length - 4)}`,
        storageUsedMB,
        fileCount,
      };
    } catch (error) {
      throw new Error(`Failed to get user details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

