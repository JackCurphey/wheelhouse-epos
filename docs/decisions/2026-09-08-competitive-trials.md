# Competitive trials: Velodrop, Lightspeed X-Series, Hubtiger

**Date:** 8 September 2026
**Status:** **Findings recorded.** Two decisions by Jack (§6.2, §6.3). Three
questions left OPEN for Jack in §6.4.
**Affects:** `docs/decisions/2026-09-02-lightspeed-first-platform.md` §6, §7.2, §8;
`research/business/business-research.md` §10.3 and §12; the free-tier scope in
`docs/decisions/2026-09-01-wedge-booking-vs-workshop.md` §6.
**Method:** live trial accounts driven in a browser, 8 September 2026. Every claim
below is tagged with where it came from.

Evidence tags follow the existing research convention: **[V]** seen directly in the
product or on the vendor's own page; **[R]** reported/repeated, not independently
confirmed; **[U]** unverified; **[NF]** looked for and not found.

## 0. Why this exists

§7.2 of the Lightspeed decision named the Velodrop and Bikebook trials as the
highest-value open item, unstarted since 31 August, and the only thing that tests
the "better than theirs" claim §1.4 rests on. The Velodrop half was run on
8 September. It did not end where it was expected to.

Two things came out of the day that were not on the list: the Lightspeed account
created for the R-Series work turned out to be **X-Series**, and the competitor that
actually matters turned out not to be Velodrop.

## 1. Velodrop — what the product actually is

Trial account, admin panel, product version **v2.18.7** **[V]**.

### 1.1 There is no diary. There is a per-day counter.

Three independent confirmations:

- `Settings → Calendar & Schedule` offers exactly two values for `calendar_view`:
  **"Month view (default)"** and **"4 week view, current week first"**. That is the
  complete list — no day view, no week time-grid, no resource view **[V]**.
- Clicking a day on the calendar opens a modal reading **"Available — Wednesday,
  September 9, 2026 — 0/0 appointments, 0/0 hours"** with a capacity bar and the
  actions Create appointment / Create note / Edit date. Not a day schedule **[V]**.
- `Settings → Hours & Availability` is a seven-row table: day of week, open time,
  close time, open/closed, and **"Limit bookings"** — a count from 1 to 100. Their
  own help text calls these "the default number of appointment slots available by
  each day" and says "once this limit is reached, no bookings will be allowed from
  the public" **[V]**.

Open and close times exist to describe the shop, not to place a job at a time. A job
lands on a **day**, never at a time on a bench.

### 1.2 The capacity model is real, and it is hours-aware

More developed than "no diary" implies, and this is the part worth being precise
about:

- Services carry **Cost** and **Time (minutes)**, both required **[V]**.
- `Settings → Appointment Options` has **`calculate_labor` — "Calculate availability
  by employee work hours"**, plus "Estimated percentage of technician time that will
  be devoted to fulfilling appointments" **[V]**.
- Day capacity displays as **"0/0 appointments, 0/0 hours"** **[V]**.

So capacity is derived from service durations against employee working hours, and
resolves to a per-day budget.

**Enforcement is hard, and it blocks admins too.** A valid appointment submit was
rejected with **"The limit of available appointments has been exceeded for this
day"** on a day with zero bookings — because default shop hours are all closed with
limit "none". It only succeeded after ticking the **"Ignore disabled dates"**
checkbox on the create form **[V]**. Their capacity blocks rather than warns, and the
admin override is explicit and deliberate.

### 1.3 It is a queue, and they have designed it as one

`Settings → Appointment Options` carries three queue behaviours **[V]**:

- `auto_queue` — when appointments complete ahead of schedule, automatically shuffle
  received appointments forward in the queue
- `move_open` — when open appointments fall behind the current date, move them up to
  today's schedule
- `move_held` — when on-hold appointments fall behind, move to the next available
  booking date

Each offers automatic / alert-me / do-nothing. This is considered design. It is a
work queue, not a schedule.

### 1.4 Technician assignment exists; a per-technician view does not

`Settings → Appointment Options` has **`employee_assignment` — "Assign technicians to
appointments: Yes/No"** **[V]**, and the workorder's Workshop Info card is captioned
"Assign internal reference number, storage location and technician" **[V]**.

