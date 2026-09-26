import type { ComponentType } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Outlet, useParams, useRouteError } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { ApiError } from '@/lib/api/client.ts';
import { DraftProvider } from '@/screens/book/draft.tsx';
import { ServiceScreen } from '@/screens/book/service.tsx';
import { ServiceListScreen } from '@/screens/book/service-list.tsx';
import { ProblemScreen } from '@/screens/book/problem.tsx';
import { CUSTOMER_ROUTES, type CustomerScreenId } from './routes.ts';

/**
 * The customer app's frame: query client, router, error boundary. The same
 * shape as the staff shell (src/staff/app-shell.tsx) but a separate app: no
 * staff session, and its own addresses under /book.
 *
 * Deliberately unstyled; the screens and their design come in later pieces.
 * Book screens nest under a /book/:shopSlug layout that provides the booking
 * in progress (d1).
 * Spec: docs/superpowers/specs/2026-09-25-book-b-customer-shell-design.md
 */

const BOOK_BASE = '/book/:shopSlug';

// Every book screen shares one booking in progress for its shop, so the
// screens sit under one layout route that provides it. Keyed by shop, so
// moving to another shop's address starts that shop's own draft.
export function BookLayout() {
  const { shopSlug = '' } = useParams();
  return (
    <DraftProvider key={shopSlug} shopSlug={shopSlug}>
      <Outlet />
    </DraftProvider>
  );
}

// Screens by atlas id. An id with no entry renders the placeholder, so every
// address in CUSTOMER_ROUTES works from day one - including a private link.
const SCREENS: Partial<Record<CustomerScreenId, ComponentType>> = {
  service: ServiceScreen,
  'service-list': ServiceListScreen,
  problem: ProblemScreen,
};

function notBuilt(id: CustomerScreenId): ComponentType {
  function NotBuilt() {
    return <p>Not built yet: {id}</p>;
  }
  NotBuilt.displayName = `NotBuilt(${id})`;
  return NotBuilt;
}

function RouteErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : 'Unknown error';
  return (
    <div role="alert">
      <p>Something went wrong on this screen.</p>
      <p>{message}</p>
    </div>
  );
}

function NoSuchScreen() {
  return <p>There is no screen at this address.</p>;
}

const router = createBrowserRouter([
  {
    ErrorBoundary: RouteErrorBoundary,
    children: [
      {
        path: BOOK_BASE,
        Component: BookLayout,
        children: (Object.entries(CUSTOMER_ROUTES) as [CustomerScreenId, string][]).map(([id, path]) => {
          if (!path.startsWith(BOOK_BASE)) throw new Error(`${id} is not under ${BOOK_BASE}`);
          const rest = path.slice(BOOK_BASE.length).replace(/^\//, '');
          const Component = SCREENS[id] ?? notBuilt(id);
          return rest ? { path: rest, Component } : { index: true, Component };
        }),
      },
      { path: '/book/*', Component: NoSuchScreen },
    ],
  },
]);

// Exported only so tests can clear it after rendering the whole shell - a
// resolved query left uncleared keeps a test file from exiting promptly.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 4xx will not change on retry - a 404 stays missing - so only server
      // and network failures are retried.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 3,
    },
  },
});

export function CustomerAppShell() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
