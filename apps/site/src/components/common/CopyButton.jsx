'use client';

import { useState, useCallback } from 'react';
import { Copy, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function CopyButton({ value, label = 'Copy', className, size = 'md' }) {
  const [status, setStatus] = useState('idle');

  const onCopy = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setStatus('copied');
      toast.success('Copied to clipboard', { description: value.length > 60 ? value.slice(0, 57) + '\u2026' : value });
      setTimeout(() => setStatus('idle'), 1600);
    } catch (e) {
      setStatus('error');
      toast.error('Copy failed', { description: 'Select the text and copy it manually.' });
      setTimeout(() => setStatus('idle'), 2200);
    }
  }, [value]);

  const sizes = { sm: 'h-8 px-2.5 text-xs gap-1.5', md: 'h-9 px-3 text-sm gap-2' };

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={status === 'copied' ? 'Copied to clipboard' : label}
      className={cn(
        'inline-flex items-center rounded-md border border-phino-border bg-phino-surface-raised font-medium text-phino-text-muted transition-colors hover:border-phino-border-strong hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phino-canvas',
        sizes[size],
        className,
      )}
    >
      {status === 'copied' ? (
        <Check className="h-4 w-4 text-phino-signal-text" aria-hidden="true" />
      ) : status === 'error' ? (
        <AlertTriangle className="h-4 w-4 text-phino-danger-text" aria-hidden="true" />
      ) : (
        <Copy className="h-4 w-4" aria-hidden="true" />
      )}
      <span aria-live="polite">{status === 'copied' ? 'Copied' : status === 'error' ? 'Failed' : label}</span>
    </button>
  );
}
