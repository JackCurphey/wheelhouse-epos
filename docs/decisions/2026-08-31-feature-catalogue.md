# Feature catalogue

**Date:** 31 August 2026
**Purpose:** every feature of the whole tool in one list, as the implementation
spec — the agreed set of what gets built. This is the input to the roadmap, not
the roadmap itself; `docs/superpowers/plans/2026-08-31-master-implementation-plan.md`
holds sequencing and ownership.

**Three steps, in this order. Do not merge them.**

| Step | Question | Tracked in |
|---|---|---|
| **1. Agree the features** | Is this the right set? Anything wrong, missing or misdescribed? Each one is In, Out, Change or Missing | Issue #16 |
| 2. Organise into releases | What ships together, and in what order? | Opens when step 1 lands |
| 3. Assign and schedule | Who builds what, by when? | Opens after step 2 |

You cannot sensibly prioritise a list you have not agreed, which is why step 1
carries no priorities and no dates. Priority and release columns are deliberately
blank here and in the spreadsheet.

**Today** is verified against the code where it says Have, Partial or None.
`Unknown` means it needs checking before anyone plans around it.

**214 features across 20 areas.** Have: 55 · Partial: 11 · None: 146 · Unknown: 2.

**Read the dependencies before assigning priorities.** A high priority on a
feature whose prerequisite is low produces a plan that cannot be built. The
three that gate the most: **COM-03 email** (nothing customer-facing works
without it), **JOB-12 labour lines** (no invoice, estimate or profit split
without it), and **PAY-05 the payments decision** (blocks paying from the
job-done email).

---

## Accounts & access

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| ACC-01 | Self-serve shop signup | A shop creates its own account and reaches a working till with no human involved | None | — | |
| ACC-02 | Shop profile and settings | Name, address, opening hours, VAT number, logo | Partial | — | |
| ACC-03 | Staff accounts | Add, edit and deactivate people on the team | Have | — | |
| ACC-04 | Roles and permissions | More than owner/not-owner. Restrict who can discount, refund, see reports, edit stock | None | — | |
| ACC-05 | Password reset by email | Blocked entirely today - there is no email capability | None | COM-03 | |
| ACC-06 | Two-factor authentication | Optional second factor for staff sign-in | None | COM-03 | |
| ACC-07 | Session management | See active sessions, sign a device out | Partial | — | |
| ACC-08 | Staff action audit log | Who changed a price, voided a sale, edited a job | None | — | |
| ACC-09 | Multiple sites per account | One owner, several shops, shared or separate stock | None | — | |

## Till

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| TILL-01 | Add items by search or tap | Find a product by name, SKU or category and add it to the sale | Have | — | |
| TILL-02 | Barcode scanning at the till | Scan to add, scan to look up | Have | — | |
| TILL-03 | Quantity and line editing | Change quantity, remove a line | Have | — | |
| TILL-04 | Discounts | Per line and whole-sale, with a reason | Have | — | |
| TILL-05 | Cash payment with change calculation |  | Have | — | |
| TILL-06 | Card payment recorded | Records that a card was used; the terminal is separate | Have | — | |
| TILL-07 | Split payment | Part cash, part card, or two cards | None | — | |
| TILL-08 | Park and resume a sale | Hold a basket while you serve someone else | None | — | |
| TILL-09 | Refunds | Reverse a completed sale, return stock | None | — | |
| TILL-10 | Voids | Cancel a sale before it completes | None | — | |
| TILL-11 | Returns and exchanges | Take an item back, swap it, handle the price difference | None | — | |
| TILL-12 | Receipt printing |  | Have | — | |
| TILL-13 | Email or text the receipt | Send it instead of, or as well as, printing | None | COM-03 | |
| TILL-14 | Cash-up / Z-report | End-of-day count, expected versus actual, variance | None | — | |
| TILL-15 | Till float and cash movements | Opening float, paid-outs, banking | None | — | |
| TILL-16 | Attach a customer to a sale |  | Have | — | |
| TILL-17 | Deposits and part payment | Take money now, the rest on collection | None | — | |
| TILL-18 | Gift cards |  | None | — | |
| TILL-19 | Store credit | Credit on account instead of a refund | None | — | |
| TILL-20 | Cash drawer open on sale | Verify against the print agent | Unknown | — | |

