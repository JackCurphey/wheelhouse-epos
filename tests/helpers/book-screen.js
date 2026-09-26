// Renders one book screen in jsdom, the way the customer app mounts it: inside
// /book/:shopSlug with the booking-in-progress provider, a query client, and
// /services answered from `services`. Every other book address renders
// "At <path><search>", so a test can see where a screen navigated to.
// Shop slug is always "north". scrollIntoView (missing in jsdom) is recorded
// in `scrolled`.
import { installDom, importFresh } from './dom.js';

const BUILD = new URL('../../.test-build/', import.meta.url);

export async function renderBookScreen({ file, exportName, at, url, services, draft }) {
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
  globalThis.fetch = async () =>
    new Response(JSON.stringify(services), { status: 200, headers: { 'content-type': 'application/json' } });

  const { render } = await import('@testing-library/react');
  const { createElement: h } = await import('react');
  const { createMemoryRouter, RouterProvider, Outlet, useLocation, useParams } = await import('react-router');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const Screen = (await importFresh(new URL(file, BUILD).href))[exportName];
  const { DraftProvider } = await import(new URL('screens/book/draft.js', BUILD).href);

  function Layout() {
    const { shopSlug = '' } = useParams();
    return h(DraftProvider, { shopSlug }, h(Outlet));
  }
  function Where() {
    const l = useLocation();
    return h('p', null, `At ${l.pathname}${l.search}`);
  }
  const child = (path) => (path === '' ? { index: true } : { path });
  const routes = ['', 'services', 'problem'].map((p) => ({ ...child(p), Component: p === at ? Screen : Where }));
  const router = createMemoryRouter([{ path: '/book/:shopSlug', Component: Layout, children: routes }], { initialEntries: [url] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = render(h(QueryClientProvider, { client }, h(RouterProvider, { router })));
  const readDraft = () => JSON.parse(window.sessionStorage.getItem('wh-book-draft:north') ?? '{}');
  return { ui, client, uninstall, scrolled, scrollCalls, readDraft };
}
