'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useWebDav } from '@/hooks/webdav';
import type { WebDavFile } from '@/services/webdav';
import {
  Folder,
  File,
  Upload,
  FolderPlus,
  Trash2,
  RefreshCw,
  ChevronRight,
  Home,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import { cn } from '@/libs/utils';
import type { FileBrowserProps } from './FileBrowser.types';

export function FileBrowser({ initialPath = '/' }: FileBrowserProps) {
  const { listDirectory, readFile, writeFile, deleteFile, createDirectory, isLoading, error } = useWebDav();
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [files, setFiles] = useState<WebDavFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<WebDavFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isViewingFile, setIsViewingFile] = useState(false);
  const [isEditingFile, setIsEditingFile] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showCreateDirDialog, setShowCreateDirDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<WebDavFile | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFileContent, setNewFileContent] = useState('');
  const [newDirName, setNewDirName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const loadDirectory = useCallback(async (path: string) => {
    const directory = await listDirectory(path);
    if (directory) {
      setFiles(directory.files);
    }
  }, [listDirectory]);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const handleFileClick = async (file: WebDavFile) => {
    if (file.isCollection) {
      // Navigate into directory
      setCurrentPath(file.path);
    } else {
      // Open file for viewing
      const content = await readFile(file.path);
      if (content !== null) {
        setFileContent(content);
        setSelectedFile(file);
        setIsViewingFile(true);
        setIsEditingFile(false);
      }
    }
  };

  const handleEdit = () => {
    setIsEditingFile(true);
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    
    setIsSaving(true);
    const success = await writeFile(selectedFile.path, fileContent);
    if (success) {
      setIsEditingFile(false);
      // Reload directory to refresh file list
      await loadDirectory(currentPath);
    }
    setIsSaving(false);
  };

  const handleCancelEdit = () => {
    setIsEditingFile(false);
    // Reload file content
    if (selectedFile) {
      readFile(selectedFile.path).then((content) => {
        if (content !== null) {
          setFileContent(content);
        }
      });
    }
  };

  const handleUpload = async () => {
    if (!newFileName.trim()) return;
    
    // Validate path structure
    if (!canCreateFiles) {
      setValidationError('Cannot create files at root level. Navigate to a user\'s /pub/ directory first.');
      setShowUploadDialog(false);
      setTimeout(() => setValidationError(null), 5000);
      return;
    }
    
    setIsSaving(true);
    setValidationError(null);
    const uploadPath = currentPath.endsWith('/') 
      ? `${currentPath}${newFileName}` 
      : `${currentPath}/${newFileName}`;
    
    const success = await writeFile(uploadPath, newFileContent);
    if (success) {
      setShowUploadDialog(false);
      setNewFileName('');
      setNewFileContent('');
      await loadDirectory(currentPath);
    }
    setIsSaving(false);
  };

  const handleCreateDirectory = async () => {
    if (!newDirName.trim()) return;
    
    // Validate path structure
    if (!canCreateFiles) {
      setValidationError('Cannot create directories at root level. Navigate to a user\'s /pub/ directory first.');
      setShowCreateDirDialog(false);
      setTimeout(() => setValidationError(null), 5000);
      return;
    }
    
    setIsSaving(true);
    setValidationError(null);
    const dirPath = currentPath.endsWith('/') 
      ? `${currentPath}${newDirName}/` 
      : `${currentPath}/${newDirName}/`;
    
    const success = await createDirectory(dirPath);
    if (success) {
      setShowCreateDirDialog(false);
      setNewDirName('');
      await loadDirectory(currentPath);
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!fileToDelete) return;
    
    setIsSaving(true);
    const success = await deleteFile(fileToDelete.path);
    if (success) {
      setShowDeleteDialog(false);
      setFileToDelete(null);
      await loadDirectory(currentPath);
      if (selectedFile?.path === fileToDelete.path) {
        setIsViewingFile(false);
        setSelectedFile(null);
      }
    }
    setIsSaving(false);
  };

  const navigateToPath = (path: string) => {
    setCurrentPath(path);
  };

  const pathParts = currentPath.split('/').filter(Boolean);
  const breadcrumbs = pathParts.map((part, index) => {
    const path = '/' + pathParts.slice(0, index + 1).join('/') + (index < pathParts.length - 1 ? '/' : '');
    return { name: part, path };
  });

  // Check if we're in a valid location for creating files/directories
  // Must be inside a user's /pub/ directory (path contains /pub/)
  const canCreateFiles = currentPath.includes('/pub/') || currentPath.match(/^\/[^/]+\/pub\/?$/);
  const isRootLevel = currentPath === '/' || currentPath === '';

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>File Browser</CardTitle>
              <CardDescription>Browse and manage files via WebDAV</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadDirectory(currentPath)}
                disabled={isLoading}
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateDirDialog(true)}
                disabled={isLoading || !canCreateFiles}
                title={!canCreateFiles ? 'Can only create directories inside user /pub/ directories' : ''}
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUploadDialog(true)}
                disabled={isLoading || !canCreateFiles}
                title={!canCreateFiles ? 'Can only create files inside user /pub/ directories' : ''}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateToPath('/')}
              className="h-6 px-2"
            >
              <Home className="h-3 w-3" />
            </Button>
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateToPath(crumb.path)}
                  className="h-6 px-2"
                >
                  {crumb.name}
                </Button>
              </div>
            ))}
          </div>

          {/* Error Alert */}
          {(error || validationError) && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error?.message || validationError}</AlertDescription>
            </Alert>
          )}

          {/* Info Alert for root level */}
          {isRootLevel && (
            <Alert>
              <AlertTitle>WebDAV Root Directory</AlertTitle>
              <AlertDescription>
                This is the root directory. Navigate into a user directory (pubkey) and then into their <code>/pub/</code> folder to create files and directories.
                <br />
                <span className="text-xs text-muted-foreground mt-1 block">
                  Path structure: <code>/dav/&#123;pubkey&#125;/pub/&#123;file_path&#125;</code>
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* File List */}
          {isLoading && files.length === 0 ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>This directory is empty</p>
            </div>
          ) : (
            <div className="border rounded-md">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 text-sm font-semibold">Name</th>
                    <th className="text-left p-2 text-sm font-semibold">Size</th>
                    <th className="text-left p-2 text-sm font-semibold">Modified</th>
                    <th className="text-right p-2 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr
                      key={file.path}
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleFileClick(file)}
                    >
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {file.isCollection ? (
                            <Folder className="h-4 w-4 text-blue-500" />
                          ) : (
                            <File className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-medium">{file.displayName}</span>
                        </div>
                      </td>
                      <td className="p-2 text-sm text-muted-foreground">
                        {file.isCollection ? '-' : formatFileSize(file.contentLength)}
                      </td>
                      <td className="p-2 text-sm text-muted-foreground">
                        {formatDate(file.lastModified)}
                      </td>
                      <td className="p-2">
                        <div className="flex justify-end gap-1">
                          {!file.isCollection && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFileClick(file);
                              }}
                              className="h-7 w-7 p-0"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFileToDelete(file);
                              setShowDeleteDialog(true);
                            }}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Viewer/Editor Dialog */}
      <Dialog open={isViewingFile} onOpenChange={setIsViewingFile}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedFile?.displayName}</DialogTitle>
            <DialogDescription>{selectedFile?.path}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isEditingFile ? (
              <Textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                className="font-mono text-sm min-h-[400px]"
                placeholder="File content..."
              />
            ) : (
              <div className="border rounded-md p-4 bg-muted/50 max-h-[60vh] overflow-auto">
                <pre className="text-sm font-mono whitespace-pre-wrap">{fileContent}</pre>
              </div>
            )}
          </div>
          <DialogFooter>
            {isEditingFile ? (
              <>
                <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsViewingFile(false)}>
                  Close
                </Button>
                <Button onClick={handleEdit}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload File Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>Create a new file in {currentPath}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>File Name</Label>
              <Input
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="example.txt"
              />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                value={newFileContent}
                onChange={(e) => setNewFileContent(e.target.value)}
                placeholder="File content..."
                rows={10}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!newFileName.trim() || isSaving}>
              {isSaving ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Directory Dialog */}
      <Dialog open={showCreateDirDialog} onOpenChange={setShowCreateDirDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Directory</DialogTitle>
            <DialogDescription>Create a new directory in {currentPath}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Directory Name</Label>
              <Input
                value={newDirName}
                onChange={(e) => setNewDirName(e.target.value)}
                placeholder="new-folder"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDirDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDirectory} disabled={!newDirName.trim() || isSaving}>
              {isSaving ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {fileToDelete?.isCollection ? 'Directory' : 'File'}</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{fileToDelete?.displayName}</strong>?
              {fileToDelete?.isCollection && ' This will delete all contents.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

