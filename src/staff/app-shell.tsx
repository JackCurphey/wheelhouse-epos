import type { ComponentType } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, useRouteError } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { ApiError } from '@/lib/api/client.ts';
import { ROUTES, type ScreenId } from './routes.ts';

/**
 * The staff app's frame: query client, router, error boundary.
 *
 * Deliberately unstyled. Nav, layout and the per-shop theme are design
 * decisions no plan step has settled yet, so nothing here guesses at them.
 */

// Screens by atlas id. Each journey plan registers its screens here as they
// are built; an id with no entry renders the placeholder, so every URL in
// ROUTES is routable from day one - including the five edge screens entered
// from outside the app.
const SCREENS: Partial<Record<ScreenId, ComponentType>> = {};

function notBuilt(id: ScreenId): ComponentType {
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
      ...(Object.entries(ROUTES) as [ScreenId, string][]).map(([id, path]) => ({
        path,
        Component: SCREENS[id] ?? notBuilt(id),
      })),
      { path: '/workshop/*', Component: NoSuchScreen },
    ],
  },
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 4xx will not change on retry - a 404 stays missing, a 401 stays
      // signed out - so only server and network failures are retried.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 3,
    },
  },
});

export function AppShell() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
