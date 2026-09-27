# Staff diary: "Waiting for you", review pop-up and diary markings

**Date:** 2026-09-27. **Follows:** server piece 12 (#89), which supplies
`GET /api/workshop-waiting`, accept/decline, accept-change/decline-change and
cancellation-seen. **Then:** d6 (the customer's change and cancel screens).
**Design agreed with Jack in brainstorm, 27 Sep** (decisions below); this
written spec awaits his review.

## Why

Online bookings, customer change requests and customer cancellations reach
the server, but the staff diary (`public/app.js`, the `#workshop` route) can't
show or answer most of them:

- change requests are invisible (the job reads "Scheduled");
- a customer-cancelled booking stays on the grid as a "Complete" job;
- there is no Decline anywhere, and Accept is only the right-click "Approve",
  a legacy status save;
- the customer's answers reach staff only as text inside Notes, and their
  photos only as download links;
- the left column ("Pending requests") refreshes only when the diary redraws.

## Decisions (Jack, 27 Sep)

1. **The column becomes "Waiting for you (n)"**, fed by
   `GET /api/workshop-waiting`. It replaces "Pending requests"; staff-made
   pending jobs leave the column but stay purple on the grid.
2. **The column checks for changes every minute**; only the column redraws,
   not the grid.
3. **Detailed cards**, oldest first (the server's order).
4. **A separate review pop-up**, not a panel on the edit form, with an
   "Open full job" button.
5. **Customer-cancelled bookings show greyed and crossed through until Seen**,
   then are not drawn; declined bookings are not drawn.
6. **A change request shows amber "Move requested" plus a dashed outline at
   the requested time** when that time is on screen.
7. **Decline asks for confirmation only for a new booking.**
8. **Fix both parked diary problems**: stale diary saves are refused (the
   version check), and dropping a job onto its requested start accepts the
   change whatever the length.
9. **Built inside `public/app.js`**, with the decision logic in small
   separate files that are tested on their own.

## What staff see and do

### The column

- Title "Waiting for you (n)", where n is the response's `count`. The column
  keeps its current place, width and small-screen stacking (`.workshop-feed`).
- One card per item, oldest first:
  - a label: "New booking" (purple), "Change request" (amber), "Cancelled by
    customer" (grey), in words as well as colour;
  - the customer's name and the booking reference;
  - the service names, comma-separated;
  - new booking and cancellation: day, date, start–end time, mechanic;
  - change request: "Wed 7 Oct 10:00 → Fri 9 Oct 14:00" (from → to);
  - "Arrived <n> minutes/hours/days ago" from `arrivedAt`.
- With nothing waiting, the column reads "Nothing waiting".
- While the Workshop tab is showing, the column refetches every 60 seconds and
  redraws only itself. The timer stops when staff leave the tab. A failed
  check keeps the last list and tries again next minute.
- Clicking a card does what "Pending requests" does today: week view, the
  job's week, every mechanic shown, scroll to the job and flash it. It opens
  nothing.

### The review pop-up

A job opens in the review pop-up instead of the edit form when it is
**waiting**: its booking state is `pending` with terms accepted (an online
booking), or `reschedule_requested` with a request, or `cancelled` by the
customer and not yet seen. This is the server's own definition of the waiting
list. Every other job opens the edit form as today.

The pop-up fetches the job (`GET /api/workshop-jobs/:id`, for `version`) and
its attachments, then shows:

- a heading naming the kind and the reference;
- the customer, and day, date, time and mechanic;
- each service with the customer's answers ("Not sure" for a not-sure
  answer);
- photos as thumbnails, from the customer's attachments (`fromCustomer`);
  clicking one enlarges it inside the pop-up (the file route downloads rather
  than shows, so a link would not open it);
- "Customer's notes": the description and the bike note, when present;
- an "Open full job" button that opens the normal edit form.

Actions by kind:

- **New booking:** Accept (`POST …/accept`) and Decline (`POST …/decline`).
  Decline first asks "Decline <customer>'s booking for <day date>? This can't
  be undone." with "Decline booking" and "Keep booking".
- **Change request:** "Customer asked to move from <from> to <to>", Accept
  (`…/accept-change`) and Decline (`…/decline-change`), no confirmation.
- **Cancelled by customer:** Seen (`…/cancellation-seen`).

After a successful action the pop-up closes and both the grid and the column
refresh. A refusal keeps the pop-up open with a plain sentence:

| Server answer | Staff see |
|---|---|
| 409 `stale` | "This job changed while you were looking at it." The pop-up reloads the job. |
| 409 `capacity` | "The requested time is no longer free." |
| 409 `illegal` | The server's own message (piece 12 wrote them for staff). |
| 404 | "This job no longer exists." The column refreshes. |
| no connection | "Couldn't reach the server — try again." |

The right-click menu's "Approve" on a waiting online booking opens the review
pop-up instead of saving a legacy status, so Accept always goes through the
accept route. On a staff-made pending job it works as today.

### The grid

- **Change request:** the job's block is amber with "Move requested". A
  dashed outline is drawn at the requested date and time, in the requested
  mechanic's column (or the single grid when mechanics aren't split), when
  that date is in the week on screen. Clicking the outline opens the review
  pop-up. It can't be dragged.
- **Cancelled by customer, not yet seen:** greyed, crossed through, labelled
  "Cancelled by customer". Clicking opens the review pop-up. It can't be
  dragged or resized.
- **Cancelled and seen, cancelled by staff, declined, expired:** not drawn,
  in week and month views.
- **Month view:** the same markings on its job chips; no dashed outline.

### Diary saves

Drag, resize, the right-click "Approve" on staff-made pending jobs, and the
edit form's Save all send the job's `version`. A refused stale save shows
"This job changed while you were looking at it" and the diary redraws.

## Server changes

1. **The staff job serializer adds `customerDescription` and
   `customerBikeNote`** (null when absent) from `customer_description` and
   `customer_bike_note`.
2. **`PUT /api/workshop-jobs/:id` takes an optional `version`.**
   - When sent, the save goes ahead only if it matches; otherwise 409
     `{code:'stale', error:'This job changed while you were looking at it. Reload and try again.'}`
     (the wording the action routes already use).
   - Every save increments `version`, with or without one sent, so an action
     on an older copy is refused.
   - A save without `version` behaves as today. The only callers are in
     `public/app.js`; all of them will send it.
3. **Dropping onto the requested start accepts the change.** A save on the
   requested date, start time and mechanic (any end time) accepts the
   request, and the job's own requested hold doesn't count as a clash.
4. **Each waiting item adds `services: [{id, name}]`** beside
   `serviceNames`, so the pop-up can put each answer under its service
   (answers carry only a service id). Added while planning.
5. No database changes. No new dependencies. `GET /api/workshop-waiting`,
   the action routes and the attachment routes are used unchanged; thumbnails
   load from the existing attachment file route, which the staff session
   already authorises.

## How it is built

- **New plain-JavaScript modules**, loaded by `public/index.html` before
  `app.js` and tested under `node --test`:
  - *waiting rules*: an item → label, colour class, lines of text, "arrived"
    wording;
  - *diary marking rules*: a job → `normal | move-requested |
    cancelled-unseen | hidden`, and whether a requested outline belongs in a
    given week and mechanic;
  - *review wording*: headings, the confirmation text, and refusal → sentence.
- **`public/app.js` changes:**
  - `loadPendingFeed`/`renderPendingFeed` become a waiting feed from
    `/api/workshop-waiting`, with a 60-second timer that runs only on
    `#workshop`;
  - `jumpToPendingJob` is reused for cards;
  - a new `review-job` modal type in `renderModal`;
  - job click, the right-click Approve, drag, resize and form save send
    `version` and route waiting jobs to the review pop-up;
  - the grid and month chips use the marking rules.
- **Styles** go in `public/styles.css` using existing tokens (the design-token
  test forbids raw hex values in `app.js` and undefined variables in
  `styles.css`).

## Testing

- **Unit tests** (`node --test`) for the three rule modules: each kind's card
  lines, change request from → to, "arrived" wording boundaries, each
  marking, the outline in and out of the week and mechanic, and each refusal
  sentence.
- **Server tests**, beside piece 12's:
  - a stale `version` is refused with 409 `stale` and changes nothing;
  - every PUT increments `version`; an accept on the pre-save version is
    refused;
  - a PUT without `version` still saves;
  - a drop onto the requested start with a different length accepts the
    change and frees the old slot;
  - the job carries `customerDescription` and `customerBikeNote`.
- **Browser tests** (Playwright) for the legacy diary, the first it has had:
  signed in as staff on a seeded test shop,
  - a new online booking appears in "Waiting for you"; clicking it jumps to
    and flashes the job;
  - opening it shows the answers, a photo and the notes; Accept clears the
    item and the job turns scheduled;
  - Decline asks first; "Keep booking" changes nothing; confirming declines
    it and removes it from the grid;
  - a change request shows amber with a dashed outline; Accept moves the job;
    Decline keeps it;
  - Seen removes a customer cancellation from the column and the grid;
  - a second staff member answering an item already answered sees the
    "changed" sentence.
- **Every new test is shown failing** by a targeted break of the code it
  covers, recorded per test in the plan.

## Done means

`npm test`, `npm run test:browser`, `npm run lint` and `npm run typecheck`
pass on the branch and on the pull request's final commit in CI; screenshots
of the column, the pop-up and the grid markings are shown to Jack. Merge only
when Jack says.

## Not in this piece

- Messages to customers about accept or decline (the customer sees the result
  on their private link; d6 builds those screens).
- Resending an identical change request moving it to the back of the list,
  and a customer withdrawing a request after work starts (both customer-side;
  still parked).
- The edit form's Status select still sets a legacy status for any job; the
  review pop-up is the route for waiting jobs.
- Rebuilding the diary in the newer component system.
