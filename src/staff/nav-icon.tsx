import type { ReactNode } from 'react';
import type { IconName } from './nav.ts';

/**
 * The sidebar's stroke icons: the same 24-unit paths the approved drawings
 * use (P in docs/design/user-journeys/generator/ui.mjs), so the app matches
 * them exactly. Decorative: every icon sits beside its text label.
 */
const PATHS: Record<IconName | 'menu' | 'close', string[]> = {
  today: ['M3 12l9-9 9 9', 'M5 10v10h14V10'],
  till: ['M7 20h10M12 16v4'],
  workshop: ['M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z'],
  orders: ['M6 2l-2 4v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4z', 'M4 6h16M16 10a4 4 0 0 1-8 0'],
  stock: ['M21 8l-9-5-9 5 9 5 9-5z', 'M3 8v8l9 5 9-5V8', 'M12 13v8'],
  purchasing: ['M3 7h11v10H3zM14 10h4l3 3v4h-7z'],
  customers: ['M2 21a7 7 0 0 1 14 0', 'M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3'],
  reports: ['M4 20V10M10 20V4M16 20v-7M22 20H2'],
  website: ['M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18'],
  settings: ['M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15.1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.2V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
  mail: ['M3 7l9 6 9-6'],
  bike: ['M5.5 16l4-7h6l3 7M9.5 9l3 7h-7M15 6h2.5'],
  check: ['M5 12l5 5L20 7'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  close: ['M6 6l12 12M18 6L6 18'],
};

// The shapes P draws as <rect>/<circle> rather than paths.
const EXTRA: Partial<Record<IconName, ReactNode>> = {
  till: <rect x="3" y="4" width="18" height="12" rx="2" />,
  purchasing: (
    <>
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  customers: <circle cx="9" cy="8" r="4" />,
  website: <circle cx="12" cy="12" r="9" />,
  settings: <circle cx="12" cy="12" r="3" />,
  mail: <rect x="3" y="5" width="18" height="14" rx="2" />,
  bike: (
    <>
      <circle cx="5.5" cy="16" r="3.5" />
      <circle cx="18.5" cy="16" r="3.5" />
    </>
  ),
};

export function NavIcon({ name, size = 18 }: { name: IconName | 'menu' | 'close'; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {name in EXTRA ? EXTRA[name as IconName] : null}
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
