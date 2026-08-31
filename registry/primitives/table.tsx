import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Wheelhouse table primitive - the markup layer only. Data fetching, empty
 * and error states live in the data-table pattern that composes this.
 *
 * Visual parity with `table.data-table` in public/styles.css: 13.5px body,
 * uppercase muted headers over a 2px rule, 1px rules between rows.
 *
 * The scroll container is part of the primitive on purpose: EPOS tables are
 * wide (job sheets, stock takes) and must scroll inside their panel rather
 * than push the page sideways on a shop counter screen.
 */
export function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn('w-full border-collapse text-[13.5px] text-[var(--ink)]', className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn('', className)} {...props} />;
}

export function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('', className)} {...props} />;
}

export function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return <tfoot className={cn('font-semibold', className)} {...props} />;
}

export function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr className={cn('hover:bg-wh-hover-subtle', className)} {...props} />;
}

type CellProps = {
  /** Right-align and tabular-align the digits - `.num` in public/styles.css. */
  numeric?: boolean;
};

export function TableHead({ className, numeric, ...props }: React.ComponentProps<'th'> & CellProps) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap border-b-2 border-[var(--border)] px-2.5 py-[9px]',
        'text-left text-xs font-semibold uppercase tracking-[0.04em] text-[var(--muted)]',
        numeric && 'text-right',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, numeric, ...props }: React.ComponentProps<'td'> & CellProps) {
  return (
    <td
      className={cn(
        'border-b border-[var(--border)] px-2.5 py-[9px] align-middle',
        numeric && 'text-right tabular-nums',
        className,
      )}
      {...props}
    />
  );
}

export function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return <caption className={cn('sr-only', className)} {...props} />;
}
