// The route areas, in the fixed order server.js registers them (split plan
// §4.1 step 3). Order is safe to change only because no route shadows another,
// which tests/route-list.test.js checks. Every route is in one of these
// (WP-0.4); server.js registers none of its own.
import * as suppliers from './suppliers.js';
import * as purchaseOrders from './purchase-orders.js';
import * as shopSettings from './shop-settings.js';
import * as shopWebsite from './website.js';
import * as sitesTills from './sites-tills.js';
import * as team from './team.js';
import * as customerMessages from './customer-messages.js';
import * as messages from './messages.js';
import * as ownMessages from './own-messages.js';
import * as auth from './auth.js';
import * as products from './products.js';
import * as workshop from './workshop.js';
import * as workshopSettings from './workshop-settings.js';
import * as portal from './portal.js';
import * as customers from './customers.js';
import * as salesRoutes from './sales.js';
import * as dashboard from './dashboard.js';
import * as today from './today.js';
import * as yourSettings from './your-settings.js';
import * as receiptEmail from './receipt-email.js';
import * as search from './search.js';
import * as customerMerge from './customer-merge.js';
import * as depositPayments from './deposit-payments.js';
import * as floatCheck from './float-check.js';

export const ROUTE_AREAS = [suppliers, purchaseOrders, shopSettings, shopWebsite, sitesTills, team, customerMessages, messages, ownMessages, auth, products, workshop, workshopSettings, portal, customers, salesRoutes, dashboard, today, yourSettings, receiptEmail, search, customerMerge, depositPayments, floatCheck];