So the data field exists. What is absent is any view that shows work laid out per
technician — the calendar has no columns, and the schedule is a flat list **[V]**.

### 1.5 The workorder record is well modelled

Created appointment 241105 in the trial. The detail view carries **[V]**:

- **Workorder** — Service notes, **Quote**, **Call if over**, **Estimated time**
- **Shop notes** — internal, separate from customer-visible notes
- **Workshop info** — reference number, storage location, technician
- **Comments** — internal thread with an author selector
- **Bike** — with **history | change | edit**
- **Status ledger** — Created at/by, Original appointment date, Reminder sent,
  In shop, Received at/by, Released at/by, Completed at/by, Notified of completion

Status actions: **Cancel · Missed · Complete · Hold · Reschedule · Receive bike ·
Print**. A bike-custody model (receive / release) with messaging hooks wired into the
lifecycle, and a printable job ticket.

### 1.6 Automated status messaging is real and complete

Seven event-triggered SMS templates **[V]**: appointment **confirmation**,
**reminder**, **complete**, **reschedule**, **cancel**, plus **order complete** and
**warranty complete**. Variables include `[FIRST_NAME]`, `[SHOP_NAME]`,
`[APPOINTMENT_DATE]`, `[BIKE_BRAND]`, `[BIKE_MODEL]`, `[NEW_DATE]`. A parallel set of
email templates exists **[V]**.

`business-research.md` §10.3 lists this as our clearest and cheapest gap to close.
**Confirmed correct.**

### 1.7 Service reminders — the research claim is contradicted

§10.3 states "service reminders (Velodrop has them — a revenue lever, not just
parity)" and tags it **[V]**.

`Settings → Reminders` contains exactly two things: an **appointment** reminder (N
days before, at a set time) and an appointment confirmation toggle **[V]**. None of
the seven SMS templates is a service-due reminder **[V]**. `Tools` is a spoke
calculator and a wheel-building page **[V]**.

Appointment reminders chase a booking the customer already made. Service reminders
manufacture a booking months out. They are different products.

Checked: Reminders settings, SMS templates, email settings, Tools. Not every
customer-side surface was checked, so this is **contradicted, not disproven** — but
the **[V]** on that line is not earned and should be downgraded.

### 1.8 Quotes and parts

- **Quotes: partially present.** The appointment form has **"Estimated cost £"** and
  **"Call if over £"** — a single figure plus an authorisation ceiling, rendered on
  the workorder as "Quote" **[V]**. No line items, no parts-and-labour breakdown, no
  customer-facing approve/reject.
- **Parts on a job: absent.** The workorder has no parts or line-item section **[V]**.
  Orders is a separate record — Item, Quantity, Vendor, Part #, MSRP, Quote, ETA,
  Reference — attached to a **customer**, with no appointment link on the create form
  **[V]**. Parts and jobs are parallel records.

### 1.9 Smaller observations

- Services **do** attach to appointments, proven by a validation error: *"The customer
  added notes field is required when none of services / packages are present"* **[V]**.
- A contact channel is mandatory — email required when phone is absent, and vice
  versa **[V]**.
- The booking date picker offers September–December only; no month beyond the current
  year **[V]**.
- Plugins: **Lightspeed R Series, Lightspeed X Series, Shopify** **[V]**. Velodrop's
  own routing calls the X-Series plugin `/plugins/vend` **[V]**.

### 1.10 The two plugins use different, and unequal, auth

- **R-Series is OAuth.** The connect link is a Lightspeed authorise URL whose scopes
  are readable without granting anything: `employee:customers`, **`employee:workbench`**,
  `employee:register`, `employee:admin_inventory`, `employee:inventory_base` **[V]**.
  Workbench is R-Series' service/work-order area. This materially strengthens the
  previously **[R]**-tagged claim that Velodrop creates Lightspeed workorders — the app
  requests the access required to do it. It is **not** proof that it writes rather than
  reads; the individual scope permissions have not been checked against Lightspeed's
  API docs **[U]**.
- **X-Series is a pasted personal token.** Domain prefix plus **Personal token**, with
  the caption "Allow Velodrop to access your Lightspeed store's customer data" **[V]**.
  No OAuth, no scope screen, no per-permission consent.

