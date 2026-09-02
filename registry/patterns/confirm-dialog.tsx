import * as React from 'react';

import { Button } from '@/registry/primitives/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/registry/primitives/dialog';

/**
 * Confirm dialog - the replacement for the native window.confirm() the
 * vanilla app calls before destructive actions.
 *
 * Why replace it: confirm() blocks the whole page, cannot be styled or
 * translated, cannot say what is about to happen in more than one line, and
 * on a shop-counter kiosk browser it can be suppressed entirely, which turns
 * "are you sure you want to void this sale?" into a silent yes.
 *
 * Destructive confirmations do not dismiss on a backdrop click - a stray tap
 * on a busy counter must not count as an answer either way.
 */

export type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Paints the confirm button red. Use for voids, refunds and deletions. */
  destructive?: boolean;
};

export type ConfirmDialogProps = ConfirmOptions & {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Disables both buttons while the confirmed action is in flight. */
  busy?: boolean;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
      dismissOnBackdrop={!destructive}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <DialogHeader>
        <DialogTitle id={titleId}>{title}</DialogTitle>
        <DialogClose onClick={onCancel} disabled={busy} />
      </DialogHeader>
      {description ? (
        <DialogBody>
          <p id={descriptionId} className="m-0 text-sm text-[var(--ink)]">
            {description}
          </p>
        </DialogBody>
      ) : null}
      <DialogFooter>
        <Button onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'danger' : 'accent'}
          onClick={onConfirm}
          disabled={busy}
          autoFocus={!destructive}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

type PendingConfirm = {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
};

/**
 * Promise-based confirm, so a call site reads the way the confirm() it
 * replaces did:
 *
 *   const { confirm, confirmDialog } = useConfirmDialog();
 *   ...
 *   if (await confirm({ title: 'Void this sale?', destructive: true })) void();
 *   ...
 *   return <>{table}{confirmDialog}</>;
 *
 * Self-contained on purpose - no context provider, so a single screen can
 * adopt it without the whole app being converted first.
 */
export function useConfirmDialog() {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null);

  const confirm = React.useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending((current) => {
          // A second confirm while one is open answers the first as
          // cancelled rather than stranding its promise forever.
          current?.resolve(false);
          return { options, resolve };
        });
      }),
    [],
  );

  const settle = React.useCallback((confirmed: boolean) => {
    setPending((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  const confirmDialog = (
    <ConfirmDialog
      open={pending !== null}
      title={pending?.options.title ?? ''}
      description={pending?.options.description}
      confirmLabel={pending?.options.confirmLabel}
      cancelLabel={pending?.options.cancelLabel}
      destructive={pending?.options.destructive}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, confirmDialog };
}