## Inventory

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| INV-01 | Product create, edit, deactivate | SKU, category, price, cost, supplier, low-stock threshold | Have | — | |
| INV-02 | Receive stock |  | Have | — | |
| INV-03 | Manual stock adjustment | With a reason | Have | — | |
| INV-04 | Product images |  | Have | — | |
| INV-05 | Stock take / rolling count | Count a section, reconcile the difference | None | — | |
| INV-06 | Product variants | Size and colour as one product. Bike sizing will force this eventually | None | — | |
| INV-07 | Serialised stock | Track an individual bike by frame number through purchase and sale | None | — | |
| INV-08 | Barcode label printing | Generate and print shelf and product labels | Partial | — | |
| INV-09 | Import products from a spreadsheet |  | Unknown | — | |
| INV-10 | Live supplier stock and price feed | Distributor catalogue in the product search | None | — | |
| INV-11 | Margin and price rules | Set price from cost plus a margin, bulk reprice | None | — | |
| INV-12 | Stock across multiple locations |  | None | — | |

## Purchasing

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| PUR-01 | Supplier records |  | Have | — | |
| PUR-02 | Purchase orders | Raise, edit, track | Have | — | |
| PUR-03 | Split deliveries | Part of an order arrives | Have | — | |
| PUR-04 | Receive against a purchase order |  | Have | — | |
| PUR-05 | Send a purchase order to the supplier electronically | Today there is no submission path at all | None | — | |
| PUR-06 | Raise a backorder from a job | Mechanic needs a part, it becomes a PO line | None | JOB-11 | |
| PUR-07 | Supplier invoice reconciliation | Match what arrived to what was billed | None | — | |

## Customers

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| CUS-01 | Customer records | Name, phone, email, notes | Have | — | |
| CUS-02 | Customer groups and discounts |  | Have | — | |
| CUS-03 | Sales history per customer |  | Have | — | |
| CUS-04 | Workshop history per customer | Today history is reachable only per bike, so a job with no bike appears nowhere | None | — | |
| CUS-05 | Merge duplicate customers |  | None | — | |
| CUS-06 | Marketing consent and opt-out flags | Required before any marketing message is legal | None | — | |
| CUS-07 | Customer portal account | Customer signs in to see their own bookings | Have | — | |
| CUS-08 | Verify a phone number or email | Guest booking currently matches an existing customer on unverified phone alone | None | — | |

## Bikes

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| BIKE-01 | Bike record attached to a customer | Make, model, colour, serial number, notes | Have | — | |
| BIKE-02 | Service history per bike |  | Have | — | |
| BIKE-03 | Customer adds their own bike in the portal | Exists today. Reviewed 31 Aug: not considered a priority | Have | — | |
| BIKE-04 | Extended spec fields | Year, frame size, wheel size, groupset, e-bike system | None | — | |
| BIKE-05 | Bike photo |  | None | — | |
| BIKE-06 | Purchase details and warranty | Bought here or not, purchase date, warranty expiry | None | — | |
| BIKE-07 | Serial number search and duplicate detection | No index and no uniqueness today, so lookup is a full scan | None | — | |
| BIKE-08 | Shop-verified service facts | Hanger, bottom bracket standard, rotor mount, chain speed, tyre and valve. Captured once, reused forever. No data source sells these | None | BIKE-04 | |
| BIKE-09 | Spec autofill from a catalogue | Type the model, components appear. Depends on 99spokes commercial terms | None | BIKE-04 | |
| BIKE-10 | Recall and safety-notice matching | Flag bikes affected by a manufacturer recall. No competitor offers this | None | BIKE-04 | |
| BIKE-11 | Wear-parts mapping | This bike takes this chain and these pads. Built from our own job history | None | BIKE-08 | |
| BIKE-12 | Bike tag or label for the workshop | Print a tag so the right bike matches the right job | None | — | |
| BIKE-13 | Rider-owned shareable bike record | A rider holds the record and shares it with any shop. Frozen until after G3 | None | — | |
| BIKE-14 | Stolen-bike registry check | Check a serial against Bike Index at record creation. Staff-facing flag only | None | — | |