### 1.11 Not tested

The moderated pending-approval booking queue — the last unverified "ahead" claim in
§10.3. It needs shop hours configured and the public booking page exercised **[NF]**.

## 2. The Lightspeed account is X-Series, not R-Series

A trial created on 8 September through the public self-serve signup produced
**Lightspeed X-Series** **[V]**. Confirmed from the product, not the URL: "outlets and
registers" vocabulary, "Lightspeed Retail" on `*.retail.lightspeed.app`, nav of
Sell / Online / Reporting / Catalog / Services / Inventory / Customers / Setup.
R-Series is a separate product at `cloud.lightspeedapp.com` and speaks of "shops".

**What this is evidence for.** §8 of the Lightspeed decision names "R-Series being
closed to new customers" as a falsifier, tagged **[NF]**. A public signup landing on
X-Series is real evidence in that direction. It is **not proof**: one signup route was
taken, and it does not establish that R-Series is unavailable through sales or a
partner path. What is earned: **the public self-serve signup gives X-Series** **[V]**.

**Consequence for the sync work.** STATUS next action 2 — whether a parent
`Workorder`'s `timeStamp` moves when a child `WorkorderLine` changes — is an R-Series
API question and **cannot be answered on this account**. It remains blocked, and it
still blocks the sync loop design.

### 2.1 X-Series ships a Services module, and it is the shape the decision predicted

`Services` in the main nav, two pages **[V]**:

- **Service list** — columns **Sale receipt · Customer · Assigned user · Location ·
  Date scheduled · Status**, filterable by status, customer, user and receipt/note.
- **Statuses** — a configurable workflow. Shipped: New `SYSTEM`, Ready To Start,
  In Progress, Awaiting Customer, Awaiting Part `SYSTEM`, Cancelled `SYSTEM`,
  Completed `SYSTEM`. Non-system statuses are editable, deletable and reorderable;
  custom statuses can be added.

**There is no calendar view.** Scheduling appears only as a "Date scheduled" column in
a filterable list **[V]**. Service records originate from a **sale receipt** — the first
column — which is why they tie to the till natively.

**This confirms the premise of §1.4 on a second series.** The decision argued the free
product is booking and diary together *because Lightspeed ships a job record with a
date, not a diary*. That reasoning was about R-Series. It is now **verified true of
X-Series** **[V]**. The displacement objection stays absent and the product gap is real
on both series.

**But it is uncomfortable in three places:**

1. The integration plan targets the **R-Series** API. §10 of the Lightspeed decision
   deferred X-Series explicitly, with a weaker API. If new shops land on X-Series,
   first-adapter choice is live again.
2. STATUS next action 2 is unanswerable on the account we have.
3. X-Series services are natively attached to a sale receipt, so §10.3's
   "auto-created linked order making jobs billable at the till" — listed as somewhere
   we lead the bolt-ons — is something Lightspeed's own module already has, because it
   *is* the till.

### 2.2 Personal tokens have moved behind a developer portal

`Setup → Apps` carries a banner: *"Developer access to your account is changing. We're
improving security around access to your account by requiring third party developers
to create and connect applications to your account via our Lightspeed Retail developer
portal. Set up your organization in the portal and invite your Primary Developer to it.
Once you're set up, you'll be able to edit and manage existing personal tokens in the
developer portal."* **[V]**

There is no simple API-key screen in the account. `Setup → Security` is login policy,
MFA and SSO only **[V]**. Whether new tokens can still be self-issued outside the
portal is **[U]** — the banner says "manage **existing**" tokens, which is ambiguous.

This blocks the Velodrop → X-Series write-back test without an organisation
registration.

### 2.3 Who else is in Lightspeed's own app marketplace

From `Setup → Apps` **[V]**:

- **HubTiger** — listed under "Engage with Customers": *"Run rentals and repairs faster
  with Hubtiger, simple bookings, smarter workflows, happier customers."* The market
  leader from research §3.6, sitting in the app store every new Lightspeed shop sees
  during setup. A distribution advantage we do not have.
