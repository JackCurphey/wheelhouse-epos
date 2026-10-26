# Design: customer groups in Settings

## Decisions

1. **The count.** `GET /api/customer-groups` adds `customerCount`: the
   number of active, unmerged customers in each group
   (`customer_group_members` joined to `customers`).
2. **The fold.** It's `src/screens/settings/customer-groups-settings.tsx`,
   in a new Payments area of the Front desk room, after Till and before
   Messages, in the drawing's order (`settings-frame.mjs`: Till, then
   Payments).
   - **Summary:** the groups' names, or "No groups yet".
   - **Rows:** the drawn `groupRow`.
   - **Box:** follows Services' box: a dialog with Name and "% off", Save,
     and, for an existing group, "Remove group".
3. **Not drawn, decided here (logged):**
   - the Add/Edit box;
   - "Remove group", which leaves its customers in no group, as the server
     already does;
   - "No groups yet" as the empty summary.
