import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CopyToClipboardProps = { text: string };

export async function copyToClipboard({ text }: CopyToClipboardProps) {
  if (typeof navigator === 'undefined') {
    throw new Error('Clipboard API not supported');
  }

  let clipboardError: Error | null = null;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      clipboardError = error as Error;
    }
  }

  if (typeof document === 'undefined') {
    throw clipboardError ?? new Error('Clipboard API not supported');
  }

  const execCommand = typeof document.execCommand === 'function' ? document.execCommand.bind(document) : null;

  if (!execCommand) {
    throw clipboardError ?? new Error('Clipboard API not supported');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();

    const successful = execCommand('copy');

    if (!successful) {
      throw new Error('Fallback copy command was unsuccessful');
    }
  } catch (error) {
    throw clipboardError ?? (error as Error);
  } finally {
    document.body.removeChild(textarea);
  }
}