- **QuoteMachine** — *"Send advanced quoting, invoicing and work orders right from your
  POS."* Quoting **and** work orders, from inside Lightspeed's marketplace. A second
  contradiction of the "quotes are a category-wide gap" claim.
- **Velodrop and Bikebook are absent** from the marketplace entirely.

## 3. Hubtiger — the competitor that actually matters

Everything in this section is **vendor-published marketing** read from hubtiger.com on
8 September 2026. It is specific and load-bearing, but it is **[V]** only in the sense
of "the vendor states this on their own site". None of it has been verified in the
product.

### 3.1 They claim every feature §10.3 lists as a gap or an advantage

From the repair-software page **[V]**:

- **"Every job appears in your repair calendar"**, and customers **"choose an available
  date & time"** through a scheduling widget on the shop's own website
- **Digital work order with a clear status and an assigned technician**
- **Automated customer communication at every stage — email, SMS, or WhatsApp**
- **"Build quotes and invoices directly from the work order, with parts and labor
  pricing pulled from your POS system, and send them to your customer for approval
  with one click"**
- **Productivity tracking** — logged time against estimate
- **Reporting** — revenue, job volume, technician performance, service types
- **"The job is sent to your POS for payment"** on completion
- **Service history per item** — what work, which parts, when

### 3.2 Set against `business-research.md` §10.3

| §10.3 claim | Hubtiger's own marketing |
|---|---|
| **Ahead:** diary with per-mechanic columns | Repair calendar with assigned technicians |
| **Ahead:** auto-created linked order, billable at the till | "The job is sent to your POS for payment" |
| **Ahead:** explicit capacity/overlap logic | Customers pick from *available* date and time slots |
| **Nobody has:** quotes/estimates | Quotes on the work order, one-click customer approval |
| **Nobody has:** parts-attached-to-job | Parts and labour pricing pulled from the POS |
| **Behind:** automated status messaging | Email, SMS **and** WhatsApp |

§3.6 of the research already warned that §10.3's ahead/behind lines do not hold
against Hubtiger. What is new is that this is now sourced from their product pages
rather than inferred, and it is broader than the warning implied.

### 3.3 Scale, pricing and UK presence

- **2000+ shops, 25+ countries, 8 years, 4.4M+ repair jobs, 5000+ technicians** — all
  vendor-stated and unaudited **[U]**
- **Repair pricing, monthly:** Lite **$52** (one technician), Professional **$99**
  (2–4), Premium **$125** (5+). Priced by technician count **[V]**
- **7-day free trial, full access, no credit card** **[V]**
- **NBDA** industry partner, 15% discount for members **[V]**. The **ACT** is not
  mentioned on the integrations page — this does not answer research §3.6's open
  question about the ACT endorsement, and absence from one page is not evidence **[NF]**
- UK presence evidenced by a **Fettle** testimonial — a UK bike repair chain **[V]**
- Also integrates with **Project 529** bike registry, letting shops check stolen-bike
  status from inside the repair software **[V]**

### 3.4 The POS list — and a correction made the same day

**Their public integrations page does not list Citrus-Lime.** It shows Lightspeed,
Square, Shopify, Epos Now, Retail Express, Global Payments, Teamwork Commerce, Cin7,
Sage and Xero **[V]**. That was initially read as a UK-specific gap in their coverage.

**That reading was wrong.** The in-product POS integration screen lists thirteen
platforms and **Citrus Lime is among them** **[V]**:

> Lightspeed-X · Lightspeed R · Xero · Shopify · Cin7 · Northmill · Retail Express ·
> **Citrus Lime** · EPOSNow · Netsuite · Square · Heartlands · Teamwork

Both Lightspeed series are supported. There is no Citrus-Lime gap.

**The lesson, recorded because the pattern matters:** absence from a vendor's
marketing page is not absence from the product. The gap was inferred from a public
page rather than checked in the product, and the product contradicted it within the
hour. Same failure mode as the corrections log's existing entries.

**What the connection actually does**, from the screen's own footnote **[V]**:

> "Connecting to a POS/Accounting platform will allow you to generate quotes using the
> inventory directly from your POS/Accounting platform, you can also push quotes to
> the POS/Accounting platform."

Bidirectional: inventory pulled in, quotes pushed back out.