## Workshop jobs

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| JOB-01 | Create a job | Title, customer, bike, mechanic, date, time | Have | — | |
| JOB-02 | Job statuses | Pending, scheduled, waiting for parts, on hold, complete | Have | — | |
| JOB-03 | Status change history | Who moved it, when. Today nothing is recorded | None | — | |
| JOB-04 | Assign a mechanic |  | Have | — | |
| JOB-05 | Job notes | One free-text field today | Have | — | |
| JOB-06 | Internal versus customer-visible notes | The single notes field is currently sent to the customer | None | — | |
| JOB-07 | File attachments on a job |  | Have | — | |
| JOB-08 | Photos taken on a phone | No camera capture, thumbnails or captions today | None | — | |
| JOB-09 | Parts added to a job | Writes through to the job's order | Have | — | |
| JOB-10 | Reserve or allocate parts to a job | Stock is not deducted until the sale | None | — | |
| JOB-11 | Waiting-for-parts linked to a purchase order | Today it is a status a mechanic tracks in their head | None | PUR-06 | |
| JOB-12 | Labour lines | A time and a rate. Today labour can only be faked as a product row | None | — | |
| JOB-13 | Service menus and fixed-price packages | A named service with a set price and duration | None | JOB-12 | |
| JOB-14 | Job number or reference | Something to say on the phone, distinct from a database id | None | — | |
| JOB-15 | Promised date distinct from booked date | When the customer was told it would be ready | None | — | |
| JOB-16 | Priority or urgency flag |  | None | — | |
| JOB-17 | Job sheet or worksheet printing | A sheet that goes on the bike | None | — | |
| JOB-18 | Job to till order link |  | Have | — | |
| JOB-19 | Reopen a completed job | Works, but currently loses the previous status | Partial | — | |
| JOB-20 | Time tracking on a job | Clock on and off, actual versus estimated | None | — | |
| JOB-21 | More than one mechanic on a job |  | None | — | |
| JOB-22 | Workshop-only mode | A job completes without a linked till sale, for a shop with no till of ours | None | — | |
| JOB-23 | Server-side enforcement of job rules | Overlap, hours and working days are enforced in the browser only for staff routes | Partial | — | |

## Calendar

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| CAL-01 | Week view |  | Have | — | |
| CAL-02 | Month view |  | Have | — | |
| CAL-03 | Day view |  | None | — | |
| CAL-04 | Per-mechanic columns |  | Have | — | |
| CAL-05 | Drag to place, move and resize | Week view only; month is click-to-open | Have | — | |
| CAL-06 | Unscheduled jobs row | Jobs with no time yet | Have | — | |
| CAL-07 | Opening hours configuration | On the hour only today | Have | — | |
| CAL-08 | Working days per mechanic | Weekly pattern, no date exceptions | Have | — | |
| CAL-09 | Day-is-full capacity threshold | Configurable, but gates the portal only | Partial | — | |
| CAL-10 | Overlap prevention | Browser-only for staff routes | Partial | JOB-23 | |
| CAL-11 | Mechanic holidays and absence |  | None | — | |
| CAL-12 | Breaks and lunch | Opening hours are one contiguous window | None | — | |
| CAL-13 | Shop closures and bank holidays |  | None | — | |
| CAL-14 | Bays or workstations as a resource | Schedule against a stand, not only a person | None | — | |
| CAL-15 | Calendar export or subscribe | iCal feed a mechanic can add to their phone | None | — | |
| CAL-16 | Waiting list | Take a booking for when a slot frees up | None | — | |
| CAL-17 | Workshop wall display | A screen in the workshop showing today's jobs | None | — | |

## Online booking

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| BOOK-01 | Public booking page per shop |  | Have | — | |
| BOOK-02 | Guest booking without an account |  | Have | — | |
| BOOK-03 | Booking with a customer account |  | Have | — | |
| BOOK-04 | Job type and duration selection | Quick, repair, service - fixed in code, not per shop | Partial | — | |
| BOOK-05 | Availability display | Shows free slots without leaking job details | Have | — | |
| BOOK-06 | Pending approval queue | Shop approves before it is confirmed | Have | — | |
| BOOK-07 | Reject a booking with a reason | No reject action exists | None | — | |
| BOOK-08 | Customer cancels or reschedules | Neither is possible today | None | — | |
| BOOK-09 | Deposit taken at booking | Reduces no-shows. Only Bikebook does this | None | PAY-04 | |
| BOOK-10 | Booking confirmation message |  | None | COM-04 | |
| BOOK-11 | Appointment reminder before the date |  | None | COM-04 | |
| BOOK-12 | Describe the problem in the customer's words | Free text plus photos at booking | Partial | — | |

