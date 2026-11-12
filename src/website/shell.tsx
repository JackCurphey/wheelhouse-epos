import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Menu, Search, ShoppingBasket, Store, User, X } from 'lucide-react';
import { ApiError } from '@/lib/api/client.ts';
import { cn } from '@/lib/utils';
import { bookPath, chosenShopCookie, siteAddress } from './address.ts';
import { SiteContext, useSite, useSiteContext, type ShopEntry, type Site, type SiteContextValue } from './site-query.ts';
import { H1 } from './parts.tsx';
import { CookieChoices, CookieChoicesButton } from './cookies.tsx';
import { StaffBanner } from './staff-banner.tsx';

/**
 * The customer website's frame (openspec/changes/website-browse, design 3;
 * screens site, site-menu, site-ocean and site-ocean-menu in app-map.mjs, and
 * the frame in browse.mjs): skip link, the shop's name, the menu, search, the
 * collect-from chip, Account, Basket and the footer, around every page.
 *
 * A switched-off or unknown shop answers 404 and gets wb-off, a plain page
 * with no frame. Soft sand's own charcoal (or no colour) is the default look;
 * any other main colour gives the drawn "ocean" look: the header in that
 * colour, white text, a white page, and Book a repair as a white button at
 * the end of the header instead of in the menu.
 */

/** Soft sand's own charcoal, as server/website.js stores it: a shop that never chose a colour. */
const SOFT_SAND_CHARCOAL = '#' + '2A2822';
/** White, the text on a main-colour fill (the theme's own token). */
const WHITE = 'var(--wh-on-brand)';

function useMedia(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
    mq?.addEventListener('change', onChange);
    return () => mq?.removeEventListener('change', onChange);
  }, [query]);
  return useSyncExternalStore(subscribe, () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false));
}

export const oceanColour = (site: Site): string | null =>
  site.mainColour && site.mainColour.toUpperCase() !== SOFT_SAND_CHARCOAL ? site.mainColour : null;

/** "Bolton", "Bolton and [Second site]", or "A, B and C". */
export function shopNames(shops: ShopEntry[]): string {
  const names = shops.map((s) => s.name);
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** wb-off: the same page for a switched-off, unknown or Shopify-kind shop. */
export function SiteOff() {
  useEffect(() => { document.title = 'This website isn’t available'; }, []);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white p-6 text-center text-[var(--wh-ink)]">
      <H1>This website isn’t available</H1>
      <p className="m-0 text-size-17 text-[var(--wh-muted)]">Check the address, or contact the shop another way.</p>
    </main>
  );
}

/** The site itself couldn't be read: the server's words and a way to ask again. */
export function SiteFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center text-[var(--wh-ink)]">
      <H1>Something went wrong — try again</H1>
      <button type="button" onClick={onRetry} className="min-h-11 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-4 text-size-15 font-semibold">
        Try again
      </button>
    </main>
  );
}

/** The route layout: reads the site, then frames the page. */
export function SiteLayout() {
  const address = useMemo(() => siteAddress(), []);
  const site = useSite(address);
  if (site.error) {
    if (site.error instanceof ApiError && site.error.status === 404) return <SiteOff />;
    return <SiteFailed onRetry={() => { void site.refetch(); }} />;
  }
  if (!site.data) return null;
  const several = site.data.shops.length > 1;
  const cookieId = chosenShopCookie();
  const chosen = several ? (site.data.shops.find((s) => s.id === cookieId) ?? null) : (site.data.shops[0] ?? null);
  const value: SiteContextValue = { address, site: site.data, chosen, several };
  return (
    <SiteContext.Provider value={value}>
      <CookieChoices>
        <Frame />
      </CookieChoices>
    </SiteContext.Provider>
  );
}

const iconLink = 'inline-flex size-11 items-center justify-center rounded-lg';