### 3.5 Verified in the product, 8 September

A trial account was opened the same day. Everything in this subsection was seen in the
running product, not read from marketing.

**The calendar is a real diary, and it is better than the marketing implied** **[V]**:

- Views: **Day · Week · 2 Weeks · Month**
- **Rows are technicians** — Technician 1, 2, 3, each with its own **iCal Link** and a
  Configure control. Columns are days.
- Jobs are **time-slotted**: 09:00–10:30, 10:30–12:00, 12:00–13:30, 13:30–15:00
- Each card shows time, customer, bike, service type, status and job number
- A colour-coded status legend: Pick Ups, Booked In, Waiting for Work,
  Waiting - Client, Waiting - Parts, Warranty, Working On, Bike Ready, Collected,
  Deliveries, Appointment scheduled, Fitting completed
- An **availability strip** along the bottom showing hours free per day — 27.0 Hrs,
  21.0 Hrs, 0.0 Hrs at weekends
- **Add Leave** and **Schedule Service** actions

This settles §10.3's "drag-and-drop week *and* month diary with per-mechanic columns
(none of the three describe one)". Hubtiger has four views, per-technician lanes,
real time slots, hours-based availability and calendar feed export per technician.

**Drag-to-reschedule works** **[V]**. Job #000096 was dragged from Tuesday
09:00–10:30 to Wednesday 08:00–09:30 and the availability strip recalculated for both
days immediately.

**Adding a POS part to a job takes three actions** **[V]** — open job, type in the
search, click the result. The line lands with SKU and price from Lightspeed, and the
job total renders as time and money together ("1Hr 30Mins | £75.00"). Two buttons
then appear: **Send quote to customer** and **Send quote to POS**. That is the
friction benchmark any "we are easier to use" claim has to beat.

**Job creation** is a five-section wizard — Customer Details, Item Details, Services
and Products, Booking Details, Extras — with a **"Send communication to customer"**
toggle **on by default**. Booking Details carries service type, technician, scheduled
date and time, an optional **required-by date**, booked-in-by, and a **Third Party**
with a "Responsible for payment?" flag. Extras carries "the item is at the store" and
a **Bay/tag no.** Their subcontracting and bay models are real, not just merge
fields.

**The job record** **[V]** carries: a running **timer** with start/stop, a status
dropdown, **three tiers of notes** (Internal — "only shop employees will be able to
see this note" — External, and Customer), a product search **"Search by name, SKU or
other"**, a Services and Products list with Tax and a Total expressed as **both time
and money** ("1Hr 30Mins | £0.00"), and a **"Send quote to customer"** button.

The product search returned nothing because no POS is connected and the catalogue is
empty **[V]**. That is the integration test, still to run.

**Settings reveal the full product scope** **[V]**: Users, Shop Profile, POS
integration, POS Products, Service Types, **Bike Fittings**, Service Imports,
**Pick-ups/Deliveries Setup**, **Custom Service Questions**, **Checklist
Configuration**, **Workshop & Fitting Waivers**, Third Parties, **Online Payments**,
**Coupons**, **Service Deposits**, Message Templates, Message Bundles, WhatsApp
Integration, Text Message Platform Integration, **Website Widget**, **Shop Rides
Widget**, **Receipt Designer**.

Several of those are not in our feature catalogue at all: waivers, service deposits,
checklists, custom service questions, pick-ups and deliveries, bike fittings.

**The POS integration was connected and tested** **[V]**. It works, and it is deeper
than "parts pull":

- `Settings → POS Products` shows the Lightspeed catalogue inside Hubtiger with
  **SKU · Name · Brand · EAN · UPC · Manufacturer SKU · Excluding VAT · Tax ·
  Including VAT**. Lightspeed's own demo stock came through (Nala Dress, Audhild Tee,
  Cluse watches) alongside the seeded service SKUs and `vend-discount` — proof the
  sync is real rather than Hubtiger seed data.
- **VAT is decomposed per line** — ex-VAT, tax and inc-VAT stored separately. Our own
  audit records that VAT is *not* stored data in our till (hardcoded 20% in the UI, no
  VAT return, no MTD). A competitor is doing the thing we listed as a gap, sourced
  from the POS.