## Communication

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| COM-01 | Manual text to a customer | Staff type it; Twilio; logged | Have | — | |
| COM-02 | Message history on the customer |  | Have | — | |
| COM-03 | Email capability | Nothing exists today. Blocks reset, receipts, notifications, invoices | None | — | |
| COM-04 | Automated status-triggered messages | Booked, in progress, waiting for parts, ready to collect | None | COM-03, JOB-03 | |
| COM-05 | Per-shop message templates | Wording the shop controls | None | COM-04 | |
| COM-06 | Two-way messaging on the job | Customer replies land against the job | None | — | |
| COM-07 | Service reminders | Due for a service based on last visit or mileage | None | COM-03 | |
| COM-08 | Review request after collection |  | None | COM-03 | |
| COM-09 | Opt-out handling and suppression list | Legally required before any marketing message | None | CUS-06 | |

## Job-done email

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| DONE-01 | Plain-English summary of what was done | Written for a customer, generated from the job, not composed by hand | None | — | |
| DONE-02 | Photos on the summary | Before and after, or what was worn | None | JOB-08 | |
| DONE-03 | Itemised pricing | Parts and labour separated and legible | None | JOB-12 | |
| DONE-04 | Invoice document | A real invoice with VAT | None | REP-05 | |
| DONE-05 | Pay in one tap | Customer pays from the email. Shop keeps its own processor | None | PAY-05 | |
| DONE-06 | Payment status tracking | Sent, viewed, paid, overdue | None | DONE-05 | |
| DONE-07 | The assembled job-done email | The named artefact of the whole product | None | DONE-01..06 | |
| DONE-08 | Collection instructions | When and how to collect, opening hours | None | DONE-07 | |

## Inspections

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| INS-01 | Reusable checklist templates | A safety check the shop defines once | None | — | |
| INS-02 | Photos per inspection item |  | None | JOB-08 | |
| INS-03 | Itemised estimate from flagged items |  | None | JOB-12 | |
| INS-04 | Per-line customer approval | Approve two of four, decline the rest | None | INS-03 | |
| INS-05 | Approved lines flow into the job | No re-keying | None | INS-04 | |
| INS-06 | Quote before work starts | Distinct from mid-job approval | None | INS-03 | |

## Reporting

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| REP-01 | Today's takings dashboard |  | Have | — | |
| REP-02 | Low stock alerts |  | Have | — | |
| REP-03 | Top sellers | Today only | Have | — | |
| REP-04 | Date-range sales reporting |  | None | — | |
| REP-05 | VAT stored as data and a VAT return report | 20% is hardcoded in the UI today | None | — | |
| REP-06 | Workshop throughput | Jobs booked, completed, average turnaround | None | — | |
| REP-07 | Mechanic utilisation | How full the diary was against capacity | None | — | |
| REP-08 | Labour versus parts revenue split |  | None | JOB-12 | |
| REP-09 | Technician efficiency | Billed against actual time. Absent from every cycling tool | None | JOB-20 | |
| REP-10 | Customer retention and repeat rate |  | None | — | |
| REP-11 | Export any report to a spreadsheet |  | None | — | |

## Data

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| DAT-01 | Export everything to CSV | Our own anti-lock-in claim depends on this | None | — | |
| DAT-02 | Import customers and bikes |  | None | — | |
| DAT-03 | Migration in from an incumbent, done for the shop | The closing lever. Nobody in the market solves getting data out | None | DAT-02 | |
| DAT-04 | Managed database with point-in-time recovery |  | None | — | |
| DAT-05 | Rehearsed restore with a written runbook | Performed and timed, not assumed | None | DAT-04 | |
| DAT-06 | Scheduled export a shop can automate |  | None | DAT-01 | |

## Payments

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| PAY-01 | Record a cash sale |  | Have | — | |
| PAY-02 | Record a card sale |  | Have | — | |
| PAY-03 | Integrated card terminal | Amount pushed to the terminal, result returned | None | — | |
| PAY-04 | Take a deposit |  | None | PAY-05 | |
| PAY-05 | Payment architecture decision | Shop's own processor versus a platform account. Largest unscoped item; blocks the job-done email | None | — | |
| PAY-06 | Refund to card |  | None | PAY-03 | |
| PAY-07 | Subscription billing for our own fee | Not needed before three paying shops | None | — | |

## Ecommerce

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| ECOM-01 | Storefront | Built; frozen until after G3 | Have | — | |
| ECOM-02 | Shopify sync | Built; onboarding docs are stale since Jan 2026 | Partial | — | |
| ECOM-03 | Custom domain for a storefront | Frozen | None | — | |
| ECOM-04 | Click and collect | Order online, collect in store | None | — | |

