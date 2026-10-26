# Proposal: customer groups in Settings

## Why

Customer service review decision 8 (Jack, 30 Sep,
`docs/decisions/2026-09-30-customer-service-review.md`): the shop sets up groups,
each a name and a discount, in Settings › Front desk › Payments › Customer
groups. The till gives the discount by itself when a group member is on a
sale. The drawing is `cs-groups` (`docs/design/user-journeys/generator/customer.mjs:269-273`).
The server already adds, changes and removes groups (`server/routes/customers.js`),
and the till already applies the discount. Only the Settings fold is missing
(`decided-while-building.md`, 24 Oct, customers list, item 4: groups come
with WP-5.1). WP-5.1, Jack's lane, unclaimed.

**Risky area:** none.

## What Changes

- **Settings › Front desk › Payments**, a new area with one fold, Customer
  groups. It shows only what works (stage 1 drawing gaps decision 6), so the
  card machine and ways to pay aren't listed yet.
- **Customer groups:**
  - each group's name, "[n] customers", "[n]% off" and Edit;
  - the drawn note, "The till gives the discount by itself when a group member
    is added to a sale, with the group as the reason.";
  - "+ Add a group".
- **The group's box:** Name and % off, with Save, and "Remove group".
- **`GET /api/customer-groups`** adds each group's count of current customers.

## Capabilities

### Modified Capabilities

- `settings`: customer groups.

## Out of scope

- **Card machine, Ways to pay and Other ways to pay:** not built.
- **Roles:** Settings stays Owner only until WP-1.1.