- It pulled **configuration**, not just products: default Register (Main Register),
  Tax (VAT), user, and payment type (Cash), read from the Lightspeed account.
- **Technicians can be mapped to POS employees**, so a quote pushed to the till is
  attributed to the right person rather than a generic account.
- The section is headed **"UPDATE VEND CONFIG"** — X-Series confirmed a third time.

So "parts and labor pricing pulled from your POS system" is **verified**, not
marketing.

**Quote push to the POS is broken.** Tested 8 September, twice, on two different jobs.

Their integrations page claims the connection is bidirectional: *"generate quotes
using the inventory directly from your POS/Accounting platform, you can also push
quotes to the POS/Accounting platform."* The first half works. The second does not.

What happens **[V]**:

- The button fires `GET hubtigerservices.azurewebsites.net/api/Invoice/SendToPOS/<id>`
  and receives **HTTP 200**, so the client believes it succeeded.
- The server returns **"Object reference not set to an instance of an object"** — an
  unhandled .NET `NullReferenceException`, surfaced verbatim to the shop.
- Nothing arrives in Lightspeed. Checked **Quotes** (filter widened from the default
  *Open* to *All quotes*, which includes Archived and Completed), **Sales history**,
  and the **Services** module. All empty.

Three explanations were tested and ruled out:

1. **Missing technician-to-POS-employee mapping.** All three rows were unset, which
   was the best configuration candidate for the null. Linked Technician 2 to the POS
   user and retried: identical request, identical failure **[V]**.
2. **A stale or wrong invoice id.** The first attempt called `SendToPOS/4620996` while
   the job was addressed elsewhere as `4686786`, which looked like the cause. A second
   job produced `SendToPOS/4621154` — a different id. **The id is job-specific, so
   this hypothesis was wrong** **[V]**.
3. **Seeded demo data.** Job #96 was demo-provisioned. A job was therefore created
   from scratch (#100 — new customer, new item, POS product line, service type,
   Technician 2) and pushed. **Identical failure** **[V]**.

**And writes to Lightspeed demonstrably work.** The customer created for that test
appeared in Lightspeed's customer list as `ZZTest PosPush`, code `ZZTest-53CH`, with
the email address **[V]**. So this is not a credentials, permissions or trial-tier
restriction on writing. Customer sync succeeds; quote push fails.

What has **not** been ruled out **[NF]**: that the push requires a particular job
status (both test jobs were early-stage — "Waiting - Parts" and "Waiting For Work" —
and a completed job might behave differently), and whether their **R-Series** path
works, since this was only tested on X-Series.

**Also observed:** the job card throws `TypeError: Cannot read properties of null
(reading 'length')` on load, unrelated to the push **[V]**.

**Why this matters.** Regardless of root cause, three things are true and independent
of it: the operation fails, the HTTP status reports success, and the error text is raw
.NET internals rather than anything a mechanic can act on. On the evidence, the
bidirectional half of their integration claim does not survive contact — and
bidirectional is the harder half.

**Receipt Template Designer** — full detail in
`research/business/hubtiger-receipt-designer.md`. Summary: a drag-and-drop WYSIWYG
template editor for **job cards and dispatch memos** (not till receipts, which stay
with the POS), supporting **A4 / A5 portrait and landscape, three label sizes
(50×25, 100×50, 100×150) and Custom**, with merge fields including **Bay Number**,
**Third Party Name and Logo**, **Pre-service checks**, **Checklists**, bike
**Serial No.**, **Barcodes** and **QR Code image** **[V]**. Label support plus
scannable barcodes means printed job tags are part of their workflow. Velodrop's
equivalent is a single Print button with no customisation.

Notably, the feature is **undocumented publicly** — the phrase "Receipt Designer"
returns nothing on hubtiger.com, help.hubtiger.com, or third-party review sites
**[NF]**. It is only visible inside the product.

### 3.6 How Hubtiger charges for SMS — both ways at once

Directly relevant to §6.3. Hubtiger runs **both** models simultaneously **[V]**:

- **Resold credit bundles**, priced in sterling: **500 for £16**, **1000 for £30**,
  **2000 for £56** — £0.032 down to £0.028 per message. The trial seeds 50 free
  credits, and both credit history and usage history are tracked in-app.
