import type { ComponentType } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, useRouteError } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { ApiError } from '@/lib/api/client.ts';
import { ROUTES, type ScreenId } from './routes.ts';
import { NAV_ROUTES } from './nav.ts';
import { Landing, StaffLayout } from './staff-layout.tsx';
import { OverviewPage } from '@/screens/overview/overview-page.tsx';
import { DiaryPage } from '@/screens/diary/diary-page.tsx';
import { TillPage } from '@/screens/till/till-page.tsx';
import { SettingsPage } from '@/screens/settings/settings-page.tsx';
import { MessagesPage } from '@/screens/messages/messages-page.tsx';
import { TodayPage } from '@/screens/today/today-page.tsx';
import { CustomersPage } from '@/screens/customers/customers-page.tsx';
import { CustomerPage } from '@/screens/customers/customer-page.tsx';
import { BikePage } from '@/screens/customers/bike-page.tsx';
import { YourSettingsPage } from '@/screens/your-settings/your-settings-page.tsx';

/**
 * The staff app: query client, router, error boundary. The rooms sidebar
 * pages and /workshop itself sit inside StaffLayout (the sidebar, rail and
 * phone menu); the edge screens a customer reaches from an emailed link do
 * not.
 */

// Screens by screen design id. Each journey plan registers its screens here as they
// are built; an id with no entry renders the placeholder, so every URL in
// ROUTES is routable from day one - including the five edge screens entered
// from outside the app.
// Signed in at "You've signed out": nothing to say, so on to the front page.
function SignedInAlready() {
  return <Navigate to="/workshop" replace />;
}

const SCREENS: Partial<Record<ScreenId, ComponentType>> = { 'auth-signedout': SignedInAlready, desk: Landing, diary: DiaryPage, overview: OverviewPage, till: TillPage, settings: SettingsPage, messages: MessagesPage, today: TodayPage, 'your-settings': YourSettingsPage, customers: CustomersPage, 'cs-page': CustomerPage, 'cs-bike': BikePage };

// Pages inside the staff frame: /workshop, the sidebar pages, Your settings.
const IN_FRAME = new Set<ScreenId>(['desk', 'your-settings', 'auth-signedout', 'cs-page', 'cs-bike', ...(Object.keys(NAV_ROUTES) as ScreenId[])]);
const route = ([id, path]: [ScreenId, string]) => ({ path, Component: SCREENS[id] ?? notBuilt(id) });
const entries = Object.entries(ROUTES) as [ScreenId, string][];

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
      { Component: StaffLayout, children: entries.filter(([id]) => IN_FRAME.has(id)).map(route) },
      ...entries.filter(([id]) => !IN_FRAME.has(id)).map(route),
      { path: '/workshop/*', Component: NoSuchScreen },
    ],
  },
]);

// Exported so the screen tests can watch where a sign-out goes.
export { pageNav } from '@/lib/page-nav.ts';

// Exported so tests can clear it: its five-minute clean-up timers would
// otherwise keep a finished test run waiting.
export const queryClient = new QueryClient({
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
