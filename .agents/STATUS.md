# STATUS — Wheelhouse EPOS

> **Tracked and authoritative.** This file and `ARCHIVE.md` are the only
> exceptions to the gitignore on `.agents/`. If it is wrong, that is a bug.
> **Never put a destructive command here** — one stale reset nearly destroyed
> the WorkOS plan. State facts; let the reader run the verbs.

**Who is on what** (from 21 Oct, the working agreement, #349: take a piece
here before starting it, so two people never build the same one):
- **Jack:** 25 Oct. Merged 24 Oct: #447 to #477 (Customers with Merge,
  deposits online, Larger text, Don't close things by themselves, WP-0.4
  finished, the test copy's review fixes and test shop, Done ticks and staff
  notes per line, the till's Email receipt and Save to a customer record, an
  online deposit off at the till, an unfinished booking coming back).
  Merged 25 Oct: the workshop's amounts in whole pence (#478 to #482);
  service reminders from the tick when booking to Stop these (#483, #485,
  #488, #489, #491, #493), Settings › Workshop › Services (#484), review
  requests (#494, #495), a bike's own page and Find a bike (#497, #498).
  Stage 0 is closed: the WP-0.5 drills and the walkthrough are done (Mark, 25
  Oct). Next: the declined date change's message as a second box on the Date
  change answered row (Mark's answer, 25 Oct), and paying a repair online
  built on the current sales record. Still waiting: "I'll do this" and "Who
  did what" (WP-1.7, WP-1.2, WP-1.9); the customer's account page (the
  emailed-code sign-in, WP-1.7). WorkOS: Jack made the account himself (25
  Oct, changing Q10 for WorkOS); its Staging environment is set up and its
  keys checked from Jack's `.env`
  (`docs/decisions/2026-10-25-workos-account.md`). Staff sign-in through it
  is still WP-1.7; Mark needs the staging keys from Jack to run it.
- **Mark:** merged 24 Oct: #402 and #404 (sales in pence step A). Open for
  review 25 Oct: step B (#492), audit items 12, 20 and 24 (#496), the
  overnight runner (#490), and a replan into playable slices (#499; Mark
  answered its four questions: the shop day before stock). Next: step C (the
  new till on sync), then a deposit taken at the till
  (`till-job-deposit`, his design decision 8; Jack answered its open question
  in #475), then the shop day (roles on the server, the settings store and
  activity log, sign-in and PINs). Still open from the audit: item 23
  (Jack's side now).
- **Waiting on Jack:** accepting or changing the replan (#499). Also:
  discounts now on the old sales record or after Mark's step C; the
  spreadsheet download's one file or several. Refunds wait for Mark's steps
  B and C. For him to overrule: the 24 and 25 Oct `decided-while-building.md`
  sections.

**Mark is on:** (history; 24 Oct: the quote answer route moved (#468) and WP-0.5 went to Jack.) Away after 15 Oct. His half of WP-0.4 is done: every
route of his is out of `server.js` (#202, #205, #209, #210–#214; #204 and
#208 were Jack's #151 follow-ups). WP-0.5: the host is DigitalOcean in
London, about £20 a month with VAT (#215; Jack's UK answer in
`docs/decisions/2026-10-15-hosted-copy-region.md`), and the setup script
and Jack's guide are in `scripts/hosting/` and `docs/runbooks/hosted-copy.md`
(#219). #134 answered: the sales-in-pence spec merged (#203). When back:
move the booking link's quote answer to `portal.js` (after #207); a login
for the drawings' test shop (task 3.6); WP-0.5 tasks group 2 (the guard,
the commit in `/healthz`), then the deploy workflow; then #203 step A.
On 18 Oct Mark said, through Jack, that the pull requests waiting for his
approval could merge without it: #225, #231, #234, #249, #250 and #256 are
merged. Still his: the
server half of #190 A, a guard so a cancelled, declined or expired booking
can't be booked in or started (the `workshop-jobs` spec allows it today;
Jack, 16 Oct, `docs/decisions/2026-10-15-job-page-fixes.md` item 5). Also
his: the bike on "Waiting for you" items (for the tablet cards' drawn bike
line, #241); and Jack's question,
when the front page switches from the old app to the new one (16 Oct; the
plans don't say). The day's merges change his work: read #231 (his
`add-hosted-copy` design now loads the drawn week into the week the shop is
loaded; the test shop's prices are Jack's 16 Oct decision), #256 (Release 2
is done when built and checked, ready to sell; the all-in-one first and
Lightspeed after; stage 8's alongside and trading week move to the selling
stage). **Check #265:** it changed his server file without his approval,
merged after the six he waived: `DELETE /api/workshop-jobs/:id` now refuses a
job with money paid on its order or the bike in the shop (409
`settle_first`), and deletes the job's quotes and print tasks first.
**New for you** (19 Oct, #297): the server half of confirming online
bookings automatically, contract in `openspec/changes/auto-confirm/design.md`
(migration 046, `confirmBookingsAutomatically`, bookings saved `scheduled`
when on, `newOnline` and `POST /api/workshop-jobs/:id/seen`); Jack's screens
wait for it (Jack, 19 Oct, `docs/decisions/2026-10-19-auto-confirm.md`). **Check #319 too** (20 Oct, on Jack's word): migration 047 adds
`workshop_jobs.decline_message`; `POST /api/workshop-jobs/:id/decline` takes an
optional `message` (workshop server, your approval); your `portal.js` link view
carries `declineMessage` once declined. **Check #315 too** (20 Oct, on Jack's word): a new booking state
`offered` (migration 046: the CHECK and the derived `status` re-made,
`offered_from_date`/`offered_from_time`/`offer_message`/`offer_accepted_at`);
`offered` is in `LIVE_BOOKING_STATES`; `POST /api/workshop-jobs/:id/offer`
in workshop.js (your approval for the workshop server); your
`booking-link.js` has stage `time_offered`; your `portal.js` has the link's
`offer`/`canAccept`, `customerCanChange` (false for an offer), cancel on an
offer, and `POST …/booking-links/:code/accept-offer`. The auto-confirm
contract now takes the next free migration number. **Check the messages engine too** (20 Oct, on Jack's word; Jack: pretend for
now, `docs/decisions/2026-10-20-messages-engine.md`): #321 adds
`server/hosted-copy-guard.js`, called in `server.js` before migrations (your
`add-hosted-copy` tasks 2.1–2.2: the hosted copy refuses `TWILIO_*`,
`EMAIL_*`, `WHATSAPP_*` keys); #322 migration 048 (`message_templates`, the
outbox's columns on `customer_messages`, old rows settled, `undone`);
#323 `server/messaging/engine.js`, the pretend sender, the timer
started in `server.js` and waited for on shutdown, migration 049
(`claimed_at`), `GET /api/messages` and `POST /api/messages/:id/undo`;
#325 `GET/PUT /api/message-templates[/:key]` (Owner only to change) and
`POST …/:key/preview`; #326 in your workshop server and
`customer-messages.js`: the quote send queues Quote to approve through the
engine instead of Twilio, finishing queues Bike ready (in the finish's
transaction, a new link only when it will go, reopening stops it), and the
old app's one-off text goes through the pretend sender; #330 adds
`direction` to the outbox's messages. `server/sms.js` is now unused by the
app (kept for real sending). The change is archived:
`openspec/specs/messages/spec.md`.
**Check these too** (20 Oct, on Jack's word, your workshop server): #333
`serializeWorkshopJob` gains `offer`; #335 a new job takes
`customerDescription`; #336 accept, decline, offer and accept-change send the
booking messages at once through `sendBookingMessage`
(`server/workshop/job-messages.js`, the templates' `group: 'booking'`,
`isPretend()`); #337 accept takes `mechanicId`, checked free under the day's
lock; #341 their replies carry `bookingMessage` when the customer has no way
to be reached. **New for you** (21 Oct, #344): the booking page's later
stages are built with what the link sends; your server half's contract is in
`openspec/changes/archive/2026-10-21-booking-page-stages/design.md` (work
progress, what was done and the amount to pay, the checklist, paid and
collected dates, the shop's address, phone and hours, the 410 reply's
details). It also notes `isLinkExpired` counts 30 days from `job_date`, where
build-plan Q8 says from collection.
**Your opinion wanted** (Jack, 20 Oct, `docs/decisions/2026-10-20-booking-messages.md`
answer 2): replying to a text as a shop setting, a shop's own number whose
replies land in its inbox (a monthly cost, and receiving texts to build), or
the cheaper shared number with replies on the booking page, as now. Not to
build yet. **Check #305 too** (20 Oct, on Jack's word): your `portal.js` gains
`GET /api/portal/:slug/booking-links/:code/availability?start&end`, the days
and times a booking could move to for its own mechanic and length, with the
booking left out of capacity (`loadCapacity(..., { ignoreJobId })`); refused
as `POST …/change` refuses; `bookedMinutes(job)` pulled out of
`changeBookingTime` unchanged; the route snapshot is 165. **Check #295 too** (19 Oct): migration 045 adds
`workshop_settings.confirmation_note` (NOT NULL, default the drawn sentence);
your `workshop-settings.js` sends and saves `confirmationNote` (trimmed, up to
300 characters, empty for none); your `portal.js` `bookingLinkView` returns it
once the booking is confirmed or a change waits. **Check #289 too** (19 Oct): migration 044 adds
`workshop_settings.min_notice_days`; your `server/clock.js` `earliestBookable`
starts days' notice at the start of the day N after the shop's today; your
`workshop-settings.js` sends and saves `minNoticeDays` (1 to 28, or null for
hours); `toCapacitySettings` carries it. **Check #287 too** (19 Oct): your `server/routes/portal.js` booking link view
gains `dropOff` (the booked time less `timed_lead_minutes`, or the drop-off
window when the shop books for the whole day that date, via `modeForDate`;
null until the booking stands). **Check #283 too** (19 Oct, `docs/decisions/2026-10-19-owner-only-settings.md`):
a new `server/lib/owner-only.js` (`ownerOnly`, reading the session as
`team.js` does) makes your `PUT /api/workshop-settings` and `PUT
/api/shop-details` Owner-only until WP-1.1 brings Managers and the "Can
change settings" switch; swap it for those there. The booking settings on
the workshop route are Owner-only too. **Check #279 too** (19 Oct, `docs/decisions/2026-10-19-receipt-words.md`):
migration 043 adds `shops.receipt_footer`, and your `shop-settings.js`
sends and saves `receiptFooter` on `/api/shop-details`. **Check #277 too** (Jack, 18 Oct, `docs/decisions/2026-10-18-shop-details.md`:
build it "flagging Mark's files for him"): migration 042 adds `address`,
`phone`, `email` and `vat_number` to `shops`, one set for the whole business
for now; your `server/routes/shop-settings.js` gains `GET`/`PUT
/api/shop-details` (the session's own row; no role check, as elsewhere).
When your WP-1.4 gives shops their sites, Jack's answer is that address and
phone move onto the first site and the VAT number stays on the business.
**Check #275 too** (Jack, 18 Oct: build piece 3 "flagging Mark's two
files for him"): migration 041 adds `workshop_settings.show_sign_off_to_customers`
(off); your `server/routes/workshop-settings.js` sends and saves
`showSignOffToCustomers`; your `server/routes/portal.js` booking link view
carries `checkedBy` (the sign-off's name, only with the setting on and the
bike ready or collected). Also worth a look: `PUT /api/workshop-settings`
checks no role, so any staff session can change this privacy setting
(already so for every setting). **Check #273 too** (Jack chose to merge it and flag it, 18 Oct): your
`server/routes/sales.js` convert takes an optional `signedOffBy` and, when
paying finishes a job, records the sign-off (`recordSignOff`); it never
refuses a payment over it, warning instead (an inactive mechanic, a failed
save, or `signedOffBy: null` from a till that saw finished work reopened
since). No key, as the old app sends, finishes unsigned as before.
**Check #271 too** (Jack chose to merge it and flag it, 18 Oct,
`docs/decisions/2026-10-16-mechanic-sign-off.md`): migration 040 adds
`workshop_jobs.signed_off_by` (ON DELETE SET NULL), `signed_off_name` and
`signed_off_at`, and a new `workshop_job_sign_offs` table with row
security; `POST /api/workshop-jobs/:id/finish` now needs `signedOffBy`, an
active mechanic (400 `sign_off_required`); reopening, and the old app's
save that reopens, clear it. Reset any local database that ran the branch's
earlier 040. The till's question (answer 5) is a later piece in your
`sales.js`. **Check #267 too** (Jack chose to make it and flag it, 18 Oct,
`docs/decisions/2026-10-18-till-job-payment.md` answer 3): `server/routes/sales.js`
gains `GET /api/sale-documents/:id/due` (the amount due after the order's
and the customer's group discounts, stock levels, and paying's line checks),
convert accepts `sellPastStock: true`, and `server/lib/sales.js` exports
`resolveGroupDiscount`.
**Jack is on:** 23 Oct, evening and overnight: Today (#437: Needs
attention for the Owner and Workshop today, sharing the Overview's rules);
the bike on Waiting cards (#439); his six answers that unlock the next pieces
(#438); a bike left uncollected (#440 server, migration 064; #441 screens:
Settings › Workshop › Collection, Bike still waiting, the bike on Today with
Contacted); Your settings with Reduce motion (#442, migration 065), Show
status symbols (#444) and Folded sidebar with the Till folded (#445); the
email side of emailing a receipt (#443, migration 066; the till's button after
#404). Larger text was built as a zoom and taken out: it put the diary's
drops off their marks (a question for Jack). Each piece had a fresh review,
its findings fixed test-first. The 4 tests that need `ADMIN_DATABASE_URL`
fail on Jack's Mac only; CI sets it. Migration 064 also ran on the Mac's
development database by mistake (scratch databases since).
23 Oct: the Overview's Book in test, which failed before
09:00 on CI's clock and so failed every pull request each morning (#426);
the hosted copy's automatic updates (WP-0.5 task 3.4, at Mark's request,
#427, #428): every merge to `main` that passes Tests is built, pushed to
GitHub's container registry and started on the server by
`scripts/hosting/deploy.sh` over a key tied to that script, rolled back if
`/healthz` doesn't show its commit within 5 minutes. Seen: the merge of #427
deployed itself at 12:04, and #428's pull request deployed nothing. Merged
Mark's #416 for him and answered his #402 and #404.
22 Oct, evening: Notes with the shop: the customer's notes on their
booking link and the staff's replies (#421 server, migration 061; #422 the
booking page's card), the staff Messages inbox with Needs a reply first
(#423), Add a note for the shop from the quote and Work agreed (#424), and
"No answer yet" after the quote reminder, in the diary and on the job
(#425).
22 Oct, afternoon: the customer's finished checklist on the
booking page (#403); quotes (WP-4.2): the drawn words, staff names only with
the sign-off switch on (#405), lines that go together and what happens
without a Needed line (#409, migration 056), a photo on a quote line (#411,
migration 057), a new quote after the customer says no to everything
(#412, Jack's answer in `docs/decisions/2026-10-22-quote-after-declined.md`),
the spending limit chosen at booking (#413, migration 058; only the customer
sets it, `2026-10-22-spend-limit-who-sets.md`) and work within it going ahead
without a quote, the customer told (#417, migration 059), one reminder when a
quote has no answer (#418, migration 060) and the Your answers text after a
call (#419). The four messages' wording is Jack's approved. Each piece had a
fresh review, its findings fixed test-first.
22 Oct, later: the job checklist (#381 drawn and approved,
#382 server, #383 screens): each shop's own checklists in Settings with a
full service template, ticks and notes on the job page; Diary blocks, what a
block shows first and second (#384); storage slots (#389 server, #390
screens): the shop's own hooks, chosen at book-in, Kept on, cleared at
collection; the job page laid out as drawn, Notes in the wider column (#391);
Jack's answers to Mark's questions (#392, #393, #395, #396).
22 Oct: a job's planned length reaches the screens, so the
diary offers a whole-day request for its real length (#365); every screen
test's fake jobs and orders are checked against the server's real replies
(#366, #367, #368); quotes always show their prices (#370); the customer
merge decision (#371, #372); the New online mark on stacks and in the month
view (#374). Next: the job checklist.
21 Oct, late: browser tests for the Workshop Overview and
Settings › Messages (#353); the old app's job orders open the new till and it
never takes a job's payment (#355); the spec for what ended bookings can't do
(#356); confirming online bookings automatically, server and screens (#357,
#358); the booking link's later-stage data and 30 days from collection
(#359); the booking page's progress, money and what was done (#360); Planned
effort on the Overview and the bike's colour on its tag (#361); Request
received and Booking cancelled sent, pretend (#362); the reply-shape file
(#363). Merged Mark's #348, #351 and #350 after checking each.
21 Oct: the Workshop Overview (#346, its `custody=in_shop`
jobs filter in the workshop server, Planned effort waiting on capacity
figures: `openspec/changes/archive/2026-10-21-workshop-overview/design.md`),
the bike tag printed through the browser (#347, a stand-in until a template
builder for receipts and tags). Agreed Mark's working agreement (#349,
merged). Checked Mark's #348 and pushed a lock change and a test fix to it.
20–21 Oct: staff decline or re-offer an offered time
(#332, #333); New job's + Add a bike and "From the customer" printed on the
receipt (#334, #335); the booking messages staff answers send, pretend, and
the diary's note when one couldn't go (#336, #340, #341); the mechanic chosen
as a request is accepted (#337); pills work from the keyboard (#338); the
Settings frame of rooms and folds (#339); an order's workshop job opens in the
new diary (#342; the old job form's removal, #343, is green, waiting to
merge); the booking page's later stages (#344,
`docs/decisions/2026-10-21-booking-page-stages.md`). 20 Oct: the messages engine is built, pretend for now
(#321–#330, `docs/decisions/2026-10-20-messages-engine.md`): Settings ›
Messages, Quote to approve and Bike ready with its minute's Undo, and each
job's Messages as a conversation from the job page's Message button. The
board shows how far through stage 0 we are (#328). 18 Oct merged: the old app's workshop diary is retired
and its Workshop tab opens the new diary (#252,
`docs/decisions/2026-10-18-retire-old-diary.md`). What only it did was drawn
(#253, #254, #258, #260; `docs/decisions/2026-10-18-old-diary-features.md`)
and built into the new diary: the Shared queue button (#255), stretching a
job by its bottom edge (#257), month view (#259), Change details on the job
page (#261) with a note when a change request is waiting (#262), and Accept
or decline from a booking request's menu (#263). The till now pays a job's
order: "Open in the till" from the diary menu and "Take payment" on a
finished job open it with the job's lines locked, the discounts taken off,
and the bike recorded as collected (#267,
`docs/decisions/2026-10-18-till-job-payment.md`). Then printing a receipt
through the browser: Print on the Paid box and Print receipt in the diary
menu, the receipt drawn first and approved; no VAT line or B1 number until
Mark's sales-in-pence work records them (#269,
`docs/decisions/2026-10-18-print-receipt.md`). Email and Text receipts stay
in their packages. Then the mechanic sign-off's first piece: "Mark ready
for collection" asks "Who's signing this off?", the job's mechanic picked,
and the finished job shows "Signed off by [name] · [day], [time]"; each
sign-off keeps the mechanic's name (#271). Then the till asks too, when a
payment finishes work still in progress (#273). Then showing customers who
signed off: a first Settings page (Workshop › Mechanics) with the switch,
off, and "Checked by [name]" on the receipt and booking link when it's on
(#275); turning it on at a real shop waits for the solicitor's check. Then
Shop details on the Settings page (shop name, address, phone, email, VAT
number), and receipts with the shop's name at the top and the address,
phone, VAT number and barcode at the bottom, after research on receipt
layouts (#277). On 19 Oct, the words at the bottom of receipts: Settings ›
Till › Receipts, printed just above the barcode (#279); the same pull
request fixed a diary browser test that used 19 Oct as a week "away from
today". Then opening hours in Settings › Shop and sites: each day Open or
Closed, hours on the hour, saved at once; screens only, on the existing
workshop settings (#281). Then Settings for the Owner only until roles are
built: anyone else sees "Settings aren't part of your role", and the two
settings routes refuse them (#283). Then the time kept free each day in
Settings › Workshop › Online booking, worded so lunch (now a diary block)
isn't counted twice, and the old app's Edit workshop removed (#285). The same
pull request drew, for later: "Bikes are booked in for: A set time / The
whole day", set-time customers dropping off before their booking (30
minutes by default), and notice in hours or days, which needs a server
change of yours (`docs/decisions/2026-10-19-retire-old-workshop-settings.md`).
Then the customer's booking page says when to drop the bike off ("Drop your
Trek Domane AL 3 off by 11:00, half an hour before your booking at 11:30."),
with "Drop off before the booking" in Settings (#287). Then notice in hours or
days: "1 day" lets a customer book any time tomorrow, whatever the time now
(#289). Then switching between a set time and the whole day, from a day the
shop chooses, with "Cancel the change" and the drop-off window; screens only,
on the 24 Sep scheduled mode change (#291). Settings › Workshop › Online
booking now has everything drawn except deposits and the other rows. Then
the "Show prices on the booking page" switch in that box; screens only, the
server already hid prices when it was off (#293). "Confirm bookings
automatically" is its own piece later (mostly Mark's WP-4.2). Then the
"Additional note on the confirmation" in that box: each shop's own words after
the drop-off time on the confirmed booking page, starting with "Please bring
the lock key, and tell us about any accessories." (#295,
`docs/decisions/2026-10-19-confirmation-note.md`). Deposits wait for Mark's
payment work (Jack, 19 Oct). Then confirming online bookings
automatically drawn and approved (the diary's "New, booked online" mark,
"Confirm booking", the switch on) and its contract written for Mark (#297);
the screens follow his server half. Then "Preview" under the
note: a pop-up of the confirmed page for the drawings' example booking with
the shop's saved drop-off time, note and prices (#299,
`docs/decisions/2026-10-19-booking-preview.md`); screens only. The preview
follows the drawn bk-confirmed. Then the confirmed booking page itself, to
its drawing (bk-page): "Your repair · WH-1042" over the bike and the work, the
Booking confirmed badge, the drop-off sentence and note, the Service, Bike,
When and Your repair rows, the shop's name (#301); screens only. Other stages,
Change the date and Cancel booking, and rows needing data your server doesn't
send yet (Extra work, deposit, free to cancel, mechanic, shop address and
phone) come later. On 20 Oct, Cancel booking on the confirmed page: asked once
("There's nothing to pay or refund."), then "Your booking is cancelled" with
Book another time (#303); screens only, on the existing cancel route. Then
Change the date: the day strip in place, a change waiting with Cancel my date
change, and a declined change's notice (#306), on a new server route (#305). Then
the waiting-for-the-shop page to its drawing: "Your booking request", the
purple badge, Change the date (a request moves at once) and Cancel request
(#308); screens only. Then the six booking messages' wording and edit boxes,
drawn and approved (#310, `docs/decisions/2026-10-20-booking-messages.md`):
the booking-confirmed text puts in the shop's note; sending waits for the
messages engine (WP-1.8). Then a shop's own booking terms in Settings › Online booking:
Use your own, from the standard terms, and Go back to Wheelhouse's (#312);
screens only. Online booking now has everything drawn except deposits. Then
Offer another time, whole: staff pick a time in the diary itself and add a
message (drawings #314, redrawn at Jack's request); the suggested time is held
and the first let go; the customer accepts or cancels on their booking page
(#315 server, #316 staff, #317 customer). Then declining with a message: the drawn
decline step ("Decline & notify customer") and the customer's declined page
with the shop's message (#319). Staff can't yet decline a booking that's
waiting on an offered time (logged for later). Then Files and photos on the job page,
and Delete job, refused with "Settle up first" while money has been paid or
the bike is in (#265, `docs/decisions/2026-10-18-attachments-and-delete.md`).
Jack also decided Wheelhouse is built for every shop, not to move his own
shop first (#254), and Release 2 is done when built and checked, ready to
sell, the all-in-one first with Lightspeed after (#256,
`docs/decisions/2026-10-18-build-for-every-shop.md`). All of Mark's waiting
pull requests merged on his word (#225, #231, #234, #249, #250, #256).
Earlier: the online test copy went live (#221; its address is given to Jack
privately, never in the repo, as its spec says); 16 and 17 Oct's workshop changes
(#236, #237, #239 to #245, #247, #248). No pull request waits for Mark's
approval; #265 and #267 changed his server files after his go-ahead, so he checks them.
#238, the diary layout review, is a report, all of it now built or
decided. Next in his lane without Mark: see the build board's "Next up".
The stage check waits for lines 4 and 6 of §9.
**Open for Jack:** nothing waiting now. Small to-do: make a Google account
for Wheelhouse (go-live checklist). Later: his yes to open Stripe and buy the
S700. (Asking the accountant about Citrus Lime reports was dropped, #254;
#171 and #138 were closed with #256's answers, 18 Oct.)

**Updated:** 2026-10-18. **Two people build at once** (Jack agreed to Mark's
split plan, `docs/superpowers/plans/2026-10-04-release-2-two-person-split.md`,
PR #126): Mark takes the server half of each work package and all hosting;
Jack takes the screens and the whole workshop. STATUS and the build board are
updated by **one status pull request a day**, not by every feature pull
request (`CLAUDE.md`, rule 7).

**The build started 4 Oct** (Jack). The record of 4–5 Oct's planning
merges (#126, #110–#112, #144, #146, #153, #154, #124, #157's state) is in
ARCHIVE, "Moved from STATUS on 2026-10-05 (evening)".

## Where the build stands

Stage 0 (split plan §9). Done: line 1 (WP-0.1); line 2 (WP-0.2 server
half, #148, 5 Oct); line 3 (STATUS trim, #149, 5 Oct); line 5 (WP-0.2 screens, #164,
5 Oct). In progress: line 4
(Mark, WP-0.4: route-list test #150, migration checks and
`scripts/new-db.sh` #151, screen-trace reads the route files #152, route
moves #155 suppliers, #156 purchase orders, #158 label settings and shop
theme, #159 website and Shopify, #160 sites and tills, #162 team, #165
printing and messages, #167 sign-in, #168 products; 15 Oct: #202 the sale helpers, #205 workshop settings and `server/lib/uploads.js`, #209 image uploads, #210 and #211 the booking pages, #212 customers, #213 sales and orders, #214 employees and the dashboard; Jack's workshop moves #180–#184, with his quote routes (#207) approved; guards that moved files
and `server.js` define every name they use and import nothing unused,
#155 and #158). Waiting: line 6 (WP-0.5: spec #201, DigitalOcean in London #215, setup script #219; Jack sets it up once he says yes on #137); line 7
(Jack, the stage check; waits for lines 1–6). Stage 1 starts only after
line 7. Planning fixes before stage 1: #131, #132, #133 closed; #141 done in
#157 (5 Oct). #161 fixed by #166. Stage 1's 25 drawing gaps answered (#185,
7 Oct). Specs now live in `openspec/` (#186, 8 Oct).

- **Build plan:** `docs/superpowers/plans/2026-10-03-release-2-build-plan.md`;
  Jack's answers in `docs/decisions/2026-10-03-build-plan-questions.md`.
- **Split plan:** `docs/superpowers/plans/2026-10-04-release-2-two-person-split.md`
  (§5 this file's layout, §9 stage 0 order, §10 its decision log).
- **Decisions:** `docs/decisions/`. Wording derived while building, for Jack
  to overrule: `docs/decisions/decided-while-building.md`. Project rules:
  `CLAUDE.md`.
- **Canvases (claude.ai, private to Jack).** Shop floor (shared link)
  https://claude.ai/artifact/WzmMdudJPoWH5aUd7J9V4j ; back office
  https://claude.ai/artifact/5H8Dv294J1eF6idFoLU6e4 ; customers and website
  https://claude.ai/artifact/6XUis1aqRZqeST5f8UHWXh ; clickable mockup
  https://claude.ai/artifact/6rfhPpmSNY8eDtD6bEnChi ; Workshop day
  https://claude.ai/artifact/GMFs2ZkesazrNPv9StM21U ; design system
  https://claude.ai/artifact/PdfLu9EiYQ7QwRHnF2kESH ; theme options
  https://claude.ai/artifact/LrQtgcrCRc8kQEnSpXhdFN . Each journey's own
  canvas link is in ARCHIVE. Always read the live canvas index before
  publishing (Jack edits it live); ≤255 files per call.

**Build board (keep it current):** https://claude.ai/artifact/NSgsNTKzrYr6GUK4GjF3by,
source `docs/build-progress/build-board.html`. After any build piece merges or
opens, edit its `BOARD` data block, including the Overview tab's `overview`
(Needs you, Waiting on Mark, Next up), and republish (Jack, 3 and 8 Oct).
It is not Jack's local task log (`~/Dashboards/`).

## Open for Jack

- Release 2: the business-plan gate conflict (programme spec §5) is between
  Jack and Mark; Cycle to Work needs Jack's explanation; there is no official
  Wheelhouse logo file (designs show a LOGO slot — never invent one).
- Confirm piece 12's four controller rulings: an ordinary legacy-diary save
  keeps a customer's change request; dragging a job onto exactly its
  requested slot accepts it; every way a request ends clears it; the
  lock-held race tests are sound.
- The piece 6 memory risk (large booking bodies) must be decided before the
  booking route is publicly reachable (hosting not chosen).
- `tests/screens/session.test.js:3` says `serializeSession` lives in
  `server.js`; it is in `server/routes/auth.js` now.
- Found in #148, not fixed: on a website address `/api/portal/*` returns the
  website's HTML (`decided-while-building.md`, Mark's lane), for WP-0.5.
- `timed_lead_minutes` isn't used in any customer confirmation yet.

## Moved to ARCHIVE

All in `ARCHIVE.md`, "Moved from STATUS on 2026-10-05 (WP-0.3)":

- Issue #116 record and its open walk questions for Jack (walk 10 L1, walk
  11 M3/L1, drawer wording, size gaps): "Older notes from the top of STATUS".
- Each journey's record, open notes and own canvas link: "Journey and
  walk-through paragraphs".
- Release 2 specs, names and Fjell: "Release 2 and the design system (27
  Sep, main session)". The 29 Sep list (d6, and unscheduled items such as
  WorkOS sign-in): "Next, in order (Jack, 29 Sep)".
- Fjell items, five parked diary items, other workstreams: "Open for Jack —
  the Fjell bullet…".
- Old checkouts, build method, helper notes, migrations 037 and 038: "Working
  notes moved out".

## Working notes for the next agent

- Route moves: a move, not a rewrite; `tests/route-files-defined.test.js`
  catches a name left undefined. A database per worktree:
  `scripts/new-db.sh <name>`.
- Jack wants plain English, numbered options with concrete trade-offs,
  mock-ups for anything visual, one question at a time. Merging: until the
  build starts, only when Jack says; after, as `CLAUDE.md` sets out. Always
  after CI passed on the PR's final commit.
- Tests: server tests pin the clock to 1 Sep 2026 (`WHEELHOUSE_TEST_CLOCK`;
  never add fixed test dates before it); customer tests need `npm run
  pretest` first; compare DOM query results with `assert.ok(x === null)`
  (`assert.equal` on a DOM node hangs ~60s on failure); `MonthCalendar` names
  days with a comma ("Monday, 5 October 2026").
- Environment: the app runs on `localhost:8080` (not 4000); Postgres via
  compose on port 5433 (not 5432); `npm run docker:down` keeps the volume, so
  use a scratch database to test migrations from empty; `npm test` hangs
  silently without compose Postgres up; a worktree needs its own `.env`
  (gitignored, doesn't travel) or every server-booting test fails with
  `ECONNREFUSED`.
- Deploy warning: back up any real shop database before deploying migration
  030 (it drops columns; there is no code-only rollback).
- Keep this file under 8 KB. Move finished-piece history to `ARCHIVE.md`
  rather than deleting it.
- House style (Jack, 3 Oct 2026): any PowerPoint or slide deck about this
  project is titled "Deez Nuts".