- **Bring your own platform** — `Settings → Text Message Platform Integration` offers
  **Ikeono**, **Podium** and **Twilio**, each with a Connect button.

So the model chosen in §6.3 is **parity with Hubtiger, not a differentiator**. Their
running both suggests the bundles are what most shops actually take, with
bring-your-own as the power-user path. Two consequences worth weighing:

1. Their SMS revenue sits *on top of* a $52–$125/month subscription. Ours would sit on
   top of nothing. The free-software position still holds; it is the messaging
   economics that are matched, not the overall price.
2. Whether £0.028–£0.032 per message is above or below UK wholesale has **not** been
   checked **[NF]**. Worth doing before any claim that bring-your-own saves a shop
   money — that claim is currently unevidenced.

## 4. Corrections forced to existing research

| Existing claim | Correction |
|---|---|
| §10.3 "service reminders (Velodrop has them)" **[V]** | Contradicted. Velodrop has *appointment* reminders only. Downgrade to **[U]** pending a check of remaining customer-side surfaces |
| §10.3 "quotes/estimates — nobody clearly has" | Wrong as stated. Velodrop has a single-figure quote plus a call-if-over ceiling; Hubtiger and QuoteMachine both advertise full quoting |
| §10.3 "explicit capacity/overlap logic" as ours alone | Velodrop has enforced, hours-aware, per-day capacity. Different from ours (per-slot), not absent |
| §10.3 "ahead: auto-created linked order billable at the till" | Lightspeed X-Series' own Services module attaches jobs to a sale receipt natively |
| Lightspeed decision §7.2 "Velodrop and Bikebook trials" | Velodrop done, 8 Sep. Bikebook not started. Superseded in priority by Hubtiger — see §6.2 |
| Lightspeed decision §8 "R-Series closed to new customers" **[NF]** | Evidence toward, not proof: public self-serve signup gives X-Series |
| Same-day claim that Hubtiger has no Citrus-Lime integration | **Wrong, corrected within the hour.** Absent from their marketing page, present in the product (§3.4). Inferred absence, not checked absence |

## 5. What §7.2 was actually asking, answered

> "§1.4 makes 'better than theirs' the product's whole reason to exist, and this is
> the only thing that tests it."

**Against Velodrop, "better than theirs" holds comfortably.** They have no diary at
all — a per-day counter, a month grid, and a queue.

**Against Hubtiger it does not — and this is no longer marketing.** §3.5 verified the
diary in the running product: four views, per-technician lanes, real time slots,
hours-based availability, iCal export per technician. The job record has a timer,
three note tiers, a SKU product search and a send-quote action. The claims that
remain unverified are the POS-sourced parts and the quote approval round trip, both
of which need the integration connected.

This does not falsify the platform decision. It falsifies a *feature-superiority*
story that §6 of that decision had already declined to rely on:

> "'Free' and 'better' are worth little on their own here; 'free, better, and it
> becomes your till' is the position."

That judgement now looks correct. The differentiation has to carry on §4 — the
migration and till story — because a feature comparison against Hubtiger will not
carry it.

## 6. Strategy and decisions, 8 September 2026

### 6.1 Jack's position

Match Hubtiger on features; beat it on friction and quality-of-life; make the software
completely free; offer the option to combine it with our POS.

The asymmetry this rests on is real and Hubtiger structurally cannot copy it: they are
a bolt-on and need the shop to keep paying someone else for the till. We can give the
workshop away because the workshop is the on-ramp, not the product.

Two risks recorded against it:

- **Parity is a large build and does not differentiate.** Every month spent reaching
  feature parity is a month not spent on the migration and till story that actually
  wins. Ordering matters.
- **"Beats it on friction" is currently unfalsifiable.** Nobody has used Hubtiger. All
  §3 evidence is marketing. Friction can only be assessed by using the product — which
  makes the 7-day trial the next thing, not a later thing.

### 6.2 DECIDED — Hubtiger replaces Bikebook as the trial priority

Decided by Jack, 8 September 2026. Testing ourselves against Velodrop tests us against
the wrong company. §7.2's pairing of "Velodrop and Bikebook" is superseded:
**Velodrop done, Hubtiger next, Bikebook optional.**

