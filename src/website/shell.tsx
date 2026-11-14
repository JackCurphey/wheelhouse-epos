import * as React from 'react';
import { flushSync } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Menu, Search, ShoppingBasket, Store, User, X } from 'lucide-react';
import { ApiError } from '@/lib/api/client.ts';
import { cn } from '@/lib/utils';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { bookPath, chosenShopCookie, rememberChosenShop, siteAddress } from './address.ts';
import { basketCount, readBasket, writeBasket, type BasketLine } from './basket.ts';
import { SiteContext, hasDetails, useBasket, useSite, useSiteContext, type ShopEntry, type Site, type SiteContextValue } from './site-query.ts';
import { H1, todayText } from './parts.tsx';
import { SearchCombo } from './search.tsx';
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

/** Whether a media query matches, kept up to date; '(max-width: 767px)' is a phone. */
export function useMedia(query: string): boolean {
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
  // The wh_shop cookie as read once, then as the visitor chooses (design 4).
  const [cookieId, setCookieId] = useState(() => chosenShopCookie());
  // The wh_basket cookie as read once, then as the visitor changes it (task 11.5).
  const [basket, setBasketLines] = useState(() => readBasket());
  const setBasket = useCallback((lines: BasketLine[]) => {
    writeBasket(lines, address);
    setBasketLines(lines);
  }, [address]);
  // "Which shop will you collect from?": the control that opened it, and what to do once one is chosen, while open.
  const [opener, setOpener] = useState<{ el: HTMLElement; onChosen?: (id: number) => void } | null>(null);
  const choose = useCallback((id: number) => {
    rememberChosenShop(id, address);
    setCookieId(id);
  }, [address]);
  const openChooser = useCallback((el: HTMLElement, onChosen?: (id: number) => void) => setOpener({ el, onChosen }), []);
  // Closing, with or without a choice: focus goes back to what opened the box.
  const closeChooser = useCallback((id?: number) => {
    const back = opener?.el;
    flushSync(() => {
      if (id !== undefined) {
        choose(id);
        opener?.onChosen?.(id);
      }
      setOpener(null);
    });
    if (back?.isConnected) back.focus();
    else document.getElementById('main-content')?.focus();
  }, [opener, choose]);
  if (site.error) {
    if (site.error instanceof ApiError && site.error.status === 404) return <SiteOff />;
    return <SiteFailed onRetry={() => { void site.refetch(); }} />;
  }
  if (!site.data) return null;
  const several = site.data.shops.length > 1;
  // A remembered shop the business doesn't have is ignored: Choose a shop again.
  const chosen = several ? (site.data.shops.find((s) => s.id === cookieId) ?? null) : (site.data.shops[0] ?? null);
  const value: SiteContextValue = { address, site: site.data, chosen, several, choose, openChooser, basket, setBasket };
  return (
    <SiteContext.Provider value={value}>
      <CookieChoices>
        <Frame />
      </CookieChoices>
      {several && opener && <ChooseShop shops={site.data.shops} adding={!!opener.onChosen} onClose={closeChooser} />}
    </SiteContext.Provider>
  );
}

/**
 * wb-choose-shop, "Choosing the shop: one tap" (browse.mjs `chooseShop`, the
 * popup pattern): a button per shop, tapping one chooses it and closes the
 * box; Cancel, Close and Esc leave the choice as it was. Opened by Add to
 * basket, it says it will add the item too (on-choose-shop). The shared address
 * and today's hours are on the first shop only (Jack's answer 1). Full screen
 * on a phone, 520px wide above.
 */
