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
import * as auth from './auth.js';
import * as products from './products.js';
import * as workshop from './workshop.js';

export const ROUTE_AREAS = [suppliers, purchaseOrders, shopSettings, shopWebsite, sitesTills, team, printAgents, customerMessages, auth, products, workshop];
