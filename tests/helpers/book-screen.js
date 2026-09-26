// Renders one book screen in jsdom, the way the customer app mounts it: inside
// /book/:shopSlug with the booking-in-progress provider and a query client.
// Every other book address renders "At <path><search>" - followed by the
// navigation state as JSON when there is one (d5) - so a test can see where a
// screen navigated to. Shop slug is always "north".
//
// Every fetch is answered at once and recorded in `requests` ({url, method,
// body}), so a test can prove a screen sent nothing (d3) or what it sent (d5).
// /mechanics and /availability are answered from `mechanics` and
// `availability` (d4); /terms, /booking-links/<code> and /bookings from
// `terms`, `bookingLink` and `booking` (d5); everything else from `services`.
// Each is either a body (sent with 200) or a function (url, init) =>
// ({ status, body }), which may be async - a test that holds an answer back
// must release it before it ends - or may throw, which the screen sees as a
// lost connection. `photos` are held in the draft's memory (they are never
// stored); `readPhotos()` reads them back, so a test can prove a send that
// succeeds clears the held photos too, not only the saved draft. `state` is
// the first address's navigation state. The returned `router` is the memory
// router itself, so a test can inspect `router.state.location.state` -
// e.g. to prove a screen consumed and cleared a refusal (d5) rather than
// leaving it to repeat on a refresh or Back/Forward to the same entry.
// scrollIntoView (missing in jsdom) is recorded in `scrolled`; <dialog>'s
// showModal and close (missing in jsdom) are stubbed.
import { installDom, importFresh } from './dom.js';

const BUILD = new URL('../../.test-build/', import.meta.url);
const NO_MECHANICS = { mechanics: [], openingTime: '09:00', closingTime: '17:00', openingDays: [] };
const NO_AVAILABILITY = { busy: [], fullDays: [], days: [] };
const STANDARD_TERMS = { title: 'Booking terms', text: '1. Your booking is a request.', standard: true };
const NO_LINK = () => ({ status: 404, body: { error: "We can't find that booking" } });
export const PRIVATE_LINK = `/book/north/booking/${'a'.repeat(64)}`;
const BOOKED = () => ({
  status: 201,
  body: { id: 1, reference: 'WH-1001', privateLink: PRIVATE_LINK, services: [], totalPrice: null },
});

export async function renderBookScreen({
  file, exportName, at, url, services, draft, mechanics = NO_MECHANICS, availability = NO_AVAILABILITY,
  terms = STANDARD_TERMS, bookingLink = NO_LINK, booking = BOOKED, photos, state,
}) {
  const uninstall = installDom(`http://localhost${url}`);
  if (draft) window.sessionStorage.setItem('wh-book-draft:north', JSON.stringify(draft));
  const scrolled = [];
  // Both the frame's scroll-to-top and a screen's own ?start scrollIntoView
  // land here in call order, so a test can prove the frame's runs first (and
  // the screen's own scroll still wins the final position).
  const scrollCalls = [];
  window.scrollTo = (...args) => scrollCalls.push({ type: 'top', args });
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
    scrollCalls.push({ type: 'start', el: this });
    scrolled.push(this);
  };
  window.HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function close() {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  const requests = [];
  globalThis.fetch = async (input, init) => {
    const address = String(input);
    const method = init?.method ?? 'GET';
    requests.push({ url: address, method, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
    const { pathname } = new URL(address, 'http://localhost');
    const source = pathname.endsWith('/mechanics') ? mechanics
      : pathname.endsWith('/availability') ? availability
        : pathname.endsWith('/terms') ? terms
          : pathname.includes('/booking-links/') ? bookingLink
            : pathname.endsWith('/bookings') ? booking
              : services;
    const { status, body } = typeof source === 'function' ? await source(address, init) : { status: 200, body: source };
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };

  const { render } = await import('@testing-library/react');
  const { createElement: h, useEffect } = await import('react');
  const { createMemoryRouter, RouterProvider, Outlet, useLocation, useParams } = await import('react-router');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const Screen = (await importFresh(new URL(file, BUILD).href))[exportName];
  const { DraftProvider, useDraft } = await import(new URL('screens/book/draft.js', BUILD).href);

  // Photos live in the provider's memory only, so a test hands them over once, on mount.
  function SeedPhotos() {
    const { setPhotos } = useDraft();
    useEffect(() => {
      setPhotos(photos);
    }, []);
    return null;
  }
  // The provider's own photos, read back after an action (e.g. a successful
  // send should clear them, not only the saved draft). Mounted alongside the
  // screen, inside the same DraftProvider, so it sees every update.
  const photosBox = { current: [] };
  function PhotosProbe() {
    photosBox.current = useDraft().photos;
    return null;
  }
  function Layout() {
    const { shopSlug = '' } = useParams();
    return h(DraftProvider, { shopSlug }, photos ? h(SeedPhotos) : null, h(PhotosProbe), h(Outlet));
  }
  function Where() {
    const l = useLocation();
    return h('p', null, `At ${l.pathname}${l.search}${l.state ? ` ${JSON.stringify(l.state)}` : ''}`);
  }
  const child = (path) => (path === '' ? { index: true } : { path });
  const routes = ['', 'services', 'problem', 'date', 'details', 'booking/:code']
    .map((p) => ({ ...child(p), Component: p === at ? Screen : Where }));
  const start = new URL(url, 'http://localhost');
  const entry = state ? { pathname: start.pathname, search: start.search, state } : url;
  const router = createMemoryRouter([{ path: '/book/:shopSlug', Component: Layout, children: routes }], { initialEntries: [entry] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = render(h(QueryClientProvider, { client }, h(RouterProvider, { router })));
  const readDraft = () => JSON.parse(window.sessionStorage.getItem('wh-book-draft:north') ?? '{}');
  const readPhotos = () => photosBox.current;
  return { ui, client, router, uninstall, scrolled, scrollCalls, requests, readDraft, readPhotos };
}
