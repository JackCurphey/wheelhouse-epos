// The route areas, in the fixed order server.js registers them (split plan
// §4.1 step 3). Order is safe to change only because no route shadows another,
// which tests/route-list.test.js checks; areas still in server.js are
// registered there, before these.
import * as suppliers from './suppliers.js';
import * as purchaseOrders from './purchase-orders.js';
import * as shopSettings from './shop-settings.js';
import * as shopWebsite from './website.js';
import * as sitesTills from './sites-tills.js';
import * as team from './team.js';
import * as printAgents from './print-agents.js';
import * as customerMessages from './customer-messages.js';
import * as messages from './messages.js';
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

export const ROUTE_AREAS = [suppliers, purchaseOrders, shopSettings, shopWebsite, sitesTills, team, printAgents, customerMessages, messages, auth, products, workshop, workshopSettings, portal, customers, salesRoutes, dashboard, today, yourSettings, receiptEmail, search, customerMerge];
