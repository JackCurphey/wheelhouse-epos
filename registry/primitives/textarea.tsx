import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Wheelhouse multi-line text box: the input's look, at least 80px tall, and
 * the customer can drag it taller.
 * Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
 */
export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'min-h-20 w-full resize-y rounded-[7px] border border-[var(--border)] bg-white px-2.5 py-[9px]',
        'text-sm text-[var(--wh-ink)] placeholder:text-[var(--wh-muted)]',
        'focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--accent)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-[var(--wh-danger)]',
        className,
      )}
      {...props}
    />
  );
}
