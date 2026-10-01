# Journey 7, Account, history and reminders — Jack's decisions (1 Oct 2026)

Journey 7 is the customer's signed-in account on the shop's website — their
bikes, bookings, past work and purchases, details and how they hear from
the shop — and the messages that bring them back: service reminders, a
review request, turning marketing off, and privacy requests. Background,
not reopened here: customers sign in with an emailed code, on the shop's
own site in its theme (Signing in B5, B9); signing in is offered, never
required, and "Your bookings" lists a signed-in customer's bookings (Book a
repair 6, 10, 12); one page per job from booking to ready, linked from every
message (Drop off and approve the quote 1); the staff customer page — a
summary on the left, one history on the right — with bikes and warranty,
money features only when switched on, loyalty as store credit, logged
privacy requests and deletion rules (Customer service 2–4, 6, 9, 10, 12);
the shop rewords and switches every automatic message and adds its own
(Owner setup 14); texts can be sent but replies can't be received yet
(Workshop day 2). Real example data: Maya Patel, 07700 900 142,
maya@example.test, Trek Domane AL 3 · green · black mudguards, bought here
and under warranty ([n] months left), WH-1042 and its lines and £111.00
total, North Street Cycles, Bolton; every other value is a bracketed
placeholder; what customers and staff write to each other is a bracketed
placeholder too. Generator: `account.mjs` + `build-account.mjs --theme sand`.
Designed in the Soft sand look on its own canvas
(https://claude.ai/artifact/Hoz1q28Frh9M7hNgV2bo3b), desktop first, then
tablet and phone. The reminder tick at booking and collection, the two new
Messages rows and the Today lines are drawn on this canvas only for now;
they join journeys 3, 4, 5 and 8's boards when journey 7 goes into the big
canvas. Rules for every journey apply (Workshop day
45, 48, 50, 53, 57, 62, 65–67; A2, A6 — as few clicks as possible).

1. **One account page, the same shape as the staff customer page** (Jack,
   1 Oct: "1"). On the left: their bikes, each with its warranty and "Book a
   service"; store credit when the shop uses it; their details and how
   they get updates. On the right: one history, newest first — bookings
   coming up, jobs in progress (opening journey 4's job page), past jobs and
   purchases with receipts — filtered by Everything, Repairs, Purchases.
   Chosen over separate pages for bookings, bikes, purchases and details,
   and a bike-first layout.
2. **Service reminders: a time per service, and customers say yes once**
   (Jack, 1 Oct: "1"). The shop sets a reminder gap on each service in
   Settings (Standard service after [n] months; none for a puncture). When
   booking or collecting, the customer ticks "Remind me when my bike is due
   its next service", and can switch it off in their account. The
   reminder's link opens Book a repair with the bike and service chosen, on
   the "When?" step. Chosen over one time for every job sent to everyone,
   and no automatic reminders.
3. **Conversations with the shop live on the website** (Jack, 1 Oct:
   "1"). "Add a note for the shop" on a job's page starts a conversation on
   that job, shown there as a short thread; "Ask the shop a question" on
   the account page covers anything else. Staff answer from the Messages
   page; each reply goes by the customer's chosen channel with a link back
   to the thread, and every text says "Replies to this number aren't read —
   reply on your page: [link]" (texts can't be received yet, Workshop day
   2). Both show in the account history. Replaces Release 1's "Talk to the
   workshop" chat. Chosen over waiting for two-way texting, and email only.
4. **"Your data": an instant copy, and deletion as a request** (Jack, 1
   Oct: "1"). "Download a copy of your data" is ready straight away
   (details, bikes, jobs, purchases, messages, consents) and logged;
   "Ask us to delete your account" becomes a request staff confirm, shown
   on Today and the customer page, with anything blocking it said up front
   ("We can delete your account once your bike has been collected" —
   Customer service 12). The privacy notice is linked beside them. Chosen
   over both as requests to the shop, and contacting the shop by email.
5. **A review request after collection: an automatic message, off by
   default** (Jack, 1 Oct: "1"). Switched on in Settings › Messages, where
   the shop picks the review page (such as its Google page) and when it is
   sent ([n] days after collection). Every customer gets the same link —
   no first asking how happy they were and sending only happy customers on,
   which Google's rules forbid. Customers can turn these off in their
   account. Chosen over private feedback only, and no review requests.
6. **One "How we contact you" section, with a one-click stop in every
   optional message** (Jack, 1 Oct: "1"). Job updates by Text, WhatsApp or
   Email (one choice, as at booking) — the way can change, but job updates
   can't be switched off while a job is in; three switches for Service
   reminders, Review requests, and Offers and news (offers off unless the
   customer said yes); every reminder, review request or offer ends "Stop
   these: [link]", which switches that one kind off at once, with no
   signing in, and says so. Replaces Release 1's "Your update preferences".
   Chosen over one switch for everything not about a job, and a switch for
   every message.
7. **The staff Messages page is an inbox with two panes** (Jack, 1 Oct:
   "1"). On the left, conversations with "Needs a reply" first — customer,
   bike, job number when it's about a job, the last line; on the right, the
   open conversation and a reply box that says how the reply goes ("Sent by
   text, with a link back to this conversation", following the customer's
   choice). Filters: Needs a reply, All. "Needs a reply · [n]" shows on
   Today, and each conversation shows on the job page and the customer
   page. On a phone: the list, then the conversation. Replaces the Release
   1 inbox Workshop day 2 kept "as drawn". Chosen over conversations only on
   job and customer pages, and messages answered from Today.
