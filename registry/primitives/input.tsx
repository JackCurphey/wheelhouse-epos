import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Wheelhouse text input.
 *
 * Matches `.field input` in public/styles.css: 7px radius, 1px --border,
 * white ground so a field still reads as a distinct box when it sits on the
 * shop-coloured modal background (--modal-bg).
 *
 * The focus ring uses --accent, which is tenant-varying and rewritten at
 * runtime by public/app.js, so it stays a CSS custom property rather than a
 * compiled Tailwind colour class.
 */
export function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'w-full rounded-[7px] border border-[var(--border)] bg-white px-2.5 py-[9px]',
        'text-sm text-[var(--ink)] placeholder:text-[var(--muted)]',
        'focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--accent)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-[var(--danger)]',
        // Number fields are edited by typing, not by nudging spinners - the
        // vanilla app hides them globally and React inputs must match.
        '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        className,
      )}
      {...props}
    />
  );
}
