import type { WebDavFile, WebDavDirectory, WebDavServiceDeps, WebDavError } from './webdav.types';

/**
 * WebDAV service for interacting with the homeserver's WebDAV endpoint.
 * Handles PROPFIND (list), GET (read), PUT (write), DELETE, MKCOL (create directory).
 */
export class WebDavService {
  private baseUrl: string;
  private username: string;
  private password: string;

  constructor({ baseUrl, username, password }: WebDavServiceDeps) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.username = username;
    this.password = password;
  }

  private getAuthHeader(): string {
    const credentials = btoa(`${this.username}:${this.password}`);
    return `Basic ${credentials}`;
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: this.getAuthHeader(),
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      const error: WebDavError = {
        message: `Request failed: ${response.status} ${response.statusText}`,
        status: response.status,
      };
      throw error;
    }

    return response;
  }

  /**
   * List directory contents using PROPFIND.
   * @param path WebDAV path (e.g., "/dav/" or "/dav/{pubkey}/pub/")
   * @param depth Depth of listing (0 = self, 1 = self + children, infinity = recursive)
   */
  async listDirectory(path: string, depth: 0 | 1 | 'infinity' = 1): Promise<WebDavDirectory> {
    const normalizedPath = path.endsWith('/') ? path : `${path}/`;

    const response = await this.request(normalizedPath, {
      method: 'PROPFIND',
      headers: {
        Depth: depth.toString(),
        'Content-Type': 'application/xml',
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname/>
    <d:getcontenttype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`,
    });

    const xmlText = await response.text();
    const files = this.parsePropfindResponse(xmlText, normalizedPath);

    return {
      path: normalizedPath,
      files,
    };
  }

  /**
   * Read a file's contents.
   * @param path WebDAV path to the file
   */
  async readFile(path: string): Promise<string> {
    const response = await this.request(path, {
      method: 'GET',
    });
    return await response.text();
  }

  /**
   * Write/upload a file.
   * @param path WebDAV path where to write the file
   * @param content File contents (as string)
   * @param contentType MIME type (default: text/plain)
   */
  async writeFile(path: string, content: string, contentType: string = 'text/plain'): Promise<void> {
    await this.request(path, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: content,
    });
  }

  /**
   * Delete a file or directory.
   * @param path WebDAV path to delete
   */
  async delete(path: string): Promise<void> {
    await this.request(path, {
      method: 'DELETE',
    });
  }

  /**
   * Create a directory.
   * @param path WebDAV path for the new directory (must end with /)
   */
  async createDirectory(path: string): Promise<void> {
    const normalizedPath = path.endsWith('/') ? path : `${path}/`;
    await this.request(normalizedPath, {
      method: 'MKCOL',
    });
  }

  /**
   * Move/rename a file or directory.
   * @param sourcePath Source WebDAV path
   * @param destinationPath Destination WebDAV path
   */
  async move(sourcePath: string, destinationPath: string): Promise<void> {
    await this.request(sourcePath, {
      method: 'MOVE',
      headers: {
        Destination: `${this.baseUrl}${destinationPath}`,
      },
    });
  }

  /**
   * Copy a file or directory.
   * @param sourcePath Source WebDAV path
   * @param destinationPath Destination WebDAV path
   */
  async copy(sourcePath: string, destinationPath: string): Promise<void> {
    await this.request(sourcePath, {
      method: 'COPY',
      headers: {
        Destination: `${this.baseUrl}${destinationPath}`,
      },
    });
  }

  /**
   * Parse PROPFIND XML response into WebDavFile array.
   */
  private parsePropfindResponse(xmlText: string, basePath: string): WebDavFile[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');

    // Check for parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.error('XML parsing error:', parserError.textContent);
      return [];
    }

    const responses = doc.querySelectorAll('response');
    const files: WebDavFile[] = [];

    responses.forEach((response) => {
      const href = response.querySelector('href')?.textContent || '';
      const displayName = response.querySelector('displayname')?.textContent || '';
      const contentType = response.querySelector('getcontenttype')?.textContent || '';
      const contentLength = response.querySelector('getcontentlength')?.textContent;
      const lastModified = response.querySelector('getlastmodified')?.textContent;
      const resourcetype = response.querySelector('resourcetype');
      const isCollection = resourcetype?.querySelector('collection') !== null;

      // Skip the base path itself (it's the directory we're listing)
      // Normalize href for comparison
      let normalizedHref = href;
      if (href.startsWith(this.baseUrl)) {
        normalizedHref = href.substring(this.baseUrl.length);
      } else if (href.startsWith('http://') || href.startsWith('https://')) {
        try {
          const url = new URL(href);
          normalizedHref = url.pathname;
          // Remove /dav prefix if present
          if (normalizedHref.startsWith('/dav')) {
            normalizedHref = normalizedHref.substring(4);
          }
        } catch {
          // Invalid URL, use as-is
        }
      }

      // Remove any leading /dav/ from normalizedHref
      while (normalizedHref.startsWith('/dav/')) {
        normalizedHref = normalizedHref.substring(5);
      }
      if (normalizedHref === '/dav') {
        normalizedHref = '/';
      }

      // Extract relative path from href first (before filtering)
      let path = href;
      if (href.startsWith(this.baseUrl)) {
        path = href.substring(this.baseUrl.length);
      } else if (href.startsWith('http://') || href.startsWith('https://')) {
        // Full URL but doesn't match baseUrl - extract path portion
        try {
          const url = new URL(href);
          path = url.pathname;
          // Remove /dav prefix if present (since baseUrl already includes it)
          if (path.startsWith('/dav')) {
            path = path.substring(4);
          }
        } catch {
          // Invalid URL, use as-is
        }
      }

      // Remove any leading /dav/ from path (shouldn't be there since baseUrl includes /dav)
      // This handles cases where the server returns paths with /dav/ prefix
      while (path.startsWith('/dav/')) {
        path = path.substring(5);
      }
      if (path === '/dav') {
        path = '/';
      }

      // Ensure path starts with /
      if (!path.startsWith('/')) {
        path = '/' + path;
      }

      // Normalize paths for comparison (remove trailing slashes and normalize)
      const normalizeForCompare = (p: string): string => {
        let normalized = p.replace(/\/$/, '') || '/';
        // Remove any /dav prefix
        if (normalized.startsWith('/dav')) {
          normalized = normalized.substring(4) || '/';
        }
        return normalized;
      };

      const basePathForCompare = normalizeForCompare(basePath);
      const pathForCompare = normalizeForCompare(path);

      // Skip if this is the base path itself (the directory we're listing)
      // This is the first item that WebDAV returns - the directory itself
      if (pathForCompare === basePathForCompare) {
        return;
      }

      // Also check if the displayName matches the last part of the basePath
      // This catches cases where the path normalization might differ
      const basePathLastPart = basePath.split('/').filter(Boolean).pop() || '';
      if (basePathLastPart && displayName === basePathLastPart && pathForCompare === basePathForCompare) {
        return;
      }

      // Skip if path is just "/dav" or "/dav/" - this shouldn't appear as a folder
      if (path === '/dav' || path === '/dav/') {
        return;
      }

      // Ensure directories end with /
      if (isCollection && !path.endsWith('/')) {
        path = path + '/';
      }

      files.push({
        href,
        displayName: displayName || path.split('/').filter(Boolean).pop() || path,
        contentType: contentType || (isCollection ? 'directory' : 'application/octet-stream'),
        contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
        lastModified,
        isCollection,
        path: path,
      });
    });

    // Sort: directories first, then files, both alphabetically
    files.sort((a, b) => {
      if (a.isCollection && !b.isCollection) return -1;
      if (!a.isCollection && b.isCollection) return 1;
      return a.displayName.localeCompare(b.displayName);
    });

    return files;
  }
}
