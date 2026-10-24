# Proposal: remove the old app's Customers screen

## Why

The new Customers screens are merged: the list and Add a customer (#449), the
customer's page and Edit (#450), and Merge (#451). Project rule 5 (CLAUDE.md)
lets an old-app screen go once its replacement has merged, and Jack's 23 Oct
answer 6 (`docs/decisions/2026-10-23-overnight-questions.md`) has the old app
go piece by piece; his 21 Oct answer (`2026-10-21-old-app-placeholder.md`)
treats it as a placeholder that sends harmful paths to the new screens.
Jack's lane. No drawing: this removes a screen.

## What changes

- `public/app.js`: Office's Customers tab, its list and customer page
  (`renderCustomers`, `renderCustomerTable`, `refreshCustomerView`,
  `renderCustomerDetail`, `renderMessageTable`, `renderBikeTable`,
  `smsStatusBadgeClass`), the pop-ups only it opened (the customer's sales,
  a bike's form, a bike's service history), and what only they used
  (`loadCustomers`, `loadCustomerBikes`, `loadCustomerMessages`,
  `customerSearch`, `customerShowInactive`, `customerBikes`,
  `customerMessages`).
- An old link to Office › Customers (`#office/customers`, or a customer's
  `#office/customers/<id>`) goes to the new Customers page, or that
  customer's page.
- Kept, because the old till still opens them: the customer form (new
  customer from the till's search) and the text pop-up.

## Capabilities

### Modified Capabilities

- `customers`: an old Customers link opens the new one.

## Out of scope

The old till and the rest of the old app (piece by piece); the old screen's
styles in `public/styles.css`, shared with other old screens.

## Impact

`public/app.js`. No server or database change.
