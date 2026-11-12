import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, useRouteError, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { ApiError } from '@/lib/api/client.ts';
import { siteAddress } from './address.ts';
import { SiteLayout } from './shell.tsx';
import { H1 } from './parts.tsx';
import { HomePage } from './home.tsx';

/**
 * The customer website app (openspec/changes/website-browse, design 3): the
 * frame around every page, and its pages. Addresses are relative to the
 * shop's base (/store/<slug> or the shop's own address), which is the
 * router's basename. Paths follow the server's page names (server/routes/site.js).
 */

function RouteErrorBoundary() {
  const error = useRouteError();
  console.error(error);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <H1>Something went wrong — try again</H1>
    </main>
  );
}

const Empty = () => null;

export const websiteRoutes: RouteObject[] = [
  {
    path: '/',
    Component: SiteLayout,
    ErrorBoundary: RouteErrorBoundary,
    children: [
      { index: true, Component: HomePage },
      { path: 'shop', Component: Empty },
      { path: '*', Component: Empty },
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