## Hardware

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| HW-01 | Receipt printing via the local agent |  | Have | — | |
| HW-02 | Label printing |  | Have | — | |
| HW-03 | Barcode scanner support |  | Have | — | |
| HW-04 | Signed installer for the print agent | A shop owner installs it unaided | None | — | |
| HW-05 | Prescribed hardware bundle | One tested list with part numbers and a price | None | — | |
| HW-06 | Tablet layout for the workshop | The mechanic's surface, not the office's | None | — | |

## Platform

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| PLT-01 | Multi-tenant isolation by row-level security | 25 tables enabled and forced, verified live | Have | — | |
| PLT-02 | Composite tenant foreign keys | Cross-tenant references are currently accepted by the database | None | — | |
| PLT-03 | Privilege boundary on resolver tables | Seven tables have no row-level security | None | — | |
| PLT-04 | Transaction-local tenant state | Session-scoped today, in two files | None | — | |
| PLT-05 | Idempotency on irreversible writes | A duplicate submit can create two sales | None | — | |
| PLT-06 | Outbox for outgoing Shopify work |  | None | — | |
| PLT-07 | Retryable inbound Shopify events | A failure then a retry currently skips the work permanently | None | — | |
| PLT-08 | Migration advisory lock |  | None | — | |
| PLT-09 | Pool checkout timeout and instrumentation | Unbounded wait today | None | — | |
| PLT-10 | Network timeouts on outbound calls | Two fetch helpers with no abort signal | None | — | |
| PLT-11 | Graceful shutdown and crash logging |  | None | — | |
| PLT-12 | Readiness and liveness endpoints, wired to deployment |  | None | — | |
| PLT-13 | Error tracking |  | None | — | |
| PLT-14 | Uptime monitoring |  | None | — | |
| PLT-15 | Public status page | Cloud outages disabling the till is a documented market complaint | None | PLT-14 | |
| PLT-16 | Staging environment and rollback |  | None | — | |
| PLT-17 | Rate limiting | Present on login and booking paths | Partial | — | |
| PLT-18 | Usage instrumentation | Jobs booked per shop per week - how Gate G2 is measured | None | — | |

## Front door

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| FD-01 | Marketing website |  | None | — | |
| FD-02 | Published pricing page | One number, inc VAT | None | FD-01 | |
| FD-03 | Help and how-to documentation |  | None | FD-01 | |
| FD-04 | Changelog written for a bike shop | Screenshots and a sentence, not release notes | None | FD-01 | |
| FD-05 | Community forum for design partners | Email-in and email-reply required; SSO from the product | None | — | |
| FD-06 | In-product feedback | One button, context attached, no account needed | None | — | |
| FD-07 | Onboarding walkthrough | First-run guidance for a shop with an empty database | None | — | |

## Compliance

| ID | Feature | What it means | Today | Depends on | Priority |
|---|---|---|---|---|---|
| LEG-01 | Privacy notice for shops |  | None | — | |
| LEG-02 | Privacy notice for riders | Required before any direct rider account | None | — | |
| LEG-03 | Data processing agreement offered to shops |  | None | — | |
| LEG-04 | Cookie consent | If any non-essential cookie is set | None | — | |
| LEG-05 | Retention schedule | Rider-facing view versus the shop's legal copy | None | — | |
| LEG-06 | EXIF location stripped on upload | Riders photograph bikes at home | None | JOB-08 | |
| LEG-07 | Append-only attributed entries | A customer cannot edit a mechanic's record | None | — | |
| LEG-08 | Dispute flag with right of reply |  | None | LEG-07 | |
| LEG-09 | Subject access and erasure handling |  | None | — | |
| LEG-10 | Age gate and age-appropriate defaults | The Children's Code catches services likely to be accessed by children | None | — | |

---

## Notes on a few entries

**BIKE-03, customer adds their own bike.** This exists today in the portal.
Reviewed 31 August and judged not a priority — kept in the list so the
decision is recorded rather than forgotten.

**BIKE-13, the rider-owned shareable record.** Researched in depth and frozen
until after Gate G3. It is the leading candidate for that unlock.

**JOB-23 and CAL-10.** These are not new features. The rules exist but are
enforced in the browser only for staff routes, so a raw HTTP call bypasses
them. Counted as Partial rather than Have on purpose.

**PLT-02 and PLT-03.** Both are live isolation defects found by the
architecture review, not improvements. They block onboarding any real shop.