/** The collect-from chip (browse.mjs): leads to Our shops until choosing a shop comes (pull request 7). */
function Chip({ line }: { line: boolean }) {
  const { site, chosen } = useSiteContext();
  const label = chosen ? `Collecting from ${site.name}, ${chosen.name} — change the shop` : 'Choose a shop to collect from';
  if (line) {
    // The narrow line (browse.mjs chipLine) names itself with its own words.
    return (
      <Link to="/shops" className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3 text-size-15 text-[var(--wh-ink)] no-underline">
        <Store aria-hidden className="size-4" />
        <span className="grow">{chosen ? <>Collecting from <strong>{chosen.name}</strong></> : <strong>Choose a shop to collect from</strong>}</span>
        {chosen && <span className="font-semibold underline">Change</span>}
      </Link>
    );
  }
  return (
    <Link to="/shops" aria-label={label} className="inline-flex min-h-11 max-w-[230px] shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg border border-[var(--wh-border)] px-2.5 text-[14px] no-underline" style={{ color: 'inherit' }}>
      <Store aria-hidden className="size-4 shrink-0" />
      <span className="truncate">{chosen ? <>Collecting from <strong>{chosen.name}</strong> · Change</> : <strong>Choose a shop</strong>}</span>
    </Link>
  );
}

