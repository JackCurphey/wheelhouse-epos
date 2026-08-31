import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Wheelhouse field label - the small muted caption above an input, matching
 * `.field label` in public/styles.css (12px, 600, --muted).
 *
 * Deliberately a plain <label>: pairing is by htmlFor/id, which keeps the
 * component dependency-free and works inside the native <dialog> the
 * Wheelhouse dialog primitive uses.
 */
export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      className={cn(
        'text-xs font-semibold text-[var(--muted)]',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

/**
 * The label + control stack the vanilla app calls `.field`. Bundled with the
 * label because every Wheelhouse form uses the two together.
 */
export function Field({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mb-3 flex flex-col gap-1', className)} {...props} />;
}

/** Validation message under a field - `.field-error` in public/styles.css. */
export function FieldError({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('mt-1 text-[12.5px] text-[var(--danger)]', className)} {...props} />;
}
