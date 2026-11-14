import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, useRouteError, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { ApiError } from '@/lib/api/client.ts';
import { siteAddress } from './address.ts';
import { SiteFailed, SiteLayout } from './shell.tsx';
import { HomePage } from './home.tsx';
import { CategoryPage } from './category.tsx';
import { ProductPage } from './product.tsx';
import { SearchPage } from './search.tsx';
import { ShopPageRoute, ShopsPage } from './shops.tsx';
import { CookiesPage } from './cookies.tsx';
import { CollectionReturnsPage, ContactPage, NotFoundPage, PrivacyPage, ShopPage } from './pages.tsx';
import { BasketPage } from './basket-page.tsx';
import { CheckoutPage } from './checkout-page.tsx';

/**
 * The customer website app (openspec/changes/website-browse, design 3): the
 * frame around every page, and its pages. Addresses are relative to the
 * shop's base (/store/<slug> or the shop's own address), which is the
 * router's basename. Paths follow the server's page names (server/routes/site.js).
 */

function RouteErrorBoundary() {
  const error = useRouteError();
  console.error(error);
  // A page that broke while drawing: asking again is loading the page again.
  return <SiteFailed onRetry={() => window.location.reload()} />;
}

export const websiteRoutes: RouteObject[] = [
  {
    path: '/',
    Component: SiteLayout,
    ErrorBoundary: RouteErrorBoundary,
    children: [
      { index: true, Component: HomePage },
      { path: 'shop', Component: ShopPage },
      { path: 'shop/:id', Component: CategoryPage },
      { path: 'products/:id', Component: ProductPage },
      { path: 'search', Component: SearchPage },
      { path: 'contact', Component: ContactPage },
      { path: 'collection-returns', Component: CollectionReturnsPage },
      { path: 'privacy', Component: PrivacyPage },
      { path: 'cookies', Component: CookiesPage },
      { path: 'basket', Component: BasketPage },
      { path: 'checkout', Component: CheckoutPage },
      { path: 'shops', Component: ShopsPage },
      { path: 'shops/:id', Component: ShopPageRoute },
      { path: '*', Component: NotFoundPage },
    ],
  },
];

// Exported only so tests can clear it - a resolved query left uncleared
// keeps a test file from exiting promptly.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 4xx will not change on retry - a switched-off site stays off - so
      // only server and network failures are retried.
      retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 3,
    },
  },
});

export function WebsiteApp() {
  // Made once: the address doesn't change while the page is open.
  const [router] = useState(() => createBrowserRouter(websiteRoutes, { basename: siteAddress().base || undefined }));
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
