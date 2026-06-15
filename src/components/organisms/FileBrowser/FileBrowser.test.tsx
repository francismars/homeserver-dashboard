import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileBrowser } from './FileBrowser';
import type { WebDavFile } from '@/services/webdav';

const listDirectory = vi.fn();
const deleteFile = vi.fn();
const moveFile = vi.fn();
const deleteUrl = vi.fn();

vi.mock('@/hooks/webdav', () => ({
  useWebDav: () => ({
    listDirectory,
    readFile: vi.fn(),
    writeFile: vi.fn(),
    deleteFile,
    createDirectory: vi.fn(),
    moveFile,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/admin', () => ({
  useAdminActions: () => ({ deleteUrl, isDeletingUrl: false, deleteUrlError: null }),
}));

const files: WebDavFile[] = [
  {
    displayName: 'notes.txt',
    path: '/pk1/pub/notes.txt',
    isCollection: false,
    contentType: 'text/plain',
    contentLength: 12,
    lastModified: '2026-06-12T10:00:00.000Z',
  },
];

function renderBrowser() {
  return render(<FileBrowser initialPath="/pk1/pub/" />);
}

async function dialog() {
  await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
  return within(screen.getByRole('dialog'));
}

describe('FileBrowser dialogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listDirectory.mockResolvedValue({ directory: { files } });
    deleteFile.mockResolvedValue(true);
    deleteUrl.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('delete confirmation offers Cancel; cancelling closes without deleting', async () => {
    renderBrowser();
    await waitFor(() => expect(screen.getAllByLabelText('Delete notes.txt').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByLabelText('Delete notes.txt')[0]);
    const d = await dialog();
    expect(d.getByRole('button', { name: 'Delete' })).toBeTruthy();
    fireEvent.click(d.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('New File dialog offers Cancel', async () => {
    renderBrowser();
    await waitFor(() => expect(screen.getByRole('button', { name: 'New File' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'New File' }));
    const d = await dialog();
    fireEvent.click(d.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Create Directory dialog offers Cancel', async () => {
    renderBrowser();
    await waitFor(() => expect(screen.getByRole('button', { name: 'New Folder' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'New Folder' }));
    const d = await dialog();
    fireEvent.click(d.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Rename dialog offers Cancel; cancelling does not move the file', async () => {
    renderBrowser();
    await waitFor(() => expect(screen.getAllByLabelText('Rename notes.txt').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByLabelText('Rename notes.txt')[0]);
    const d = await dialog();
    fireEvent.click(d.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(moveFile).not.toHaveBeenCalled();
  });

  it('delete-by-path shows the normalized target, ignores Enter, and deletes only on the button click', async () => {
    renderBrowser();
    await waitFor(() => expect(screen.getByLabelText('Delete')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Delete'));
    const d = await dialog();

    const input = d.getByLabelText('Path');
    fireEvent.change(input, { target: { value: 'https://example.com/dav/pk1/pub/file.txt' } });

    // The normalized entry path is shown before anything is deleted.
    expect(d.getByTestId('delete-by-path-preview').textContent).toContain('pk1/pub/file.txt');

    // Enter must not fire the destructive call.
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(deleteUrl).not.toHaveBeenCalled();

    fireEvent.click(d.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleteUrl).toHaveBeenCalledWith('pk1/pub/file.txt'));
  });

  it('delete-by-path offers Cancel', async () => {
    renderBrowser();
    await waitFor(() => expect(screen.getByLabelText('Delete')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Delete'));
    const d = await dialog();
    fireEvent.click(d.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(deleteUrl).not.toHaveBeenCalled();
  });
});