function ChooseShop({ shops, adding, onClose }: { shops: ShopEntry[]; adding: boolean; onClose: (id?: number) => void }) {
  const titleId = React.useId();
  const subId = React.useId();
  return (
    <Dialog
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      aria-labelledby={titleId}
      aria-describedby={subId}
      aria-modal="true"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
      className="m-0 flex h-dvh max-h-none w-screen max-w-none flex-col rounded-none bg-[var(--wh-bg)] md:m-auto md:h-auto md:max-h-[90vh] md:w-[520px] md:max-w-[90vw] md:rounded-xl md:border md:border-[var(--wh-border)]"
    >
      <div className="flex items-center gap-3 border-b border-[var(--wh-border)] bg-[var(--wh-panel)] py-2.5 pl-4 pr-2 md:py-3.5 md:pl-[22px] md:pr-3.5">
        <div className="flex grow flex-col gap-0.5">
          <h2 id={titleId} className="m-0 text-[18px] font-bold md:text-[20px]">Which shop will you collect from?</h2>
          <span id={subId} className="text-size-13 text-[var(--wh-muted)]">
            {adding ? 'We’ll add it to your basket, remember the shop, and show when things are ready there' : 'We’ll remember it, and show when things are ready there'}
          </span>
        </div>
        <button type="button" aria-label="Close" onClick={() => onClose()} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent text-[var(--wh-ink)]">
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="min-h-0 grow overflow-y-auto p-4 md:px-[22px] md:py-5">
        <div role="group" aria-labelledby={titleId} className="flex flex-col gap-2.5">
          {shops.map((shop) => {
            const line = hasDetails(shop) ? [shop.address, todayText(shop)].filter(Boolean).join(' · ') : '';
            return (
              <button
                key={shop.id}
                type="button"
                onClick={() => onClose(shop.id)}
                className="flex min-h-16 w-full flex-col items-start gap-[3px] rounded-[10px] border border-[var(--wh-border)] bg-[var(--wh-panel)] p-3.5 text-left text-[var(--wh-ink)]"
              >
                <span className="text-[16px] font-bold">{shop.name}</span>
                {line && <span className="text-[14px] text-[var(--wh-muted)]">{line}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex justify-between gap-2.5 border-t border-[var(--wh-border)] bg-[var(--wh-panel)] px-4 pb-4 pt-3 md:px-[22px] md:py-3.5">
        <Button variant="ghost" className="min-h-11 text-size-15" onClick={() => onClose()}>Cancel</Button>
      </div>
    </Dialog>
  );
}

const iconLink = 'inline-flex size-11 items-center justify-center rounded-lg';

/**
 * How many things are in the basket: the server's count when it has priced
 * these lines (a line cut to the stock left counts as cut), else the cookie's.
 */
function useBasketCount(): number {
  const { address, chosen, basket } = useSiteContext();
  const priced = useBasket(address, chosen?.id ?? null, basket, false);
  return priced.data?.count ?? basketCount(basket);
}

/** The collect-from chip (browse.mjs): opens "Which shop will you collect from?" (wb-choose-shop). */
function Chip({ line }: { line: boolean }) {
  const { site, chosen, openChooser } = useSiteContext();
  const label = chosen ? `Collecting from ${site.name}, ${chosen.name} — change the shop` : 'Choose a shop to collect from';
  if (line) {
    // The narrow line (browse.mjs chipLine) names itself with its own words.
    return (
      <button type="button" onClick={(e) => openChooser(e.currentTarget)} className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-[var(--wh-border)] bg-[var(--wh-panel)] px-3 text-left text-size-15 text-[var(--wh-ink)]">
        <Store aria-hidden className="size-4" />
        <span className="grow">{chosen ? <>Collecting from <strong>{chosen.name}</strong></> : <strong>Choose a shop to collect from</strong>}</span>
        {chosen && <span className="font-semibold underline">Change</span>}
      </button>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={(e) => openChooser(e.currentTarget)} className="inline-flex min-h-11 max-w-[230px] shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg border border-[var(--wh-border)] bg-transparent px-2.5 text-[14px]" style={{ color: 'inherit' }}>
      <Store aria-hidden className="size-4 shrink-0" />
      <span className="truncate">{chosen ? <>Collecting from <strong>{chosen.name}</strong> · Change</> : <strong>Choose a shop</strong>}</span>
    </button>
  );
}

function Frame() {
  const { address, site, chosen, several } = useSiteContext();
  const phone = useMedia('(max-width: 767px)');
  const narrow = useMedia('(max-width: 1023px)');
  const ocean = oceanColour(site);
  const count = useBasketCount();
  const basketLabel = `Basket, ${count} ${count === 1 ? 'item' : 'items'}`;
  const [open, setOpen] = useState(false);
  // The search across the top on a tablet or phone, opened by Search the shop.
  const [searching, setSearching] = useState(false);
  const searchButton = useRef<HTMLButtonElement>(null);
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
  // Any new address, the results for other words included: the search across the top closes.
  const [seenAddress, setSeenAddress] = useState(location.key);
  if (seenAddress !== location.key) {
    setSeenAddress(location.key);
    setSearching(false);
  }

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

  // Cancel or Escape: the search across the top closes and focus goes back to its button.
  const closeSearch = () => {
    flushSync(() => setSearching(false));
    searchButton.current?.focus();
  };
  // Wider than a tablet: the header has its own box, so the search across the top goes.
  if (searching && !narrow) setSearching(false);

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
            <button ref={searchButton} type="button" aria-label="Search the shop" aria-expanded={searching} onClick={() => setSearching(true)} className={iconLink}><Search aria-hidden className="size-5" /></button>
            <Link to="/basket" aria-label={basketLabel} className={iconLink} style={linkColour}><ShoppingBasket aria-hidden className="size-5" /></Link>
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
              <button ref={searchButton} type="button" aria-label="Search the shop" aria-expanded={searching} onClick={() => setSearching(true)} className={iconLink}><Search aria-hidden className="size-5" /></button>
            ) : (
              <SearchCombo variant="header" placeholder={several ? 'Search' : 'Search the shop'} />
            )}
            <a href={`/book/${encodeURIComponent(address.slug)}/account`} aria-label="Your account" className={narrow ? iconLink : 'inline-flex min-h-11 items-center gap-1.5 text-size-15 font-semibold no-underline'} style={linkColour}>
              <User aria-hidden className="size-5" />{!narrow && 'Account'}
            </a>
            <Link to="/basket" aria-label={basketLabel} className={narrow ? iconLink : 'inline-flex min-h-11 items-center gap-1.5 text-size-15 font-semibold no-underline'} style={linkColour}>
              <ShoppingBasket aria-hidden className="size-5" />{!narrow && (count > 0 ? `Basket · ${count}` : 'Basket')}
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
      <main id="main-content" ref={main} tabIndex={-1} className="relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 py-5 outline-none md:gap-9 md:px-8 md:py-8">
        {narrow && searching && <SearchCombo variant="top" onCancel={closeSearch} />}
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
