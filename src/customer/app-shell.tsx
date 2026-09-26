import type { ComponentType } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, useRouteError } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { ApiError } from '@/lib/api/client.ts';
import { CUSTOMER_ROUTES, type CustomerScreenId } from './routes.ts';

/**
 * The customer app's frame: query client, router, error boundary. The same
 * shape as the staff shell (src/staff/app-shell.tsx) but a separate app: no
 * staff session, and its own addresses under /book.
 *
 * Deliberately unstyled; the screens and their design come in later pieces.
 * Spec: docs/superpowers/specs/2026-09-25-book-b-customer-shell-design.md
 */

// Screens by atlas id. An id with no entry renders the placeholder, so every
// address in CUSTOMER_ROUTES works from day one - including a private link.
const SCREENS: Partial<Record<CustomerScreenId, ComponentType>> = {};

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
      ...(Object.entries(CUSTOMER_ROUTES) as [CustomerScreenId, string][]).map(([id, path]) => ({
        path,
        Component: SCREENS[id] ?? notBuilt(id),
      })),
      { path: '/book/*', Component: NoSuchScreen },
    ],
  },
]);

const queryClient = new QueryClient({
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
