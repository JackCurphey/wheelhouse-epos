import * as React from 'react';

import { Button } from '@/registry/primitives/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/registry/primitives/table';
import { cn } from '@/lib/utils';

/**
 * Shop-scoped data table.
 *
 * Every list in Wheelhouse shows one shop's rows. Scoping is enforced on the
 * server by PostgreSQL row-level security, so this component never filters by
 * shop itself - what it does is make the scope legible: the caller passes the
 * name of the thing being listed and the empty and error copy says which
 * shop's list is empty or failed, rather than the ambiguous "No results".
 *
 * The three non-happy states are part of the component, not an afterthought
 * left to each caller: loading, failed, and genuinely empty read differently
 * to staff and must never collapse into one blank table.
 */

export type DataTableColumn<Row> = {
  /** Stable key for this column; also the React key for its cells. */
  key: string;
  header: React.ReactNode;
  cell: (row: Row) => React.ReactNode;
  /** Right-align and tabular-align - use for money, counts and dates. */
  numeric?: boolean;
  className?: string;
};

export type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[];
  /** The shop's rows. Undefined means "not loaded yet". */
  rows: Row[] | undefined;
  rowKey: (row: Row) => React.Key;
  /** Plural name of what is listed, e.g. "jobs", "stock items". */
  scopeLabel: string;
  loading?: boolean;
  /** Message from the failed request; null or undefined when it succeeded. */
  error?: string | null;
  /** Retry handler. Omit it and the error state shows no retry control. */
  onRetry?: () => void;
  onRowClick?: (row: Row) => void;
  /** Overrides the default "No {scopeLabel} for this shop yet." copy. */
  emptyMessage?: React.ReactNode;
  className?: string;
};

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  scopeLabel,
  loading = false,
  error = null,
  onRetry,
  onRowClick,
  emptyMessage,
  className,
}: DataTableProps<Row>) {
  const isLoading = loading || rows === undefined;
  const isEmpty = !isLoading && !error && rows.length === 0;

  return (
    <div className={cn('w-full', className)}>
      {/* `.error-banner` - sits above the table so the previously loaded
          rows, if any, stay on screen behind the failure. */}
      {error ? (
        <div
          role="alert"
          className="mb-3.5 flex items-center justify-between gap-3 rounded-lg bg-[var(--danger-bg)] px-3.5 py-2.5 text-[13.5px] text-[var(--danger)]"
        >
          <span>
            Could not load {scopeLabel} for this shop. {error}
          </span>
          {onRetry ? (
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}

      <Table>
        <TableCaption>{scopeLabel} for this shop</TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead key={column.key} numeric={column.numeric} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="px-5 py-10 text-center text-[var(--muted)]"
              >
                Loading {scopeLabel}…
              </TableCell>
            </TableRow>
          ) : null}

          {isEmpty ? (
            /* `.empty-state` */
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="px-5 py-10 text-center text-[var(--muted)]"
              >
                {emptyMessage ?? `No ${scopeLabel} for this shop yet.`}
              </TableCell>
            </TableRow>
          ) : null}

          {!isLoading && rows
            ? rows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} numeric={column.numeric} className={column.className}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : null}
        </TableBody>
      </Table>
    </div>
  );
}
