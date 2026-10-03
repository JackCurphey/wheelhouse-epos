/**
 * The rooms sidebar: the staff app's pages, grouped by the rooms of a shop so
 * people find things where they would stand (journey A,
 * docs/decisions/2026-09-29-app-map-review.md).
 *
 * Copied from ROOMS_DIARY in docs/design/user-journeys/generator/diary.mjs,
 * which drew every approved board; tests/screens/nav.test.js fails if the two
 * differ. Roles: O Owner, M Manager, S Staff, K Mechanic.
 *
 * A .ts file, not .tsx, so the tests can load it straight into Node.
 */
export type Role = 'O' | 'M' | 'S' | 'K';

export type IconName =
  | 'till' | 'orders' | 'bike' | 'customers' | 'mail' | 'today' | 'workshop'
  | 'stock' | 'purchasing' | 'check' | 'reports' | 'website' | 'settings';

export type NavItem = { key: string; label: string; icon: IconName; roles: string };
export type Room = { room: string; items: NavItem[] };

export const ROOMS: Room[] = [
  {
    room: 'Front desk',
    items: [
      { key: 'till', label: 'Till', icon: 'till', roles: 'OMS' },
      { key: 'orders', label: 'Online orders', icon: 'orders', roles: 'OMS' },
      { key: 'c2w', label: 'Cycle to Work', icon: 'bike', roles: 'OMS' },
      { key: 'customers', label: 'Customers', icon: 'customers', roles: 'OMS' },
      { key: 'messages', label: 'Messages', icon: 'mail', roles: 'OMS' },
    ],
  },
  {
    room: 'Workshop',
    items: [
      { key: 'diary', label: 'Diary', icon: 'today', roles: 'OMSK' },
      { key: 'overview', label: 'Overview', icon: 'workshop', roles: 'OMSK' },
    ],
  },
  {
    room: 'Stockroom',
    items: [
      { key: 'stock', label: 'Stock', icon: 'stock', roles: 'OMS' },
      { key: 'deliveries', label: 'Deliveries and orders', icon: 'purchasing', roles: 'OMS' },
      { key: 'stocktake', label: 'Stock take', icon: 'check', roles: 'OMS' },
    ],
  },
  {
    room: 'Office',
    items: [
      { key: 'today', label: 'Today', icon: 'reports', roles: 'OMS' },
      { key: 'reports', label: 'Reports', icon: 'reports', roles: 'OM' },
      { key: 'website', label: 'Website', icon: 'website', roles: 'OM' },
      { key: 'settings', label: 'Settings', icon: 'settings', roles: 'OM' },
    ],
  },
];

/** The rooms one role sees; a room with nothing in it is left out. */
export function roomsFor(role: Role): Room[] {
  return ROOMS
    .map((r) => ({ room: r.room, items: r.items.filter((i) => i.roles.includes(role)) }))
    .filter((r) => r.items.length > 0);
}

/** Each sidebar page opens at /workshop/<key>. */
export const NAV_ROUTES: Record<string, string> = Object.fromEntries(
  ROOMS.flatMap((r) => r.items.map((i) => [i.key, `/workshop/${i.key}`])),
);

/** A page's name, for its title: the sidebar label, or Your settings. */
export function pageLabel(key: string): string | undefined {
  if (key === 'your-settings') return 'Your settings';
  return ROOMS.flatMap((r) => r.items).find((i) => i.key === key)?.label;
}
