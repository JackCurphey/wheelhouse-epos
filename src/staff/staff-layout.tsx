import { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router';
import { apiMutate } from '@/lib/api/client.ts';
import { useSession, type SessionUser } from '@/lib/auth/use-session.ts';
import { NAV_ROUTES, pageLabel, roomsFor, type NavItem, type Role } from './nav.ts';
import { NavIcon } from './nav-icon.tsx';
import { HeaderSlotContext } from './header-slot.ts';

/**
 * The frame every staff page sits in (journey A; Workshop day decision 68):
 * the charcoal rooms sidebar on a computer, the icon rail on a tablet, and
 * the top bar with a menu on a phone. Drawn by shellDesktop, shellTablet and
 * shellPhone in docs/design/user-journeys/generator/diary.mjs.
 * Spec: docs/superpowers/specs/2026-10-03-staff-shell-design.md
 *
 * Roles: the server only says whether someone is the Owner (there is no
 * Manager role yet, and mechanics are not marked in /api/auth/me), so the
 * Owner sees every room and everyone else sees the Staff rooms.
 */
function roleOf(user: SessionUser): { role: Role; roleName: string } {
  return user.isOwner ? { role: 'O', roleName: 'Owner' } : { role: 'S', roleName: 'Staff' };
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

const ITEM_ON = 'bg-[var(--sidebar-primary)] font-bold shadow-[inset_3px_0_0_var(--wh-highlight)]';

function SideItem({ item, onPick }: { item: NavItem; onPick?: () => void }) {
  return (
    <NavLink
      to={NAV_ROUTES[item.key]}
      onClick={onPick}
      className={({ isActive }) =>
        `flex min-h-[30px] items-center gap-3 rounded-md px-3 text-sm font-medium text-[var(--sidebar-foreground)] no-underline hover:bg-[var(--sidebar-accent)] ${isActive ? ITEM_ON : ''}`
      }
    >
      <NavIcon name={item.icon} />
      <span>{item.label}</span>
    </NavLink>
  );
}

function RoomList({ role, onPick }: { role: Role; onPick?: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      {roomsFor(role).map((r) => (
        <div key={r.room} className="flex flex-col gap-0.5">
          <div className="px-3 py-0.5 text-[11px] font-bold tracking-[1px] uppercase opacity-70">{r.room}</div>
          {r.items.map((i) => (
            <SideItem key={i.key} item={i} onPick={onPick} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ShopBlock({ name }: { name: string }) {
  // One shop: its name, and no switcher (Multiple sites audit M4).
  return (
    <div className="flex min-h-10 flex-col justify-center rounded-lg bg-[var(--wh-on-accent)]/10 px-3 py-1.5 text-sm font-semibold">
      {name}
    </div>
  );
}

function Footer({ user, roleName, onPick }: { user: SessionUser; roleName: string; onPick?: () => void }) {
  async function signOut() {
    try {
      await apiMutate('/api/auth/logout', {});
    } finally {
      window.location.assign('/');
    }
  }
  return (
    <div className="flex items-center gap-1.5 border-t border-[var(--wh-on-accent)]/20 pt-2">
      <NavLink
        to="/workshop/your-settings"
        onClick={onPick}
        aria-label={`Your settings — ${user.name}, ${roleName}`}
        title="Your settings"
        className="flex min-h-11 min-w-0 grow items-center gap-2.5 rounded-lg px-2 py-1 text-[var(--sidebar-foreground)] no-underline hover:bg-[var(--sidebar-accent)]"
      >
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--wh-on-accent)]/20 text-xs font-bold">
          {initials(user.name)}
        </span>
        <span className="flex min-w-0 grow flex-col">
          <span className="truncate text-sm font-semibold">{user.name}</span>
          <span className="text-xs opacity-80">{roleName}</span>
        </span>
        <span className="inline-flex opacity-80">
          <NavIcon name="settings" size={16} />
        </span>
      </NavLink>
      <button
        type="button"
        onClick={signOut}
        className="inline-flex min-h-11 shrink-0 items-center rounded-md px-1.5 text-[13px] whitespace-nowrap text-[var(--sidebar-foreground)] underline hover:bg-[var(--sidebar-accent)]"
      >
        Sign out
      </button>
    </div>
  );
}

function Wordmark() {
  // No official Wheelhouse logo file exists yet, so no mark is drawn.
  return <span className="px-1.5 py-1 text-[17px] font-bold">Wheelhouse</span>;
}

function RailItem({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={NAV_ROUTES[item.key]}
      className={({ isActive }) =>
        `flex min-h-[46px] flex-col items-center justify-center gap-0.5 rounded-lg px-[3px] py-1 text-[var(--sidebar-foreground)] no-underline hover:bg-[var(--sidebar-accent)] ${isActive ? ITEM_ON : ''}`
      }
    >
      <NavIcon name={item.icon} size={19} />
      <span className="text-center text-xs leading-tight">{item.label}</span>
    </NavLink>
  );
}

function PhoneMenu({ user, shopName, role, roleName, onClose }: {
  user: SessionUser; shopName: string; role: Role; roleName: string; onClose: (returnFocus: boolean) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose(true);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 md:hidden">
      {/* The dimmed page: tapping it closes the menu, as Close and Escape do. */}
      <div aria-hidden="true" className="absolute inset-0 bg-[var(--wh-backdrop)]" onClick={() => onClose(true)} />
      <nav
        aria-label="Main"
        className="absolute inset-y-0 left-0 flex w-[300px] flex-col gap-3.5 overflow-y-auto bg-[var(--sidebar)] p-3 text-[var(--sidebar-foreground)]"
      >
        <div className="flex items-center gap-2.5">
          <span className="grow">
            <Wordmark />
          </span>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close menu"
            onClick={() => onClose(true)}
            className="inline-flex size-11 items-center justify-center rounded-lg text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]"
          >
            <NavIcon name="close" size={20} />
          </button>
        </div>
        <ShopBlock name={shopName} />
        <RoomList role={role} onPick={() => onClose(false)} />
        <div className="grow" />
        <Footer user={user} roleName={roleName} onPick={() => onClose(false)} />
      </nav>
    </div>
  );
}

function SignedOut() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-3 p-8">
      <p>You&apos;re signed out.</p>
      <a href="/" className="font-semibold text-[var(--wh-ink)] underline">
        Sign in
      </a>
    </main>
  );
}

/** The key of the sidebar page at this address, e.g. "diary". */
function pageKey(pathname: string): string {
  return pathname.replace(/^\/workshop\/?/, '').split('/')[0];
}

export function StaffLayout() {
  const session = useSession();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  if (session.status === 'loading') return <p className="p-8">Loading…</p>;
  if (session.status === 'signed-out') return <SignedOut />;
  if (session.status === 'error') {
    return (
      <div role="alert" className="p-8">
        <p>Wheelhouse couldn&apos;t check who is signed in. Try again in a moment.</p>
      </div>
    );
  }

  const { user, shop } = session;
  const { role, roleName } = roleOf(user);
  const title = pageLabel(pageKey(pathname)) ?? '';
  const closeMenu = (returnFocus: boolean) => {
    setMenuOpen(false);
    if (returnFocus) menuButton.current?.focus();
  };

  return (
    <div className="flex min-h-screen bg-[var(--wh-bg)] text-[var(--wh-ink)]">
      {/* Computer: the rooms sidebar. */}
      <nav
        aria-label="Main"
        className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-3 overflow-y-auto bg-[var(--sidebar)] px-3 py-3.5 text-[var(--sidebar-foreground)] lg:flex"
      >
        <Wordmark />
        <ShopBlock name={shop.name} />
        <RoomList role={role} />
        <div className="grow" />
        <Footer user={user} roleName={roleName} />
      </nav>
      {/* Tablet: the icon rail, a label under every icon (decision 68). */}
      <nav
        aria-label="Main"
        className="sticky top-0 hidden h-screen w-[84px] shrink-0 flex-col gap-1.5 overflow-y-auto bg-[var(--sidebar)] px-1.5 py-2 text-[var(--sidebar-foreground)] md:flex lg:hidden"
      >
        {roomsFor(role).map((r, i) => (
          <div key={r.room} className={`flex flex-col gap-px ${i ? 'border-t border-[var(--wh-on-accent)]/20 pt-[3px]' : ''}`}>
            {r.items.map((item) => (
              <RailItem key={item.key} item={item} />
            ))}
          </div>
        ))}
        <div className="grow" />
        <NavLink
          to="/workshop/your-settings"
          aria-label={`Your settings — ${user.name}, ${roleName}`}
          className="flex min-h-11 items-center justify-center text-[var(--sidebar-foreground)] no-underline"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--wh-on-accent)]/20 text-xs font-bold">
            {initials(user.name)}
          </span>
        </NavLink>
      </nav>
      <div className="flex min-w-0 grow flex-col">
        {/* One header: on a phone the charcoal top bar with the menu button;
            on a tablet or computer the page title on the panel. */}
        <header className="flex h-14 shrink-0 items-center gap-1.5 bg-[var(--sidebar)] px-1.5 text-[var(--sidebar-foreground)] md:h-[60px] md:gap-4 md:border-b md:border-[var(--wh-border)] md:bg-[var(--wh-panel)] md:px-[22px] md:text-[var(--wh-ink)] lg:h-16 lg:px-7">
          <button
            ref={menuButton}
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] md:hidden"
          >
            <NavIcon name="menu" size={22} />
          </button>
          <h1 className="m-0 min-w-0 grow truncate text-lg font-bold md:text-xl">{title}</h1>
          {/* A page can put its own phone actions here (the diary's Waiting button). */}
          <div ref={setHeaderSlot} className="flex shrink-0 items-center gap-1.5 md:hidden" />
        </header>
        <main className="min-h-0 grow p-3.5 md:px-[22px] md:py-4 lg:px-7 lg:py-[18px]">
          <HeaderSlotContext.Provider value={headerSlot}>
            <Outlet />
          </HeaderSlotContext.Provider>
        </main>
      </div>
      {menuOpen ? (
        <PhoneMenu user={user} shopName={shop.name} role={role} roleName={roleName} onClose={closeMenu} />
      ) : null}
    </div>
  );
}

/** /workshop on its own: where each person lands (decision A11). */
export function Landing() {
  const session = useSession();
  if (session.status !== 'signed-in') return null;
  return <Navigate replace to={session.user.isOwner ? NAV_ROUTES.today : NAV_ROUTES.till} />;
}
