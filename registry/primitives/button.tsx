import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Wheelhouse button.
 *
 * Mirrors the existing `.btn` family in public/styles.css one-for-one so the
 * React screens sit next to the vanilla screens without a visible seam.
 *
 * Colour rule: every colour is a token from src/styles/theme.css (Fjell).
 * `primary` and `accent` are the same Fjell primary - Fjell has one action
 * colour. They stay CSS custom properties rather than baked-in values, so a
 * future per-shop theme for customer pages can still set them at runtime.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-lg border font-semibold transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-[var(--accent)]',
    'disabled:cursor-not-allowed disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'border-[var(--border)] bg-[var(--wh-panel)] text-[var(--wh-ink)] hover:bg-[var(--wh-hover)]',
        primary: 'border-[var(--wh-brand)] bg-[var(--wh-brand)] text-[var(--wh-on-brand)] hover:bg-[var(--wh-brand-dark)]',
        accent: 'border-[var(--accent)] bg-[var(--accent)] text-[var(--wh-on-brand)] hover:bg-[var(--accent-dark)]',
        danger: 'border-[var(--wh-danger)] bg-[var(--wh-danger)] text-[var(--wh-on-brand)] hover:bg-[var(--wh-danger-hover)]',
        ghost: 'border-transparent bg-transparent text-[var(--wh-ink)] hover:bg-[var(--wh-hover)]',
      },
      size: {
        default: 'px-4 py-[9px] text-sm',
        sm: 'rounded-md px-2.5 py-[5px] text-[13px]',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      block: false,
    },
  },
);

export type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

/**
 * `type` defaults to "button": every button in the staff app that is not an
 * explicit submit should never submit the form it happens to sit inside.
 */
export function Button({ className, variant, size, block, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
