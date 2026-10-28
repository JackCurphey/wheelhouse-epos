import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Whether the screen is free for a pop-up that opens by itself ("Your till
 * PIN", whos-in-and-first-pin, review 28 Oct): no other pop-up open (any
 * `dialog[open]`), no sale open on the till, and nothing still deciding
 * whether to open its own pop-up (the float check while it loads). The till
 * says when a sale is open (`markSaleOpen`) and the float check holds the
 * screen while it loads (`useHoldScreen`); pop-ups are seen in the page itself.
 */
let saleOpen = false;
let holds = 0;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((l) => l());
export function markSaleOpen(open: boolean) {
  if (saleOpen === open) return;
  saleOpen = open;
  tell();
}
/** Holds the screen while `active`, so nothing opens by itself meanwhile. */
export function useHoldScreen(active: boolean) {
  useEffect(() => {
    if (!active) return undefined;
    holds += 1;
    tell();
    return () => { holds -= 1; tell(); };
  }, [active]);
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const anyDialogOpen = () => typeof document !== 'undefined' && document.querySelector('dialog[open]') !== null;

export function useScreenClear(): boolean {
  const sale = useSyncExternalStore(subscribe, () => saleOpen || holds > 0, () => false);
  const [dialog, setDialog] = useState(anyDialogOpen);
  useEffect(() => {
    const look = () => setDialog(anyDialogOpen());
    look();
    const watch = new MutationObserver(look);
    watch.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    return () => watch.disconnect();
  }, []);
  // Read the page again as well: a pop-up may have opened in the same moment.
  return !sale && !dialog && !anyDialogOpen();
}
