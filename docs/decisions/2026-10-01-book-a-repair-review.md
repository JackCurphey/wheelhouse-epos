# Journey 3, Book a repair — Jack's decisions (1 Oct 2026)

Journey 3 is a customer booking a repair or service on the shop's website,
and changing or cancelling it. Background, not reopened here: the customer
screens at `/book` were designed and partly built in Release 1 in the old
Fjell look (`docs/design/release-1-journey/`); the shop takes either exact
appointments or drop-off days, never both (2026-09-23 decision J3); 2 hours'
notice, UK time (Book piece 10); one update channel, text by default, then
WhatsApp or email (Book d5); cancelling is immediate before drop-off, and a
change to a confirmed booking is a request (Book piece 12); a private link
for each booking (Book piece 4); the customer can set a spending limit
(Workshop day 41–43); requests arrive in the diary in purple, with Accept,
Offer another time and Decline (Workshop day 7, 12, 15); who can be booked
online, and on which days (Owner setup 11, 13, 19); deposits are taken at
the till and shown at collection (Selling at the till 8, 11; Collect and pay
H2); the website is drawn in Soft sand with the shop's logo slot (App map 3).
Generator: `book.mjs` + `build-book.mjs --theme sand`. Real example data: North Street Cycles, Bolton; customers, bikes, services
and jobs as in the diary (`diary.mjs`) and Owner setup (`setup.mjs`); every
other value is a bracketed placeholder. Designed in the Soft sand look on its
own canvas (https://claude.ai/artifact/KxkLMpRgFk23oeFJdfuq95), desktop first, then tablet and phone. Rules for every journey
apply (Workshop day 45, 48, 50, 53, 57, 62, 65–67; A2, A6 — as few clicks as
possible).

1. **Redraw the whole booking flow on the shop's website, in Soft sand**
   (Jack, 1 Oct: "1"), chosen over designing only the gaps, and rethinking
   the flow from scratch. The steps and rules already agreed stay; the
   missing pieces are added — a deposit, leaving while the request is
   sending, and changing or cancelling — at desktop, tablet and phone. The
   booking pages use the website's theme, which answers the open question
   of whether `/book` follows the shop's colours (from the Fjell pull
   request, #93).
2. **One page, one step at a time, with a summary down the side** (Jack,
   1 Oct: "1"). Service, then bike and problem, then date, then contact
   details, then send. An answered step closes to a one-line summary with
   "Change" and the next opens beneath it; a "Your booking" box on the
   right fills in as the customer goes (service, price, date, any
   deposit). On phone the steps stack the same way and the summary becomes
   a bar at the bottom. Chosen over a page for each step with a progress
   bar, and every question on one form at once.
3. **Online deposits are a shop setting, off by default** (Jack, 1 Oct:
   "lets go with 1"). The owner turns it on and sets the amount — a fixed
   sum or a percentage of the price — for every booking or only chosen
   services. When it is on, the last step takes a card payment; the
   confirmation says "Deposit paid"; the till and collection pick it up by
   themselves (Collect and pay H2); a declined request refunds it
   automatically. Replaces "deposits are out of Release 1" (2026-09-23 J4)
   for this design. Chosen over always taking a deposit, and no online
   deposits.
4. **A deposit is refunded in full up to a cut-off the shop sets, and kept
   after it** (Jack, 1 Oct: "1"). Cancel before the cut-off (for example 24
   hours before) and it comes back automatically; cancel later, or don't
   turn up, and the shop keeps it. The booking page and the confirmation
   say "Free to cancel until [date and time]"; staff can still refund by
   hand. Chosen over always refunding on cancelling, and never refunding
   automatically.
5. **The first step shows every service at once** (Jack, 1 Oct: "yeah lets
   go with 1 as sketched", after seeing both sketched). Full services as
   cards side by side — what's included, time, and price if the shop shows
   prices; under them a tick list of individual services ("Or just one
   job — tick any you need"); then "Not sure what's wrong? Describe it and
   we'll take a look" as a dashed box at the bottom; then "Next: your
   bike". A search box appears only when a shop has more than about 10
   individual services. Chosen over choosing the kind first (Full /
   Individual / Not sure, the Release 1 flow, 2026-09-24), and one
   searchable list.
6. **Anyone can book; signing in is offered, never required** (Jack, 1
   Oct: "1"). A line at the top: "Booked with us before? Sign in to use
   your saved bikes and details" (journey B's code sign-in). Signed in, the
   bike step shows the customer's bikes as cards, plus "A different bike",
   and their contact details are filled in. Guests type make, model and
   colour, and give a name and phone number at the end; a booking that
   matches an existing customer is linked to them by the shop, unseen, and
   staff can correct a wrong match. Chosen over signing in to book, and
   guests only (Release 1).
7. **Dates as a two-week strip of days, with "Earliest" first** (Jack, 1
   Oct: "1"). A one-click "Earliest: [day, date, time]" button, then 14
   day cards ("[n] times" or "Full", with later weeks a click away); a
   chosen day shows its times as buttons (appointments), or its drop-off
   window and the mechanic choice (drop-off days). A full day says "Fully
   booked" on hover or tap, so Release 1's separate "unavailable dates"
   screen goes. On phone the strip scrolls sideways. Chosen over a month
   calendar, and a list of the next free times only.
8. **Confirming online bookings automatically is a shop setting, off by
   default** (Jack, 1 Oct: "1"). Off: a request, as now — purple in the
   diary until staff Accept (Workshop day 7, 12), and the customer sees
   "Request received". On: a booking that fits the diary is confirmed when
   sent — the customer sees "Booking confirmed" at once and the job sits in
   the diary as a normal booking. Changes to a confirmed booking stay
   requests either way (Book piece 12). Chosen over always a request, and
   always confirmed.
9. **Nothing the customer typed is ever lost** (Jack, 1 Oct: "1"), closing
   the Release 1 gap "Leaving while the request is sending". Answers are
   kept on the customer's device until the booking is sent; a failed send
   shows "Not sent yet — check your connection" with Try again and
   everything still filled in; coming back later shows "You didn't finish
   booking — carry on where you left off", or start again; pressing Send
   twice books once; a sent booking's text or email with its private link
   arrives whatever the customer does next. Chosen over a plain error.
10. **Changing or cancelling happens on the booking's own page** (Jack, 1
    Oct: "1"). The page opens from the private link (Book piece 4) or from
    "Your bookings" when signed in, and shows the services, bike, date, any
    deposit and any mechanic picked. "Change the date" opens decision 7's
    two-week strip in place; a confirmed booking then shows "Waiting for
    the shop to confirm the new time" until staff accept (Workshop day 19).
    "Cancel booking" asks once and says what happens to the deposit —
    "Your £[amount] deposit will be refunded", or "Your deposit isn't
    refundable after [date and time]" (decision 4). Services aren't
    changed here: "Add a note for the shop" covers it. Chosen over
    cancelling and booking again, and changing by phone.
11. **One "Online booking" section in Settings › Workshop** (Jack, 1 Oct:
    "1"). It holds every rule for booking online: appointments or drop-off
    days (2026-09-23 J3), notice (Book piece 10), whether prices show
    online, deposits and their cut-off (decisions 3, 4), confirming
    automatically (decision 8), the shop's booking terms (Book piece 11),
    and "See your booking page". Which services can be booked stays on each
    service; who can be booked stays on each person (Owner setup 11).
    Gives the settings that had a server but no screen their screen.
    Chosen over deposits under Payments, and a separate page under Website.
