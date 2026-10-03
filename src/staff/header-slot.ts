import { createContext } from 'react';

/**
 * The phone top bar's action slot, drawn by the staff frame
 * (staff-layout.tsx) and filled by a page through a portal, such as the
 * diary's "Waiting (n)" button (decision 68). Null until the frame is drawn,
 * and on pages with no frame.
 */
export const HeaderSlotContext = createContext<HTMLElement | null>(null);
