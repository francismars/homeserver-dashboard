'use client';

import { useState, useCallback } from 'react';
import { WebDavService } from '@/services/webdav';
import type { WebDavFile, WebDavDirectory, WebDavError } from '@/services/webdav';

export function useWebDav() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<WebDavError | null>(null);

  const getService = useCallback((): WebDavService | null => {
    const baseUrl = process.env.NEXT_PUBLIC_ADMIN_BASE_URL || '';
    const password = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';
    
    if (!baseUrl || !password) {
      setError({ message: 'WebDAV credentials not configured', status: 0 });
      return null;
    }

    return new WebDavService({
      baseUrl: `${baseUrl}/dav`,
      username: 'admin',
      password,
    });
  }, []);

  const listDirectory = useCallback(async (path: string): Promise<WebDavDirectory | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const service = getService();
      if (!service) return null;
      
      const directory = await service.listDirectory(path);
      return directory;
    } catch (err) {
      const webdavError: WebDavError = err instanceof Error 
        ? { message: err.message, status: 0 }
        : err as WebDavError;
      setError(webdavError);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getService]);

  const readFile = useCallback(async (path: string): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const service = getService();
      if (!service) return null;
      
      const content = await service.readFile(path);
      return content;
    } catch (err) {
      const webdavError: WebDavError = err instanceof Error 
        ? { message: err.message, status: 0 }
        : err as WebDavError;
      setError(webdavError);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getService]);

  const writeFile = useCallback(async (path: string, content: string, contentType?: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const service = getService();
      if (!service) return false;
      
      await service.writeFile(path, content, contentType);
      return true;
    } catch (err) {
      const webdavError: WebDavError = err instanceof Error 
        ? { message: err.message, status: 0 }
        : err as WebDavError;
      setError(webdavError);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getService]);

  const deleteFile = useCallback(async (path: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const service = getService();
      if (!service) return false;
      
      await service.delete(path);
      return true;
    } catch (err) {
      const webdavError: WebDavError = err instanceof Error 
        ? { message: err.message, status: 0 }
        : err as WebDavError;
      setError(webdavError);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getService]);

  const createDirectory = useCallback(async (path: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const service = getService();
      if (!service) return false;
      
      await service.createDirectory(path);
      return true;
    } catch (err) {
      const webdavError: WebDavError = err instanceof Error 
        ? { message: err.message, status: 0 }
        : err as WebDavError;
      setError(webdavError);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getService]);

  const moveFile = useCallback(async (sourcePath: string, destinationPath: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const service = getService();
      if (!service) return false;
      
      await service.move(sourcePath, destinationPath);
      return true;
    } catch (err) {
      const webdavError: WebDavError = err instanceof Error 
        ? { message: err.message, status: 0 }
        : err as WebDavError;
      setError(webdavError);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getService]);

  return {
    listDirectory,
    readFile,
    writeFile,
    deleteFile,
    createDirectory,
    moveFile,
    isLoading,
    error,
  };
}

