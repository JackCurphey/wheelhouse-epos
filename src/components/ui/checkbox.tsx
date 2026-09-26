import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Wheelhouse tick box: the phone's own checkbox, coloured with the shop
 * colour, with its label beside it. The whole row is the tap target (at
 * least 44px tall).
 * Spec: docs/superpowers/specs/2026-09-26-book-c-form-controls-design.md
 */
export type CheckboxProps = Omit<React.ComponentProps<'input'>, 'type'> & { label: React.ReactNode };

export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  return (
    <label
      htmlFor={inputId}
      className={cn('flex min-h-11 cursor-pointer items-center gap-[9px] text-sm text-[var(--wh-ink)]', className)}
    >
      <input id={inputId} type="checkbox" className="size-[18px] shrink-0 accent-[var(--accent-dark)]" {...props} />
      <span>{label}</span>
    </label>
  );
}
