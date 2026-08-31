import * as React from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Wheelhouse dialog.
 *
 * Built on the native <dialog> element rather than a headless library: the
 * browser gives focus trapping, inert background, Escape handling and the
 * ::backdrop layer for free, which keeps this primitive dependency-free.
 *
 * Visual parity with `.modal` / `.modal-backdrop` in public/styles.css.
 * The panel background is --modal-bg, which public/app.js rewrites per shop,
 * so it is a CSS custom property and never a compiled Tailwind colour.
 */
export type DialogProps = Omit<React.ComponentProps<'dialog'>, 'onClose'> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Widen the panel from 480px to 640px, matching `.modal.wide`. */
  wide?: boolean;
  /** Clicking the backdrop dismisses the dialog. Off for destructive flows. */
  dismissOnBackdrop?: boolean;
};

export function Dialog({
  open,
  onOpenChange,
  wide = false,
  dismissOnBackdrop = true,
  className,
  children,
  ...props
}: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // The browser closes a native <dialog> on Escape without going through
  // React, so mirror every close back into the caller's state or the two
  // fall out of step and the dialog can never be reopened.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleClose = () => onOpenChange(false);
    el.addEventListener('close', handleClose);
    return () => el.removeEventListener('close', handleClose);
  }, [onOpenChange]);

  return (
    <dialog
      ref={ref}
      onMouseDown={(event) => {
        // The backdrop is a pseudo-element of the dialog itself, so a click
        // outside the panel reports the dialog as its target.
        if (dismissOnBackdrop && event.target === event.currentTarget) onOpenChange(false);
      }}
      className={cn(
        'm-auto max-h-[90vh] w-full overflow-y-auto rounded-xl p-0',
        'bg-[var(--modal-bg)] text-[var(--ink)]',
        'shadow-[0_10px_40px_rgba(0,0,0,0.25)]',
        'backdrop:bg-[rgba(20,24,21,0.45)]',
        wide ? 'max-w-[640px]' : 'max-w-[480px]',
        className,
      )}
      {...props}
    >
      {children}
    </dialog>
  );
}

/** `.modal-header` - title row with a hairline rule under it. */
export function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between gap-3',
        'border-b border-[var(--border)] px-5 py-4',
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 className={cn('m-0 text-lg font-bold', className)} {...props} />;
}

/** Screen-reader description; pair with aria-describedby on <Dialog>. */
export function DialogDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('mt-1 text-[13.5px] text-[var(--muted)]', className)} {...props} />;
}

/** `.modal-body`. */
export function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-5', className)} {...props} />;
}

/** `.modal-footer` - right-aligned action row. */
export function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex shrink-0 justify-end gap-2.5 border-t border-[var(--border)] px-5 py-3.5',
        className,
      )}
      {...props}
    />
  );
}

/** `.modal-close` - the bare x in the header. */
export function DialogClose({ className, onClick, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClick}
      className={cn(
        'rounded-md border-0 bg-transparent p-1 leading-none text-[var(--muted)]',
        'hover:text-[var(--ink)]',
        'focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
        className,
      )}
      {...props}
    >
      <X className="size-[22px]" aria-hidden="true" />
    </button>
  );
}
