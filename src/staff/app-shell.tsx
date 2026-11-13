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
import { CloseTheDayPage } from '@/screens/till/close-the-day.tsx';
import { TillSetupPage } from '@/screens/till/till-setup.tsx';
import { SettingsPage } from '@/screens/settings/settings-page.tsx';
import { MessagesPage } from '@/screens/messages/messages-page.tsx';
import { TodayPage } from '@/screens/today/today-page.tsx';
import { CustomersPage } from '@/screens/customers/customers-page.tsx';
import { CustomerPage } from '@/screens/customers/customer-page.tsx';
import { BikePage } from '@/screens/customers/bike-page.tsx';
import { PrivacyRequestsPage } from '@/screens/customers/privacy-requests.tsx';
import { StockPage } from '@/screens/stock/stock-page.tsx';
import { MovePage } from '@/screens/moving/move-page.tsx';
import { ProductPage } from '@/screens/stock/product-page.tsx';
import { SizesPage } from '@/screens/stock/sizes-page.tsx';
import { YourSettingsPage } from '@/screens/your-settings/your-settings-page.tsx';
import { DeliveriesPage } from '@/screens/deliveries/deliveries-page.tsx';
import { C2wListPage } from '@/screens/c2w/list-page.tsx';
import { C2wOrderPage } from '@/screens/c2w/order-page.tsx';
import { C2wQuotePage } from '@/screens/c2w/quote-page.tsx';
import { C2wOwedPage, C2wOwedProviderPage } from '@/screens/c2w/owed-page.tsx';
import { NewOrderPage } from '@/screens/deliveries/new-order.tsx';
import { RestockPage } from '@/screens/deliveries/restock-page.tsx';
import { OrderPage } from '@/screens/deliveries/order-page.tsx';
import { ReceivePage } from '@/screens/deliveries/receive-page.tsx';
import { DeliveryBookedPage, DeliveryPage } from '@/screens/deliveries/delivery-page.tsx';
import { StockTakePage } from '@/screens/stock-take/stock-take-page.tsx';
import { CountPage } from '@/screens/stock-take/count-page.tsx';
import { CheckPage } from '@/screens/stock-take/check-page.tsx';
import { AppliedPage } from '@/screens/stock-take/applied-page.tsx';
import { ReportsPage } from '@/screens/reports/reports-page.tsx';
import { SalesReportPage } from '@/screens/reports/sales-report.tsx';
import { TakingsReportPage } from '@/screens/reports/takings-report.tsx';
import { WorkshopReportPage } from '@/screens/reports/workshop-report.tsx';
import { ReturningReportPage } from '@/screens/reports/returning-report.tsx';
import { VatReportPage } from '@/screens/reports/vat-report.tsx';
import { C2wReportPage } from '@/screens/reports/c2w-report.tsx';
import { MarginReportPage } from '@/screens/reports/margin-report.tsx';
import { WebsitePage } from '@/screens/website/website-page.tsx';
import { ChangedReportPage } from '@/screens/reports/changed-report.tsx';

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

const SCREENS: Partial<Record<ScreenId, ComponentType>> = { 'auth-signedout': SignedInAlready, 'staff-signin': SignedInAlready, desk: Landing, diary: DiaryPage, overview: OverviewPage, till: TillPage, settings: SettingsPage, messages: MessagesPage, today: TodayPage, moving: MovePage, 'your-settings': YourSettingsPage, c2w: C2wListPage, 'cw-order-held': C2wOrderPage, 'cw-quote': C2wQuotePage, 'cw-owed': C2wOwedPage, 'cw-owed-reports': C2wOwedPage, 'cw-owed-provider': C2wOwedProviderPage, customers: CustomersPage, 'cs-page': CustomerPage, 'cs-privacy': PrivacyRequestsPage, 'cs-bike': BikePage, stock: StockPage, 'st-product': ProductPage, 'st-product-sizes': SizesPage, deliveries: DeliveriesPage, 'rs-order': NewOrderPage, 'rs-order-ordered': OrderPage, 'rs-restock': RestockPage, 'rs-receive': ReceivePage, 'rs-delivery': DeliveryPage, 'rs-booked': DeliveryBookedPage, 'eod-count': CloseTheDayPage, 'till-setup': TillSetupPage, stocktake: StockTakePage, 'tk-count': CountPage, 'tk-diff': CheckPage, 'tk-applied': AppliedPage, reports: ReportsPage, 'rp-sales': SalesReportPage, 'rp-takings': TakingsReportPage, 'rp-workshop': WorkshopReportPage, 'rp-returning': ReturningReportPage, 'rp-vat': VatReportPage, 'rp-c2w': C2wReportPage, 'rp-margin': MarginReportPage, 'rp-changed': ChangedReportPage, website: WebsitePage };

// Pages inside the staff frame: /workshop, the sidebar pages, Your settings.
const IN_FRAME = new Set<ScreenId>(['desk', 'your-settings', 'auth-signedout', 'staff-signin', 'cs-page', 'cs-privacy', 'cs-bike', 'cw-order-held', 'cw-quote', 'cw-owed', 'cw-owed-reports', 'cw-owed-provider', 'st-product', 'st-product-sizes', 'rs-order', 'rs-order-ordered', 'rs-restock', 'rs-receive', 'rs-delivery', 'rs-booked', 'eod-count', 'tk-count', 'tk-diff', 'tk-applied', 'rp-sales', 'rp-takings', 'rp-workshop', 'rp-returning', 'rp-vat', 'rp-margin', 'rp-c2w', ...(Object.keys(NAV_ROUTES) as ScreenId[])]);
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