function Frame() {
  const { address, site, chosen, several } = useSiteContext();
  const phone = useMedia('(max-width: 767px)');
  const narrow = useMedia('(max-width: 1023px)');
  const ocean = oceanColour(site);
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLElement>(null);
  const location = useLocation();
  const first = useRef(true);

  // A new page: close the menu and move focus to the page, as a full page load would.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setOpen(false);
    main.current?.focus();
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const book = bookPath(address, several && chosen ? chosen.id : null);
  const shopsLabel = several ? 'Our shops' : 'Find us';
  const navItem = ({ isActive }: { isActive: boolean }) =>
    cn('inline-flex min-h-11 items-center px-1 text-size-15 font-semibold', isActive ? 'underline underline-offset-4' : 'no-underline');
  const linkColour = { color: 'inherit' };
  const bookButton = ocean ? (
    <a href={book} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-4 text-size-15 font-semibold no-underline" style={{ backgroundColor: WHITE, color: ocean }}>
      Book a repair
    </a>
  ) : null;

  const name = (
    <Link to="/" className="inline-flex min-h-11 min-w-0 items-center gap-2.5 text-[18px] font-bold no-underline md:text-[20px]" style={linkColour}>
      {site.logo && <img src={site.logo} alt="" className="h-9 w-auto max-w-[120px] object-contain" />}
      <span className="truncate">{site.name}</span>
    </Link>
  );

  const rootStyle = ocean ? ({ '--accent': ocean, '--accent-dark': ocean, backgroundColor: WHITE } as React.CSSProperties) : undefined;
  const headerStyle = ocean ? { backgroundColor: ocean, color: WHITE } : undefined;
  const headerClass = cn(
    'flex items-center gap-3 border-b px-4 py-2 md:gap-5 md:px-8',
    ocean ? 'border-transparent' : 'border-[var(--wh-border)] bg-[var(--wh-panel)] text-[var(--wh-ink)]',
  );

  return (
    <div className="flex min-h-screen flex-col bg-[var(--wh-bg)] text-[var(--wh-ink)]" style={rootStyle}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-[var(--wh-panel)] focus:p-3 focus:text-[var(--wh-ink)]">
        Skip to the main content
      </a>
      {phone ? (
        <header className={headerClass} style={headerStyle}>
          {name}
          <span className="ml-auto flex items-center gap-1">
            <button type="button" aria-label="Search the shop" className={iconLink}><Search aria-hidden className="size-5" /></button>
            <Link to="/basket" aria-label="Basket, 0 items" className={iconLink} style={linkColour}><ShoppingBasket aria-hidden className="size-5" /></Link>
            <button
              ref={menuButton}
              type="button"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              aria-controls="site-menu"
              onClick={() => setOpen((o) => !o)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-current px-3 text-size-15 font-semibold"
            >
              {open ? <X aria-hidden className="size-4" /> : <Menu aria-hidden className="size-4" />}
              Menu
            </button>
          </span>
        </header>
      ) : (
        <header className={headerClass} style={headerStyle}>
          {name}
          <nav aria-label="Website" className="flex items-center gap-4">
            <NavLink to="/shop" className={navItem} style={linkColour}>Shop</NavLink>
            {!ocean && <a href={book} className={navItem({ isActive: false })} style={linkColour}>Book a repair</a>}
            <NavLink to="/shops" className={navItem} style={linkColour}>{shopsLabel}</NavLink>
          </nav>
          <span className="ml-auto flex items-center gap-2 md:gap-3">
            {!narrow && several && <Chip line={false} />}
            {narrow ? (
              <button type="button" aria-label="Search the shop" className={iconLink}><Search aria-hidden className="size-5" /></button>
            ) : (
              <label role="search" className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--wh-input-border)] bg-white px-3 text-[var(--wh-ink)]">
                <Search aria-hidden className="size-4 text-[var(--wh-muted)]" />
                <input type="search" aria-label="Search the shop" placeholder={several ? 'Search' : 'Search the shop'} className="w-44 bg-transparent text-size-15 outline-none" />
              </label>
            )}
            <a href={`/book/${encodeURIComponent(address.slug)}/account`} aria-label="Your account" className={narrow ? iconLink : 'inline-flex min-h-11 items-center gap-1.5 text-size-15 font-semibold no-underline'} style={linkColour}>
              <User aria-hidden className="size-5" />{!narrow && 'Account'}
            </a>
            <Link to="/basket" aria-label="Basket, 0 items" className={narrow ? iconLink : 'inline-flex min-h-11 items-center gap-1.5 text-size-15 font-semibold no-underline'} style={linkColour}>
              <ShoppingBasket aria-hidden className="size-5" />{!narrow && 'Basket'}
            </Link>
          </span>
          {bookButton}
        </header>
      )}
      {phone && open && (
        <nav id="site-menu" aria-label="Website" className="flex flex-col border-b border-[var(--wh-border)] bg-[var(--wh-panel)] px-4 py-2">
          {ocean && (
            <a href={book} onClick={() => setOpen(false)} className="mb-2 flex min-h-[52px] items-center justify-center rounded-lg text-size-17 font-semibold text-white no-underline" style={{ backgroundColor: ocean }}>
              Book a repair
            </a>
          )}
          <MenuRow to="/shop" onPick={() => setOpen(false)}>Shop</MenuRow>
          {!ocean && <a href={book} onClick={() => setOpen(false)} className={menuRow}>Book a repair</a>}
          <MenuRow to="/shops" onPick={() => setOpen(false)}>{shopsLabel}</MenuRow>
          <a href={`/book/${encodeURIComponent(address.slug)}/account`} onClick={() => setOpen(false)} className={menuRow}>Account</a>
        </nav>
      )}
      <main id="main-content" ref={main} tabIndex={-1} className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 py-5 outline-none md:gap-9 md:px-8 md:py-8">
        <StaffBanner />
        {narrow && several && <Chip line />}
        <Outlet />
      </main>
      <footer className="flex flex-col gap-3 border-t border-[var(--wh-border)] bg-[var(--wh-panel)] px-4 py-5 text-size-15 md:flex-row md:items-center md:justify-between md:px-8">
        <span>{site.name} · {shopNames(site.shops)}</span>
        <span className="flex flex-col md:flex-row md:gap-5">
          <Link to="/contact" className={footerLink}>Contact us</Link>
          <Link to="/collection-returns" className={footerLink}>Collection and returns</Link>
          <Link to="/privacy" className={footerLink}>Privacy</Link>
          <Link to="/cookies" className={footerLink}>Cookies</Link>
          <CookieChoicesButton className={footerLink} />
        </span>
      </footer>
    </div>
  );
}

const footerLink = 'inline-flex min-h-11 items-center text-[var(--wh-ink)]';
const menuRow = 'flex min-h-[52px] items-center border-b border-[var(--wh-border)] text-size-17 font-semibold text-[var(--wh-ink)] no-underline last:border-b-0';

function MenuRow({ to, onPick, children }: { to: string; onPick: () => void; children: React.ReactNode }) {
  return <NavLink to={to} onClick={onPick} className={menuRow}>{children}</NavLink>;
}
