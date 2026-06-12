import { afterEach, describe, expect, it, vi } from 'vitest';
import { cn, copyToClipboard } from './utils';

function stubClipboard(writeText: ReturnType<typeof vi.fn> | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    value: writeText ? { writeText } : undefined,
    configurable: true,
  });
}

function stubExecCommand(execCommand: ReturnType<typeof vi.fn> | undefined) {
  Object.defineProperty(document, 'execCommand', {
    value: execCommand,
    configurable: true,
  });
}

describe('cn', () => {
  it('merges conditional and conflicting tailwind classes', () => {
    expect(cn('p-2', false && 'hidden', 'p-4')).toBe('p-4');
  });
});

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'clipboard');
    Reflect.deleteProperty(document, 'execCommand');
  });

  it('uses navigator.clipboard.writeText when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    await copyToClipboard({ text: 'hello' });
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to execCommand when the clipboard write fails', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    const execCommand = vi.fn().mockReturnValue(true);
    stubExecCommand(execCommand);

    await copyToClipboard({ text: 'fallback me' });
    expect(execCommand).toHaveBeenCalledWith('copy');
    // The helper textarea must not linger in the DOM.
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('falls back to execCommand when the clipboard API is missing entirely', async () => {
    stubClipboard(undefined);
    const execCommand = vi.fn().mockReturnValue(true);
    stubExecCommand(execCommand);

    await copyToClipboard({ text: 'no clipboard api' });
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('surfaces the original clipboard error when the fallback also fails', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    stubExecCommand(vi.fn().mockReturnValue(false));

    await expect(copyToClipboard({ text: 'nope' })).rejects.toThrow('denied');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('throws when neither the clipboard API nor execCommand exists', async () => {
    stubClipboard(undefined);
    stubExecCommand(undefined);

    await expect(copyToClipboard({ text: 'nope' })).rejects.toThrow('Clipboard API not supported');
  });
});
