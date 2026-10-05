// The route areas, in the fixed order server.js registers them (split plan
// §4.1 step 3). Order is safe to change only because no route shadows another,
// which tests/route-list.test.js checks; areas still in server.js are
// registered there, before these.
import * as suppliers from './suppliers.js';

export const ROUTE_AREAS = [suppliers];