### 6.3 DECIDED — free software, customer-supplied integration accounts

Decided by Jack, 8 September 2026.

The software is **completely free**. Anything carrying a real marginal cost is the
shop's own account, paid by them directly to the provider — **bring your own**, not
resold by us. Where a shop has no account, we point them at creating one and guide
them through it.

Rejected alternative: reselling messaging credits. Better experience, but it means
building billing — and the repo's own audit records that the till has **no refunds,
voids or returns** and that **VAT is not stored data** (hardcoded 20% in the UI, no
VAT return, no Making Tax Digital). Selling credits to UK shops means VAT-correct
invoicing, which is a project, not a switch.

**Two consequences that follow directly:**

1. **We will store customer API credentials.** A Twilio key pasted into our system is
   a live credential that spends the shop's money. Encryption at rest, per-tenant
   isolation, revocation and rotation are requirements, not niceties. The research
   already records a **verified cross-tenant exploit** in this codebase; holding
   customer keys raises the cost of that bug class considerably.
2. **Support burden lands on us regardless.** A shop whose Twilio balance runs dry
   will call us, not Twilio. The guided setup should surface the provider's balance
   and give an unambiguous "this is your provider, not us" error state.

**Recorded after the decision was taken:** §3.6 shows Hubtiger already offers
bring-your-own (Ikeono, Podium, Twilio) *alongside* resold bundles. The decision is
therefore parity on this axis, not differentiation, and it does not by itself save a
shop money — that would need a wholesale-versus-£0.028 comparison nobody has done.
None of that invalidates the decision; it removes a reason to claim credit for it.

**Framing to protect.** Say plainly and early: the software is free, messaging is
billed by the messaging provider. Note also that a Shopify subscription is the shop's
own existing bill, not a cost we pass through — framing the two identically invites
the accusation that "free" has hidden charges when it does not. This project's own
corrections log already carries a fabricated-competitor-price entry; "free*" with an
asterisk is the fastest way to be bitten twice.

### 6.4 OPEN — for Jack

1. **Parity ordering.** Which Hubtiger-parity features come before the migration and
   till story, and which come after? §6.1 records the risk; it does not resolve it.
2. **First adapter: R-Series or X-Series?** The plan targets R-Series. The account a
   new shop can actually get is X-Series. §10 of the Lightspeed decision deferred
   X-Series without ruling it out. This needs deciding, and it is upstream of the sync
   loop work.
3. **Do we chase R-Series access?** Asking Lightspeed UK sales would settle both the
   R-Series availability question and §7.1 (how many UK shops run Lightspeed) in one
   conversation.

## 7. Still outstanding

| Item | Blocked on |
|---|---|
| Hubtiger trial | **Started 8 Sep**, 7 days. Calendar, job record, settings and SMS pricing verified (§3.5, §3.6) |
| **Hubtiger ↔ Lightspeed X-Series integration test** | Both trials live and both Jack's. Hubtiger's POS screen offers **Lightspeed-X** directly. Tests the parts-pull and quote-push claims end to end. Needs Jack's go-ahead to connect. Window is 7 days |
| Does quote push work from a *completed* job, or on R-Series? | The two remaining explanations for the push failure. Both untested |
| Quote approval round trip — what the customer receives | Not sent; it would message a real address and spend a trial SMS credit |
| Is £0.028–£0.032/SMS above or below UK wholesale? | Unchecked. Blocks any "bring-your-own saves money" claim |
| Velodrop pending-approval booking queue | Needs shop hours set in the Velodrop trial |
| Velodrop → Lightspeed write-back depth | Blocked behind the X-Series developer portal (§2.2). Lower value since the Hubtiger pivot |
| `Workorder` / `WorkorderLine` timestamp | Needs an R-Series account. Still blocks the sync loop design |
| QuoteMachine listing | Ten minutes. Second source on the quotes gap |
| Bikebook trial | Optional after §6.2 |

## 8. Housekeeping

Test record **appointment 241105 ("ZZTest Trial")** was created in the Velodrop trial
on 8 September and left in place. Delete it from the appointment detail view if the
account is kept.
