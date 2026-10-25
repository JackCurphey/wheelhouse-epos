# Design: a bike's own page

## Decisions

1. **One read, `GET /api/bikes/:id`**, returning:
   - the bike (`serializeBike`);
   - `customer: { id, name, phone }`;
   - `jobs`, newest first by the job's moment in the shop's time zone, each
     `{ id, reference, title, jobDate, bookingState, custodyState,
     workState, mechanicName, open }`. `open` is the customer history's own
     rule, shared rather than copied: the booking stands, the bike isn't
     collected, and it isn't a no-show.

   A removed bike still opens: its jobs are history. Another shop's bike,
   or a bike that doesn't exist, is "Bike not found".
2. **The page** copies the customer page's shapes:
   - Section, the History rows and their Stage chip;
   - "Open now" always shown, the rest eight at a time;
   - Details and Belongs to in the left card, as drawn.

   Each job row opens the job in the diary, as on the customer page.
3. **Edit** is not drawn (not-drawn-pages.md:121). It copies the customer
   page's Edit box with the bike's fields; a refusal shows in the box.
4. **New job** goes to `/workshop/diary?customer=[id]&bike=[id]`. The diary
   reads `bike` beside `customer`, and New job starts with that bike
   chosen.
5. **Warranty is hidden.** No column records a bike bought here, and the
   project rule is never to show made-up data.
