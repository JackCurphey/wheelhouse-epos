import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Wheelhouse button.
 *
 * Mirrors the existing `.btn` family in public/styles.css one-for-one so the
 * React screens sit next to the vanilla screens without a visible seam.
 *
 * Colour rule: `accent` is the only tenant-varying variant, and it reads
 * --accent / --accent-dark, which public/app.js rewrites at runtime per shop.
 * It must stay a CSS custom property - Tailwind compiles at build time and
 * cannot emit a class for a shop that does not exist yet.
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
        default: 'border-[var(--border)] bg-white text-[var(--ink)] hover:bg-wh-hover',
        primary: 'border-[var(--brand)] bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]',
        accent: 'border-[var(--accent)] bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]',
        danger: 'border-[var(--danger)] bg-[var(--danger)] text-white hover:bg-wh-danger-hover',
        ghost: 'border-transparent bg-transparent text-[var(--ink)] hover:bg-wh-hover',
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
