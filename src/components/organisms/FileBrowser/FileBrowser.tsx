'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useWebDav } from '@/hooks/webdav';
import { useAdminActions } from '@/hooks/admin';
import type { WebDavFile } from '@/services/webdav';
import {
  Folder,
  File,
  Trash2,
  RefreshCw,
  ChevronRight,
  Edit2,
  Save,
  X,
  Search,
  ArrowUp,
  ArrowDown,
  Pencil,
} from 'lucide-react';
import { cn } from '@/libs/utils';
import type { FileBrowserProps } from './FileBrowser.types';

type SortField = 'name' | 'size' | 'date' | 'type';
type SortDirection = 'asc' | 'desc';
type SortOption = { field: SortField; direction: SortDirection };

export function FileBrowser({ initialPath = '/', diskUsedMB }: FileBrowserProps) {
  const { listDirectory, readFile, writeFile, deleteFile, createDirectory, moveFile, isLoading, error } = useWebDav();
  const { deleteUrl, isDeletingUrl, deleteUrlError } = useAdminActions();
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [files, setFiles] = useState<WebDavFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<WebDavFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isViewingFile, setIsViewingFile] = useState(false);
  const [isEditingFile, setIsEditingFile] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showCreateDirDialog, setShowCreateDirDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteByPathDialog, setShowDeleteByPathDialog] = useState(false);
  const [deleteByPathInput, setDeleteByPathInput] = useState('');
  const [deleteByPathValidationError, setDeleteByPathValidationError] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<WebDavFile | null>(null);
  const [fileToRename, setFileToRename] = useState<WebDavFile | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFileContent, setNewFileContent] = useState('');
  const [newDirName, setNewDirName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>({ field: 'type', direction: 'asc' });

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const loadDirectory = useCallback(
    async (path: string) => {
      // Clear files immediately when path changes to show loading state
      setFiles([]);
      const directory = await listDirectory(path);
      if (directory) {
        setFiles(directory.files);
      }
    },
    [listDirectory],
  );

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
      setValidationError("Cannot create files at root level. Navigate to a user's /pub/ directory first.");
      setShowUploadDialog(false);
      setTimeout(() => setValidationError(null), 5000);
      return;
    }

    setIsSaving(true);
    setValidationError(null);
    const uploadPath = currentPath.endsWith('/') ? `${currentPath}${newFileName}` : `${currentPath}/${newFileName}`;

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
      setValidationError("Cannot create directories at root level. Navigate to a user's /pub/ directory first.");
      setShowCreateDirDialog(false);
      setTimeout(() => setValidationError(null), 5000);
      return;
    }

    setIsSaving(true);
    setValidationError(null);
    const dirPath = currentPath.endsWith('/') ? `${currentPath}${newDirName}/` : `${currentPath}/${newDirName}/`;

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

  const normalizeAdminDeletePath = (raw: string): string => {
    let value = raw.trim();
    if (!value) return '';

    // Support pasting full URLs
    if (/^https?:\/\//i.test(value)) {
      try {
        value = new URL(value).pathname;
      } catch {
        // fall through
      }
    }

    // Allow users to paste /dav/... or /webdav/... paths; normalize to entry_path
    const davMarker = '/dav/';
    const webdavMarker = '/webdav/';
    if (value.includes(davMarker)) {
      value = value.split(davMarker).slice(1).join(davMarker);
    }
    if (value.includes(webdavMarker)) {
      value = value.split(webdavMarker).slice(1).join(webdavMarker);
    }

    value = value.replace(/^\/+/, '');
    value = value.replace(/^dav\/+/, '');
    value = value.replace(/^webdav\/+/, '');

    return value;
  };

  const handleDeleteByPath = async () => {
    const normalized = normalizeAdminDeletePath(deleteByPathInput);
    if (!normalized) {
      setDeleteByPathValidationError('Please enter an entry path to delete.');
      return;
    }

    setDeleteByPathValidationError(null);
    try {
      await deleteUrl(normalized);
      setShowDeleteByPathDialog(false);
      setDeleteByPathInput('');
    } catch {
      // error surfaced via deleteUrlError
    }
  };

  const handleRename = async () => {
    if (!fileToRename || !renameValue.trim()) return;

    setIsSaving(true);
    setValidationError(null);

    try {
      // Get the parent directory path
      const parentPath = fileToRename.path.substring(0, fileToRename.path.lastIndexOf('/'));
      const newPath = parentPath.endsWith('/')
        ? `${parentPath}${renameValue.trim()}${fileToRename.isCollection ? '/' : ''}`
        : `${parentPath}/${renameValue.trim()}${fileToRename.isCollection ? '/' : ''}`;

      const success = await moveFile(fileToRename.path, newPath);
      if (!success) {
        throw new Error('Failed to rename file');
      }
      setShowRenameDialog(false);
      setFileToRename(null);
      setRenameValue('');
      await loadDirectory(currentPath);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to rename file');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSort = (field: SortField) => {
    setSortOption((current) => {
      // If clicking the same field, toggle direction; otherwise, set to ascending
      if (current.field === field) {
        return { field, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
  };

  // Filter and sort files
  const filteredAndSortedFiles = files
    .filter((file) => {
      if (!debouncedSearchQuery) return true;
      const query = debouncedSearchQuery.toLowerCase();
      return file.displayName.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortOption.field) {
        case 'name':
          comparison = a.displayName.localeCompare(b.displayName);
          break;
        case 'size':
          comparison = (a.contentLength || 0) - (b.contentLength || 0);
          break;
        case 'date':
          comparison = (a.lastModified || '').localeCompare(b.lastModified || '');
          break;
        case 'type':
          // Folders first, then files, both alphabetically
          if (a.isCollection && !b.isCollection) return -1;
          if (!a.isCollection && b.isCollection) return 1;
          comparison = a.displayName.localeCompare(b.displayName);
          break;
      }

      return sortOption.direction === 'asc' ? comparison : -comparison;
    });

  const pathParts = currentPath.split('/').filter(Boolean);
  const breadcrumbs = [
    { name: '/', path: '/' },
    ...pathParts.map((part, index) => {
      const path = '/' + pathParts.slice(0, index + 1).join('/') + (index < pathParts.length - 1 ? '/' : '');
      return { name: part, path };
    }),
  ];

  // Check if we're in a valid location for creating files/directories
  // Must be inside a user's /pub/ directory (path contains /pub/)
  const canCreateFiles = currentPath.includes('/pub/') || currentPath.match(/^\/[^/]+\/pub\/?$/);

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
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>File Browser</CardTitle>
              <CardDescription>Browse and manage files</CardDescription>
            </div>
            <div className="flex gap-2">
              {typeof diskUsedMB === 'number' && (
                <Badge variant="secondary" className="text-xs font-normal">
                  Disk Used: {diskUsedMB} MB
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={() => loadDirectory(currentPath)} disabled={isLoading}>
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Inset separator between the header and the content (lighter than a full divider) */}
        <div className="mx-6 h-px bg-border/60" />

        <CardContent className="space-y-4 pt-4">
          {/* Search + Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search files"
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDeleteByPathValidationError(null);
                  setShowDeleteByPathDialog(true);
                }}
                disabled={isDeletingUrl}
                title="Delete an entry by pasting its path"
                aria-label="Delete"
                className="w-9 px-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1 overflow-x-auto pb-2 text-xs sm:gap-2 sm:pb-0 sm:text-sm">
              {breadcrumbs.map((crumb, index) => (
                <div key={index} className="flex shrink-0 items-center gap-1 sm:gap-2">
                  {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateToPath(crumb.path)}
                    className="h-6 px-1.5 text-xs sm:px-2 sm:text-sm"
                  >
                    {crumb.name}
                  </Button>
                </div>
              ))}
            </div>

            {canCreateFiles && (
              <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowCreateDirDialog(true)} disabled={isLoading}>
                  New Folder
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowUploadDialog(true)} disabled={isLoading}>
                  New File
                </Button>
              </div>
            )}
          </div>

          {/* Error Alert */}
          {(error || validationError) && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error?.message || validationError}</AlertDescription>
            </Alert>
          )}

          {/* File List */}
          {isLoading && files.length === 0 ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredAndSortedFiles.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Folder className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>{files.length === 0 ? 'This directory is empty' : `No files match "${debouncedSearchQuery}"`}</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden overflow-x-auto rounded-md border md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th
                        className="cursor-pointer p-2 text-left text-sm font-semibold select-none hover:bg-muted/50"
                        onClick={() => handleSort('type')}
                      >
                        <div className="flex items-center gap-2">
                          <span>Name</span>
                          {sortOption.field === 'type' &&
                            (sortOption.direction === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            ))}
                        </div>
                      </th>
                      <th
                        className="cursor-pointer p-2 text-left text-sm font-semibold select-none hover:bg-muted/50"
                        onClick={() => handleSort('size')}
                      >
                        <div className="flex items-center gap-2">
                          <span>Size</span>
                          {sortOption.field === 'size' &&
                            (sortOption.direction === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            ))}
                        </div>
                      </th>
                      <th
                        className="cursor-pointer p-2 text-left text-sm font-semibold select-none hover:bg-muted/50"
                        onClick={() => handleSort('date')}
                      >
                        <div className="flex items-center gap-2">
                          <span>Modified</span>
                          {sortOption.field === 'date' &&
                            (sortOption.direction === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            ))}
                        </div>
                      </th>
                      <th className="p-2 text-right text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedFiles.map((file) => (
                      <tr
                        key={file.path}
                        className="cursor-pointer border-b hover:bg-muted/50"
                        onClick={() => handleFileClick(file)}
                      >
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            {file.isCollection ? (
                              <Folder className="h-4 w-4 text-brand" />
                            ) : (
                              <File className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="truncate font-medium">{file.displayName}</span>
                          </div>
                        </td>
                        <td className="p-2 text-sm text-muted-foreground">
                          {file.isCollection ? '-' : formatFileSize(file.contentLength)}
                        </td>
                        <td className="p-2 text-sm text-muted-foreground">{formatDate(file.lastModified)}</td>
                        <td className="p-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFileToRename(file);
                                setRenameValue(file.displayName);
                                setShowRenameDialog(true);
                              }}
                              className="h-7 w-7 p-0"
                              title="Rename"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFileToDelete(file);
                                setShowDeleteDialog(true);
                              }}
                              className="h-7 w-7 p-0"
                              title="Delete"
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

              {/* Mobile Card View */}
              <div className="space-y-2 md:hidden">
                {filteredAndSortedFiles.map((file) => (
                  <div
                    key={file.path}
                    className="cursor-pointer rounded-md border bg-muted/50 p-3 hover:bg-muted"
                    onClick={() => handleFileClick(file)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {file.isCollection ? (
                          <Folder className="h-4 w-4 shrink-0 text-brand" />
                        ) : (
                          <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{file.displayName}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {!file.isCollection && <span>{formatFileSize(file.contentLength)}</span>}
                            {!file.isCollection && file.contentLength && <span>•</span>}
                            <span>{formatDate(file.lastModified)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFileToRename(file);
                            setRenameValue(file.displayName);
                            setShowRenameDialog(true);
                          }}
                          className="h-7 w-7 p-0"
                          title="Rename"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFileToDelete(file);
                            setShowDeleteDialog(true);
                          }}
                          className="h-7 w-7 p-0"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* File Viewer/Editor Dialog */}
      <Dialog open={isViewingFile} onOpenChange={setIsViewingFile}>
        <DialogContent className="max-h-[80vh] max-w-[calc(100vw-2rem)] sm:max-w-[min(56rem,calc(100vw-4rem))]">
          <DialogHeader>
            <DialogTitle>{selectedFile?.displayName}</DialogTitle>
            <DialogDescription>{selectedFile?.path}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isEditingFile ? (
              <Textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                className="min-h-[300px] font-mono text-xs sm:min-h-[400px] sm:text-sm"
                placeholder="File content..."
              />
            ) : (
              <div className="max-h-[50vh] overflow-auto rounded-md border bg-muted/50 p-3 sm:max-h-[60vh] sm:p-4">
                <pre className="font-mono text-xs break-words whitespace-pre-wrap sm:text-sm">{fileContent}</pre>
              </div>
            )}
          </div>
          <DialogFooter>
            {isEditingFile ? (
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            ) : (
              <Button onClick={handleEdit}>
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New File Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New File</DialogTitle>
            <DialogDescription>Create a new file in {currentPath}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>File Name</Label>
              <Input value={newFileName} onChange={(e) => setNewFileName(e.target.value)} placeholder="example.txt" />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                value={newFileContent}
                onChange={(e) => setNewFileContent(e.target.value)}
                placeholder="File content..."
                rows={8}
                className="font-mono text-xs sm:text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpload} disabled={!newFileName.trim() || isSaving}>
              {isSaving ? 'Creating...' : 'Create'}
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
              <Input value={newDirName} onChange={(e) => setNewDirName(e.target.value)} placeholder="new-folder" />
            </div>
          </div>
          <DialogFooter>
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
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {fileToRename?.isCollection ? 'Directory' : 'File'}</DialogTitle>
            <DialogDescription>
              Enter a new name for <strong>{fileToRename?.displayName}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {validationError && (
              <Alert variant="destructive">
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label>New Name</Label>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder={fileToRename?.displayName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && renameValue.trim()) {
                    handleRename();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleRename} disabled={!renameValue.trim() || isSaving}>
              {isSaving ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete by Path Dialog (Admin) */}
      <Dialog open={showDeleteByPathDialog} onOpenChange={setShowDeleteByPathDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete</DialogTitle>
            <DialogDescription>
              Paste an entry path to delete (destructive). You can paste a full URL or a path like{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">/dav/&lt;pubkey&gt;/pub/file.txt</code>.
            </DialogDescription>
          </DialogHeader>

          {(deleteByPathValidationError || deleteUrlError) && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{deleteByPathValidationError || deleteUrlError?.message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Path</Label>
            <Input
              value={deleteByPathInput}
              onChange={(e) => setDeleteByPathInput(e.target.value)}
              placeholder="/dav/<pubkey>/pub/file.txt"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleDeleteByPath();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Will delete:{' '}
              <code className="rounded bg-muted px-1 py-0.5">{normalizeAdminDeletePath(deleteByPathInput) || '-'}</code>
            </p>
          </div>

          <DialogFooter>
            <Button variant="destructive" onClick={handleDeleteByPath} disabled={isDeletingUrl}>
              {isDeletingUrl ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {filteredAndSortedFiles.length > 0 && files.length > filteredAndSortedFiles.length && (
        <div className="text-sm text-muted-foreground">
          Showing <strong>{filteredAndSortedFiles.length}</strong> of <strong>{files.length}</strong> files
        </div>
      )}
    </div>
  );
}
