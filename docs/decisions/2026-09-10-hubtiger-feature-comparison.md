# Hubtiger feature comparison — for Jack to prioritise

**Status:** Candidate list. Not a scope decision. Jack is the control gate: nothing
here enters the first release until he ranks it.
**Date:** 10 September 2026.
**Rows:** 317 Hubtiger features, each with where Wheelhouse stands.

## How to read it

The Hubtiger column comes from the authenticated walk in
`docs/decisions/2026-09-10-hubtiger-live-analysis.md` §§2–8 (observed) and Jack's
8 Sep trial. The "our status" column is one of:

- **BUILT-in-app** — exists in the legacy Wheelhouse app under `server/` and `public/`.
- **BUILT-in-prototype** — exists in the standalone `prototype/` demo only. Not product code.
- **IN-SPEC (not built)** — a specification, plan task or acceptance scenario names it; nothing runs.
- **EXPLICITLY-DEFERRED** — a document says we chose not to build it, or not yet.
- **NOT-MENTIONED** — no Wheelhouse document mentions it. Absence in our documents, not a judgement.

Every status carries a citation to the document that says so. Document keys:
**WS** `docs/superpowers/specs/2026-08-31-workshop-first-build.md` ·
**MP** `docs/superpowers/plans/2026-08-31-master-implementation-plan.md` ·
**PD** `docs/reviews/2026-09-08-workshop-prototype-decisions.md` ·
**AC** `docs/reviews/2026-09-08-spec-acceptance-scenarios.md` ·
**OV** `prototype/OVERNIGHT.md` ·
**CT** `docs/decisions/2026-09-08-competitive-trials.md` §6 ·
**HT§10** the Hubtiger report's own §10, a proposal, cited only where nothing else mentions the feature.

The **Jack's priority** column is empty on purpose. It is filled by the ranking
exercise in the GitHub issue that points here.

The 8 Sep adversarial review (F04) ruled that Hubtiger parity is a candidate
backlog, not a launch requirement. This document is that backlog, made concrete.

---

## Booking widget / customer front door

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 1 | Online customer self-booking into a shop calendar | BUILT-in-app | WS §2 table, "Us today" = "Have — portal, guest booking by phone, server-side capacity gate" | |
| 2 | Embeddable website widget (iframe or URL) | NOT-MENTIONED | no spec mention of an embeddable widget; MP WEB-1 covers a marketing site only | |
| 3 | Guest booking with no account | BUILT-in-prototype | PD "Customer entry"; OV P-02 | |
| 4 | Booking lead-time in days setting | NOT-MENTIONED | — | |
| 5 | Widget language selection | NOT-MENTIONED | — | |
| 6 | Pre-selected service type or service group on the widget | NOT-MENTIONED | — | |
| 7 | Additional-info and payment-info free text on the widget | NOT-MENTIONED | — | |
| 8 | Show prices on the widget | IN-SPEC (not built) | AC §6 BOOK-04, "honors price visibility" | |
| 9 | "Where did you hear about us" capture | NOT-MENTIONED | — | |
| 10 | Allow coupon entry at booking | NOT-MENTIONED | Coupons named "plausibly deferrable", HT§10 | |
| 11 | Show pre-approved amount on the widget | IN-SPEC (not built) | PD "Authorisation", advance permission up to a spending limit (built in prototype, not on a public widget) | |
| 12 | Google Tag Manager on the widget | NOT-MENTIONED | HT§10 lists GTM as deferrable | |
| 13 | Facebook Pixel on the widget | NOT-MENTIONED | HT§10 lists Pixel as deferrable | |
| 14 | Widget theme colours and 22 fonts | NOT-MENTIONED | — | |
| 15 | Customer picks a date only, no time of day | IN-SPEC (not built) | PD "Booking": shops choose exact appointments or day-based drop-offs — ours offers both; AC-18 | |
| 16 | Custom service questions asked on the widget | NOT-MENTIONED | — | |
| 17 | Free-text problem description in the customer's own words | BUILT-in-prototype | PD "Customer entry"; OV P-02 | |
| 18 | Customer photo/video attachment at request time | BUILT-in-prototype | PD "Customer entry"; OV P-02, both camera and file-library inputs | |
| 19 | Customer return-access link (progress link) | BUILT-in-prototype | PD "Return access"; OV P-12 (token rotation on reset) | |
| 20 | Instant confirmation vs shop review before confirmation | BUILT-in-prototype | PD "Acceptance"; OV P-03 | |
| 21 | Service-specific acceptance rules | BUILT-in-prototype | OV P-03, "per-service rules: routine auto, unknown reviewed" | |
| 22 | Pending-request expiry / review deadline | IN-SPEC (not built) | AC-12, AC-14; AC §6 BOOK-06–08 | |
| 23 | Customer cancel and reschedule | IN-SPEC (not built) | WS §4 W1 item 9; MP WS-5 | |
| 24 | Shop reject with a reason | IN-SPEC (not built) | WS §4 W1 item 9; MP WS-5 | |
| 25 | Arrival lead time before opening | IN-SPEC (not built) | AC-20 | |
| 26 | Deposit taken during online booking | EXPLICITLY-DEFERRED | WS §4 "Deliberately deferred": "Deposits at booking" | |

## Calendar / diary

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 27 | Workshop diary with per-mechanic columns | BUILT-in-app | MP §3 "Real and working": "workshop diary with per-mechanic columns" | |
| 28 | Day view | BUILT-in-app | MP §3 (diary); PD "Devices", scheduling on a larger screen | |
| 29 | Week view | NOT-MENTIONED | — | |
| 30 | 2-week view | NOT-MENTIONED | — | |
| 31 | Month view | NOT-MENTIONED | — | |
| 32 | Technicians as calendar resource rows | BUILT-in-app | MP §3, per-mechanic columns | |
| 33 | Sort calendar resources | NOT-MENTIONED | — | |
| 34 | Per-technician iCal subscription link | NOT-MENTIONED | — | |
| 35 | Per-technician Configure control | NOT-MENTIONED | — | |
| 36 | Per-day hours-available strip per technician | IN-SPEC (not built) | AC-19; HT§10 item 7 (staff hours/leave driving the availability strip) | |
| 37 | Colour-coded status legend on the calendar | NOT-MENTIONED | — | |
| 38 | Renameable status labels on the calendar | NOT-MENTIONED | AC §6 JOB-02/JOB-19 defines states, not renaming | |
| 39 | Drag-to-reschedule | BUILT-in-app | MP §3 diary; WS §1 notes staff-move rules exist in `public/app.js` | |
| 40 | Server-side overlap prevention on staff moves | IN-SPEC (not built) | WS §1 and §4 W0 item 1; MP DS-8 (D9) | |
| 41 | Opening-hours clamping server-side | IN-SPEC (not built) | MP DS-8, "03:00 rejected" | |
| 42 | Working-day / closed-day blocking server-side | IN-SPEC (not built) | MP DS-8, "closed Sunday rejected" | |
| 43 | 5 / 15 / 30-minute calendar grid | NOT-MENTIONED | — | |
| 44 | Labour goals shown on the calendar | NOT-MENTIONED | — | |
| 45 | Labour totals and revenue on the day slide-out | NOT-MENTIONED | — | |
| 46 | Show original booking date on the calendar | NOT-MENTIONED | — | |
| 47 | Bike type shown on the calendar card | NOT-MENTIONED | — | |
| 48 | Capacity gate on customer booking | BUILT-in-app | WS §2, "server-side capacity gate" | |
| 49 | Drop-off day reserves capacity without promising a start time | BUILT-in-prototype | PD "Booking"; OV P-04; AC-16 | |
| 50 | Reschedule refused when capacity is gone | BUILT-in-prototype | OV §"Also proven", "Sam has no remaining capacity that day." | |

## Job list (Services)

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 51 | Job list as a table | BUILT-in-app | MP §3 (workshop diary and jobs); WS §2 "Digital work order with status" | |
| 52 | KPI tiles (Open Jobs, Bike Ready, Cancelled, Bike Is Here, I Need Help) | NOT-MENTIONED | — | |
| 53 | Status filter chips | NOT-MENTIONED | — | |
| 54 | Job list search | NOT-MENTIONED | — | |
| 55 | Job list CSV export | IN-SPEC (not built) | MP TILL-3, "CSV export of everything" | |
| 56 | Column: technician | BUILT-in-app | MP §3, per-mechanic diary columns imply assignment | |
| 57 | Column: original booking date | NOT-MENTIONED | HT§10 item 4 names original date as parity | |
| 58 | Column: days since original date (ageing) | NOT-MENTIONED | HT§10 item 4 | |
| 59 | Bulk cancel | NOT-MENTIONED | — | |
| 60 | Bulk collect | NOT-MENTIONED | — | |
| 61 | Bulk complete | NOT-MENTIONED | — | |
| 62 | Shared queue jobs staff can take | BUILT-in-prototype | PD "Work allocation"; OV P-05 | |

## Job card

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 63 | Digital work order / job card | BUILT-in-app | WS §2, "Have — five statuses, no state machine, no history" | |
| 64 | Job card opens as a modal over the list | BUILT-in-prototype | OV P-06, "inspection dialog" layout checks | |
| 65 | Human-readable job number | IN-SPEC (not built) | AC §6 JOB-14–15, "Stable job reference … distinct from database ID" | |
| 66 | Minimum job-card number setting | NOT-MENTIONED | — | |
| 67 | Scheduled date-time on the card | BUILT-in-app | MP §3 diary | |
| 68 | Technician assignment on the card | BUILT-in-prototype | PD "Work allocation"; OV P-05, "Assigned to Jack" | |
| 69 | Service type on the card | IN-SPEC (not built) | AC §6 BOOK-04, "portal uses bookable services, snapshots duration" | |
| 70 | Item/bike chip on the card | BUILT-in-app | WS §1, `customer_bikes` is a first-class entity | |
| 71 | Link another job (several jobs per visit) | NOT-MENTIONED | — | |
| 72 | Schedule multiple jobs per customer in one pass | NOT-MENTIONED | — | |
| 73 | Status dropdown on the card | BUILT-in-app | WS §2, five statuses | |
| 74 | Send-to / share icon | NOT-MENTIONED | — | |
| 75 | Messages panel on the job with compose | BUILT-in-prototype | PD "Conversations"; OV P-09 | |
| 76 | Attachments panel, drag-and-drop, 20MB cap | BUILT-in-app | MP DS-9 names attachments as an existing surface needing tests | |
| 77 | QR code to upload from a mobile device | NOT-MENTIONED | — | |
| 78 | Print the job card | BUILT-in-app | MP §3, "Electron print agent"; MP PF-3 | |
| 79 | Print job tag automatically after book-in | NOT-MENTIONED | HT§10 item 6 | |
| 80 | Move job control | BUILT-in-app | MP §3 diary (drag-to-reschedule) | |
| 81 | Internal notes (employees only) | IN-SPEC (not built) | WS §4 W1 item 7; MP WS-3 | |
| 82 | External notes tier | IN-SPEC (not built) | WS §4 W0 item 3, "single `notes` field … with no internal/visible split" | |
| 83 | Customer-visible notes tier | IN-SPEC (not built) | MP WS-3 | |
| 84 | Product search by name, SKU or other | BUILT-in-app | WS §2, "Parts drawn from inventory onto a job — Have" | |
| 85 | All / Service Types filter on product search | NOT-MENTIONED | — | |
| 86 | Line items with SKU and price | BUILT-in-app | WS §2; WS §4 W2 blocker on `sale_document_items` | |
| 87 | Tax and total on the card | BUILT-in-app | MP §3 (till); MP TILL-4 notes VAT is not yet stored data | |
| 88 | Total expressed as time and money | IN-SPEC (not built) | MP CX-0 "Labour lines — a time and a rate"; AC §6 JOB-12–13 | |
| 89 | Job timer start/stop on the card | NOT-MENTIONED | HT§10 item 3 | |
| 90 | Globally floating active-timer widget | NOT-MENTIONED | — | |
| 91 | Checklist alerts that block closing the job | IN-SPEC (not built) | MP INS-1; HT§10 item 5 | |
| 92 | Lock job card on collection | IN-SPEC (not built) | WS §4 W0 item 1, "rejecting edits to a completed job"; MP DS-8 | |
| 93 | Barcode exact-match auto-add | NOT-MENTIONED | — | |
| 94 | Quote updates the service type | NOT-MENTIONED | — | |
| 95 | "Bike is here" default | IN-SPEC (not built) | AC §6 "Missing: workshop custody" — check-in, ready, collection | |
| 96 | Service-writer shown on the card | NOT-MENTIONED | — | |
| 97 | Ctrl+Enter to send | NOT-MENTIONED | — | |
| 98 | SKU groups on the card | NOT-MENTIONED | — | |
| 99 | Update-an-item dialog (manufacturer, model, year, colour, serial, size, type) | IN-SPEC (not built) | WS §4 W3 item 14; MP BIKE-1 | |
| 100 | Select a different item on the job | NOT-MENTIONED | — | |
| 101 | Service History tab on the item | BUILT-in-app | WS §2, "Service history on repeat visits — Partial, per bike only" | |
| 102 | Service history across other stores in a chain | EXPLICITLY-DEFERRED | MP §6, multi-site frozen until after G3; AC §6 ACC-09 | |
| 103 | Customer-level service history (job with no bike) | IN-SPEC (not built) | WS §4 W1 item 8; MP WS-4 | |
| 104 | Job status history — who changed what, when | IN-SPEC (not built) | WS §4 W1 item 6; MP WS-1 | |

## Statuses, SLA and workflow rules

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 105 | Eleven workshop statuses | IN-SPEC (not built) | WS §2 "five statuses"; AC §6 JOB-02/JOB-19, "Separate booking/work/payment/custody states and allowed transitions" | |
| 106 | Every status label renameable | NOT-MENTIONED | — | |
| 107 | Explicit allowed transitions (state machine) | IN-SPEC (not built) | WS §2, "no state machine"; AC §6 JOB-02 | |
| 108 | Waiting-for-parts status | BUILT-in-prototype | PD "Delays"; OV P-10 | |
| 109 | Waiting-for-client status | NOT-MENTIONED | — | |
| 110 | Warranty job status | IN-SPEC (not built) | AC-24, "performs a free warranty repair" | |
| 111 | Cancelled status | IN-SPEC (not built) | WS §4 W1 item 9, "there is no rejected or cancelled status" | |
| 112 | Bike Ready distinct from Collected | BUILT-in-prototype | PD "Completion"; OV P-11 | |
| 113 | SLA counter: waiting for parts > 4 days | NOT-MENTIONED | — | |
| 114 | SLA counter: waiting for client > 1 day | NOT-MENTIONED | — | |
| 115 | SLA counter: work > 2 days | NOT-MENTIONED | — | |
| 116 | SLA counter: complete > 2 days | NOT-MENTIONED | — | |
| 117 | SLA counter: past scheduled date | NOT-MENTIONED | — | |
| 118 | Promised-ready time distinct from drop-off date | IN-SPEC (not built) | AC §6 JOB-14–15 | |
| 119 | Revised completion estimate visible to the customer | BUILT-in-prototype | PD "Delays"; OV P-10 | |
| 120 | Workshop bays as a first-class field | NOT-MENTIONED | HT§10 item 6 | |
| 121 | Job tags | NOT-MENTIONED | HT§10 item 6 | |
| 122 | Reopen a completed job | IN-SPEC (not built) | AC-28; AC §6 JOB-02/JOB-19, "reopen preserves history" | |
| 123 | Stale-edit / concurrent-edit conflict handling | IN-SPEC (not built) | AC-10; AC §6 JOB-23/CAL-10 | |

## Messaging — templates

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 124 | Per-status automated message templates, toggle-able | IN-SPEC (not built) | WS §2, "Automated SMS/email on status change — Absent"; WS §4 W1 item 5; MP WS-2 | |
| 125 | Pickup / Bike Picked Up templates | NOT-MENTIONED | HT§10 lists pick-up/delivery as deferrable | |
| 126 | Booked In template | IN-SPEC (not built) | MP WS-2, "Booking confirmation … send and are logged" | |
| 127 | Booking Reminder (24 h before, configurable) | IN-SPEC (not built) | AC §6 COM-04/07/09, "Separate event notifications, appointment reminders and service marketing" | |
| 128 | Collection Reminder | NOT-MENTIONED | — | |
| 129 | Waiting for Work template | NOT-MENTIONED | — | |
| 130 | Job Started template | NOT-MENTIONED | — | |
| 131 | Warranty Work Started template | NOT-MENTIONED | — | |
| 132 | Waiting for Client template | NOT-MENTIONED | — | |
| 133 | Quote Approval template with an approval link | IN-SPEC (not built) | WS §4 W1 item 4, "approval links"; WS §4 W2 item 12; MP INS-2 | |
| 134 | Multi Quote Approval template | NOT-MENTIONED | HT§10 lists multi-quote options as deferrable | |
| 135 | Waiting for Parts template | IN-SPEC (not built) | MP WS-2, "waiting-for-parts messages send and are logged" | |
| 136 | Waiting for Parts - Delay, automatic after 96 h | NOT-MENTIONED | — | |
| 137 | Job Completed template | IN-SPEC (not built) | MP CX-5, the job-done email sent on completion | |
| 138 | Bike Collected template | NOT-MENTIONED | — | |
| 139 | Delivery template with a book-delivery link | NOT-MENTIONED | HT§10 deferrable | |
| 140 | Delivery Booked template | NOT-MENTIONED | — | |
| 141 | 6-month service reminder | IN-SPEC (not built) | MP WS-6, "Service reminders … sent on a schedule from the bike's job history" | |
| 142 | Post-service follow-up (3 days after) | IN-SPEC (not built) | AC §6 COM-04/07/09 | |
| 143 | 12-month reminder if no service since | IN-SPEC (not built) | MP WS-6 | |
| 144 | Pre-approved message | BUILT-in-prototype | PD "Authorisation", advance permission up to a spending limit; OV P-07 | |
| 145 | Bike-not-collected message and reminder | NOT-MENTIONED | — | |
| 146 | Delivery-not-booked message and reminder | NOT-MENTIONED | — | |
| 147 | Waiver Signed message | NOT-MENTIONED | HT§10 lists waivers as deferrable | |
| 148 | Fitting message set (booked, reminder, completed, 6-month follow-up, waiver) | NOT-MENTIONED | HT§10 lists fittings as deferrable | |
| 149 | Bike Sale and Bike Sale Follow-up messages | NOT-MENTIONED | — | |
| 150 | Configurable timers behind the templates (reminder hours, follow-up days, 6/12 months, 2-then-4 days) | NOT-MENTIONED | — | |
| 151 | Suppression / opt-out rechecked at send time | IN-SPEC (not built) | AC-51; WS §5 rules 6 and 7 | |
| 152 | Message log with delivery state and provider id | BUILT-in-app | MP WS-2, "`customer_messages` carrying direction/status/`provider_sid`/error" | |
| 153 | Ready-for-collection message | IN-SPEC (not built) | MP WS-2 done-condition | |

## Messaging — channels

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 154 | Email as a notification channel | IN-SPEC (not built) | WS §2, "Email does not exist anywhere in the codebase"; MP PL-14 | |
| 155 | SMS as a notification channel | BUILT-in-app | WS §2, "SMS is manual, one call site, no templates"; MP WS-2, Twilio sender in `server/sms.js` | |
| 156 | Resold SMS credit bundles | EXPLICITLY-DEFERRED | CT §6.3, "Rejected alternative: reselling messaging credits" | |
| 157 | Bring-your-own Twilio | IN-SPEC (not built) | CT §6.3, "bring your own, not resold by us"; AC-50 | |
| 158 | Bring-your-own Ikeono | NOT-MENTIONED | — | |
| 159 | Bring-your-own Podium | NOT-MENTIONED | — | |
| 160 | WhatsApp channel | BUILT-in-prototype (simulated) | PD "Notifications", simulate email, SMS, WhatsApp; OV P-08 | |
| 161 | Unified inbox across channels | NOT-MENTIONED | — | |
| 162 | Customer choice of updates and channels | BUILT-in-prototype | PD "Notifications"; OV P-08 | |
| 163 | Message bundles page | EXPLICITLY-DEFERRED | CT §6.3 (no resale, therefore no bundles) | |
| 164 | Storage of shop-supplied provider credentials | IN-SPEC (not built) | CT §6.3 consequence 1, "We will store customer API credentials" | |
| 165 | Provider-balance / revoked-credential error surface | IN-SPEC (not built) | AC-50 | |

## Quotes and approval

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 166 | Send quote to the customer | BUILT-in-prototype | PD "Inspection", propose additional work with estimated costs; OV P-06 | |
| 167 | Customer approves or declines individual lines | BUILT-in-prototype | PD "Authorisation"; OV P-06; also IN-SPEC as MP INS-2 | |
| 168 | Pre-approved spending amount that skips the ask | BUILT-in-prototype | PD "Authorisation"; OV P-07, £65 under a £100 limit | |
| 169 | Approval bound to an immutable estimate version | IN-SPEC (not built) | AC-26; PD constraint 5; AC §6 INS-04–05 | |
| 170 | Multi-quote options | NOT-MENTIONED | HT§10 deferrable | |
| 171 | "Send to third party only" for approval | NOT-MENTIONED | — | |
| 172 | Send quote to the POS | IN-SPEC (not built) | AC-36; AC §6 "Missing: external account connection" | |
| 173 | Approved lines flow into the job's order with no re-entry | IN-SPEC (not built) | WS §4 W2 item 13; MP INS-3 | |
| 174 | Declined lines excluded from the total | BUILT-in-prototype | OV P-06, "declined excluded from the total" | |
| 175 | Re-proposal keeps settled lines | BUILT-in-prototype | OV P-06, "a new proposal keeps settled lines and replaces only the undecided one" | |

## Customers and items

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 176 | Customer records | BUILT-in-app | MP §3, "till, inventory, sales history … customer booking portal" | |
| 177 | Customer search by last name, email or phone | BUILT-in-app | MP §3; WS §4 W0 item 3 describes phone matching in guest booking | |
| 178 | No browsable customer list | IN-SPEC (not built) | MP WS-8 implies a staff-side customer list (merge queue) | |
| 179 | Customer CSV import | IN-SPEC (not built) | HT§10 item 9 for parity; AC-44, AC-45 for the required semantics | |
| 180 | Referral code on the customer | NOT-MENTIONED | — | |
| 181 | Customer detail view | BUILT-in-app | MP §3 (customer records and sales history) | |
| 182 | Duplicate-customer detection and merge | IN-SPEC (not built) | MP WS-8; AC §6 CUS-05/CUS-08 | |
| 183 | Phone-number match creating identity | EXPLICITLY-DEFERRED | WS §4 W0 item 3 and MP DS-7 remove it; AC-44, "Phone or name similarity never automatically grants identity" | |
| 184 | Bike/item as a first-class record | BUILT-in-app | WS §1, "We already have `customer_bikes` as a first-class entity" | |
| 185 | Item fields: manufacturer, model, year, colour, size, type | IN-SPEC (not built) | WS §4 W3 item 14; MP BIKE-1 | |
| 186 | Serial number on the item | BUILT-in-app | WS §4 W3 item 14, "Index `serial_number`; it currently has no index" | |
| 187 | Transfer a bike between customers | NOT-MENTIONED | — | |
| 188 | Duplicate-serial detection | IN-SPEC (not built) | AC §6 BIKE-07, "Duplicate serial detection is not proof of identity or ownership" | |
| 189 | Project 529 Garage stolen-bike check | NOT-MENTIONED | WS §5 rule 11 and MP §10.5 discuss registries (Bike Index) but not 529 | |
| 190 | Bike spec autofill from a data source | IN-SPEC (not built) | WS §3; MP BIKE-2, blocked on 99spokes terms | |

## Checklists and service questions

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 191 | Reusable checklist templates per shop | IN-SPEC (not built) | WS §4 W2 item 10; MP INS-1 | |
| 192 | Checklist item control types (checkbox, value box) | NOT-MENTIONED | — | |
| 193 | Pre-service checklist shown at book-in | NOT-MENTIONED | HT§10 item 5 | |
| 194 | All-services checklist flag | NOT-MENTIONED | — | |
| 195 | Front-and-rear checklist flag | NOT-MENTIONED | — | |
| 196 | Checklist item label colour | NOT-MENTIONED | — | |
| 197 | Checklist attached per service type | NOT-MENTIONED | — | |
| 198 | Photos per inspection item | IN-SPEC (not built) | WS §4 W2 item 11; MP CX-2 | |
| 199 | Custom service questions (text, textarea, checkbox), drag-and-drop | NOT-MENTIONED | — | |

## Service types

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 200 | Bookable service catalogue with name and category | IN-SPEC (not built) | AC §6 BOOK-04, "portal uses bookable services" | |
| 201 | Service cost | BUILT-in-app | AC-23 fixture, "A service has a saved price"; MP §3 (till and inventory) | |
| 202 | Service duration | IN-SPEC (not built) | AC-07, "UI and server agree on the selected service's duration"; AC-23 snapshot rule | |
| 203 | Linked SKUs auto-added to the quote | NOT-MENTIONED | — | |
| 204 | Allow widget / app booking per service type | BUILT-in-prototype | OV P-03, per-service acceptance rules | |
| 205 | Per-channel service description | NOT-MENTIONED | — | |
| 206 | Per-service-type technician list | NOT-MENTIONED | — | |
| 207 | Per-service-type message template | NOT-MENTIONED | — | |
| 208 | Price and duration snapshotted at booking | IN-SPEC (not built) | AC-23 | |

## Staff, hours and leave

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 209 | Staff user accounts | BUILT-in-app | MP TILL-5, "`is_owner` gates the eight team routes only" | |
| 210 | Role model beyond owner/staff | IN-SPEC (not built) | MP TILL-5; AC §6 ACC-04/ACC-08, "Define command-level rights and actor attribution" | |
| 211 | Per-technician working-hours grid | IN-SPEC (not built) | AC-19; AC §6 CAL-07–13 | |
| 212 | Staff leave | IN-SPEC (not built) | AC-19, "A mechanic is ill" | |
| 213 | Shop closing dates / bank holidays | IN-SPEC (not built) | AC-19, "a bank holiday is added" | |
| 214 | Recurring blocks (lunch) | IN-SPEC (not built) | AC-19, "lunch becomes a recurring block" | |
| 215 | Technician count capped by subscription tier | NOT-MENTIONED | CT §6.3, software is completely free | |
| 216 | Two-factor authentication (Google Authenticator) | IN-SPEC (not built) | AC §6 ACC-06, "select supported factors and recovery policy explicitly" | |
| 217 | Staff deactivation with live-session revocation | IN-SPEC (not built) | AC-55 | |
| 218 | Mechanic cannot operate the till but can edit work | IN-SPEC (not built) | AC-25 | |

## Shop settings

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 219 | Shop profile | BUILT-in-app | MP PF-1, "A new shop signs up and reaches an empty till" | |
| 220 | Enable / disable online bookings | IN-SPEC (not built) | AC-04, "public booking stays unavailable with a useful message until prerequisites exist" | |
| 221 | Tax-inclusive toggle and rate | IN-SPEC (not built) | MP TILL-4, "VAT as stored data"; AC-29 | |
| 222 | Allow discounts | BUILT-in-app | AC-30 references discounted parts on an invoice; MP §3 (till) | |
| 223 | Store type | NOT-MENTIONED | — | |
| 224 | GDPR marketing-consent prompt and text | IN-SPEC (not built) | WS §5 rules 6 and 7; MP §9 | |
| 225 | Free-text merge tag | NOT-MENTIONED | — | |
| 226 | Trustpilot / Google Reviews URLs | NOT-MENTIONED | — | |
| 227 | Insight report emails (daily productivity and finance) | NOT-MENTIONED | — | |
| 228 | Workshop notification settings | BUILT-in-prototype | PD "Notifications", sensible defaults; PD "Remaining prototype details" | |
| 229 | Workshop-only mode (job without a till sale) | BUILT-in-app (partial) | MP PF-2, "the mechanism works — `skipAutoOrder` … Missing is the *mode*" | |
| 230 | Subscription management page | EXPLICITLY-DEFERRED | MP BIL-1, "Not before G3"; CT §6.3, software completely free | |
| 231 | Published tiered pricing (Lite / Professional / Premium) | EXPLICITLY-DEFERRED | CT §6.3; PD "Purpose and commercial position", pricing undecided | |

## Payments, deposits and coupons

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 232 | Online customer payment (Stripe connect) | IN-SPEC (not built) | MP CX-4, "Pay in one tap"; MP §10.4, payments architecture open and blocking | |
| 233 | Take a deposit during online booking | EXPLICITLY-DEFERRED | WS §4 "Deliberately deferred": "Deposits at booking" | |
| 234 | Coupons (code, redeem method, type, value, expiry, redemptions) | NOT-MENTIONED | HT§10 deferrable | |
| 235 | Gift cards | EXPLICITLY-DEFERRED | AC-46, gift balances must be explicitly handled or cutover blocked; MP §6 does not include them | |
| 236 | Invoicing from the job | IN-SPEC (not built) | MP CX-3; AC-29, AC-30 | |
| 237 | Refunds, voids and returns | IN-SPEC (not built) | MP TILL-1; CT §6.3, "the till has no refunds, voids or returns" | |
| 238 | Payment recorded at the counter vs an open payment link | IN-SPEC (not built) | AC-31 | |
| 239 | Billing stub separated from real settlement | BUILT-in-prototype | PD "Billing"; OV P-11, "billing stub is present and disabled" | |

## Third parties (insurer / employer payers)

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 240 | Third-party partner responsible for payment on a job | NOT-MENTIONED | HT§10 lists third-party payers as deferrable | |
| 241 | "Send to third party only" for quote approval | NOT-MENTIONED | — | |

## Pick-up and delivery

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 242 | Pick-ups and deliveries scheduling module | NOT-MENTIONED | HT§10 lists pick-up and delivery scheduling as deferrable | |
| 243 | Pick-ups nav section and setup flow | NOT-MENTIONED | — | |
| 244 | Customer books a delivery from a link | NOT-MENTIONED | — | |
| 245 | Collections options | IN-SPEC (not built) | AC §6 "Missing: workshop custody" — "collection and authorized collector" | |
| 246 | Vehicle utilisation reporting | NOT-MENTIONED | — | |
| 247 | Authorised-collector verification | IN-SPEC (not built) | AC-34, "Payment does not prove collection authority" | |
| 248 | Custody tracked separately from work and payment | BUILT-in-prototype | PD "Completion"; PD constraint 6; OV P-11 | |

## Bike fittings

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 249 | Bike fitting as a distinct service line | NOT-MENTIONED | HT§10 lists fittings as deferrable | |
| 250 | Fitting statuses (Appointment scheduled, Fitting completed) | NOT-MENTIONED | — | |
| 251 | Bike Fittings setup page | NOT-MENTIONED | — | |
| 252 | Fitting waivers | NOT-MENTIONED | — | |

## Bike sale

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 253 | Bike Sale product module | BUILT-in-app | MP §3, "till, inventory, sales history" (a bike is stock like any product) | |
| 254 | Bike-sale follow-up nudging a service | IN-SPEC (not built) | MP WS-6, service reminders from job history | |

## Waivers

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 255 | Pre-service waiver signed on the widget before scheduling | NOT-MENTIONED | HT§10 lists waivers as deferrable | |
| 256 | Post-service waiver with optional technician and manager signature | NOT-MENTIONED | — | |

## Reports

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 257 | A named report catalogue with date ranges | NOT-MENTIONED | AC §6 DONE-04/REP-05 addresses one VAT report only | |
| 258 | Bookings reports (daily snapshot, booked-in detail, by platform, by day-hour) | NOT-MENTIONED | — | |
| 259 | "How did they hear about us" report | NOT-MENTIONED | — | |
| 260 | Customer and retention reports | NOT-MENTIONED | — | |
| 261 | Export reports (customers, products, services, work orders) | IN-SPEC (not built) | MP TILL-3; AC-62, staff-assisted export | |
| 262 | Financial reports (future work, invoices paid) | NOT-MENTIONED | — | |
| 263 | Gift-card reports | NOT-MENTIONED | — | |
| 264 | Group / multi-store capacity reports | EXPLICITLY-DEFERRED | MP §6, multi-site frozen until after G3 | |
| 265 | Inventory-on-incomplete-jobs report | NOT-MENTIONED | — | |
| 266 | Item manufacturer split report | NOT-MENTIONED | — | |
| 267 | Referral report | NOT-MENTIONED | — | |
| 268 | Item sales report | BUILT-in-app | MP §3, "sales history, dashboard" | |
| 269 | Rescheduled-bookings report | NOT-MENTIONED | — | |
| 270 | Time-in-status summary and detail | NOT-MENTIONED | HT§10 item 8 | |
| 271 | Workshop financials (revenue and labour per technician, AOV, turnover, parts, job-card breakdown) | EXPLICITLY-DEFERRED | WS §4 "Deliberately deferred": "technician efficiency and commission reporting"; WS §2 names it as unclaimed | |
| 272 | Workshop performance (ratings, turnaround, availability, services performed) | EXPLICITLY-DEFERRED | WS §4 "Deliberately deferred" | |
| 273 | VAT / tax reporting | IN-SPEC (not built) | MP TILL-4; AC §6 DONE-04/REP-05 | |
| 274 | Jobs-per-shop-per-week usage dashboard | IN-SPEC (not built) | MP DP-5 | |

## Imports and migration

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 275 | Excel job-import template | IN-SPEC (not built) | HT§10 item 9; AC §6 "Missing: migration readiness" | |
| 276 | Customer CSV import | IN-SPEC (not built) | AC-44, AC-45 | |
| 277 | Historical sales / refunds / notification history import | IN-SPEC (not built) | AC-45, "No current stock deduction, new tax calculation, message send" | |
| 278 | Import row quarantine on malformed data | IN-SPEC (not built) | AC-43 | |
| 279 | Resumable, checkpointed import | IN-SPEC (not built) | AC-39; AC §6 "Missing: sync integrity" | |
| 280 | Cutover authority and rollback limit | IN-SPEC (not built) | AC-48; AC §6 "Missing: migration readiness" | |
| 281 | Live till integration and migration | EXPLICITLY-DEFERRED (prototype) | PD "Deferred beyond the prototype" | |

## POS integration

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 282 | Connect to an external till | IN-SPEC (not built) | MP §1 (Lightspeed first, coexistence); AC §6 "Missing: external account connection" | |
| 283 | Lightspeed R-Series work-order sync | IN-SPEC (not built) | MP §1 point 3, "R-Series is the integration target"; CT §6.4 open item 2 | |
| 284 | Lightspeed X-Series support | IN-SPEC (not built) | AC-03; CT §6.4 open item 2 | |
| 285 | Inventory adjusted on part add/remove, returned on cancel | IN-SPEC (not built) | AC-36, "Specify reservation, invoice, payment and stock ownership at each step" | |
| 286 | Special orders originating in the workshop system | IN-SPEC (not built) | AC §6 PUR-06/JOB-11, "define one job-to-purchase relationship and its receiving/replanning lifecycle" | |
| 287 | Technician mapped to a POS employee | NOT-MENTIONED | — | |
| 288 | POS product / inventory sync page | IN-SPEC (not built) | AC-42, "Work orders sync but inventory fails for an hour" | |
| 289 | Vend / Shopify / Xero / Teamwork connectors | BUILT-in-app (Shopify only) | MP §3, "Shopify integration" | |
| 290 | Citrus-Lime connector | EXPLICITLY-DEFERRED | MP §1, "Build for Lightspeed, not Citrus-Lime"; CT §6.2 | |
| 291 | Disconnect and credential revocation | IN-SPEC (not built) | AC-47; AC §6 "Missing: external account connection" | |
| 292 | Visible sync freshness / degraded operation | IN-SPEC (not built) | AC-42; AC §6 "Missing: visible degraded operation" | |
| 293 | Purchase orders with split deliveries | BUILT-in-app | MP §3, "purchase orders with split deliveries" | |

## Printing

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 294 | Receipt / job-card printing | BUILT-in-app | MP §3, "Electron print agent" | |
| 295 | Receipt Designer (template editor) | NOT-MENTIONED | HT§10 lists the receipt template designer as deferrable | |
| 296 | Print options: logo, checklist, line barcode, QR | NOT-MENTIONED | — | |
| 297 | Work-order barcode that opens the job | NOT-MENTIONED | — | |
| 298 | Print automatically after book-in | NOT-MENTIONED | — | |
| 299 | Signed one-page print-agent installer | IN-SPEC (not built) | MP PF-3, "Partial … it is explicitly unsigned"; AC §6 FD-05/HW-04 | |

## Community and referral

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 300 | In-product community feed | IN-SPEC (not built) | MP FOR-1, community forum private to design partners; AC §6 FD-05 | |
| 301 | Shop Rides widget | NOT-MENTIONED | HT§10 lists community posts and rides as deferrable | |
| 302 | Refer & Earn / referral earnings | NOT-MENTIONED | HT§10 lists referral earnings as deferrable | |
| 303 | In-app changelog | IN-SPEC (not built) | MP WEB-1, the public website includes a changelog; MP §7, Jack owns the changelog | |
| 304 | In-app help centre | IN-SPEC (not built) | MP WEB-1, "help" | |
| 305 | Service ratings by the customer | NOT-MENTIONED | — | |
| 306 | Technician leaderboard | EXPLICITLY-DEFERRED | WS §4 "Deliberately deferred": technician efficiency reporting | |

## Mobile and devices

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 307 | Browser-based shop side, no native staff app | IN-SPEC (not built) | WS §2, "Mobile/tablet access — Partial: browser only, not designed for the shop floor" | |
| 308 | Fully responsive shop and customer surfaces | BUILT-in-prototype | PD "Devices"; OV P-13, layout checks at 320/390/768/1440px | |
| 309 | Mechanic inspection on a phone | BUILT-in-prototype | PD "Inspection"; OV P-06 | |
| 310 | Phone camera capture of media | BUILT-in-prototype (device capture unproven) | OV change 2 and OV "Not proven", "Physical-phone camera capture" | |
| 311 | QR route to upload from a phone | NOT-MENTIONED | — | |
| 312 | Consumer-facing rider app | EXPLICITLY-DEFERRED | MP §6, "the rider-owned shareable bike record" frozen until after G3 | |
| 313 | Workshop display screens | EXPLICITLY-DEFERRED | WS §4 "Deliberately deferred": "workshop display screens" | |

## Platform

| # | Hubtiger feature | Our status | Where our documents say so | Jack's priority |
|---|---|---|---|---|
| 314 | Multi-tenant hosted service | BUILT-in-app | MP §3, "Postgres multi-tenancy with 25 tables RLS-enabled and FORCEd" | |
| 315 | Chain / multi-store data model | EXPLICITLY-DEFERRED | MP §6, multi-site frozen until after G3; AC §6 ACC-09 | |
| 316 | Public status page and error tracking | IN-SPEC (not built) | MP PL-13 | |
| 317 | Point-in-time recovery and a tested restore | IN-SPEC (not built) | MP PL-2, PL-3; AC-60 | |

## Ours, not theirs

Capabilities in our specification or prototype with no counterpart in the Hubtiger inventory.

- **Free workshop software with the till as the paid product.** MP §1; CT §6.1. Hubtiger is a paid bolt-on at £45–£85/month.
- **The job-done email** — plain-English summary, photos, itemised parts-and-labour invoice, pay in one tap, sent on completion. MP P5, CX-1 to CX-5.
- **Grounded summary generation with a safe fallback** — no inferred repair outcomes. AC-35; AC §6 DONE-01.
- **A bike entity with a real schema and a service timeline independent of which shop did the work.** WS §2 "Genuinely unclaimed", item 2; MP BIKE-1.
- **Shop-verified service facts** (hanger, bottom-bracket standard, rotor mount, chain speed, tyre and valve) captured once and inherited by every later visit. WS §3 and §4 W3 item 16; MP BIKE-3.
- **Wear-parts mapping accumulated from our own job history.** WS §4 W3 item 17.
- **Recall and safety-notice tracking by model and serial.** WS §2 item 4 and §4 W3 item 18; MP BIKE-4.
- **Structured inspection to itemised estimate with per-line approval**, automotive-pattern. WS §2 "Genuinely unclaimed" item 1; MP INS-1 to INS-3. Hubtiger's equivalent is a quote-approval link.
- **Mechanic video inspection explaining findings.** PD "Inspection"; OV P-06.
- **Cumulative spending limit that authorises up to the cap and holds the balance for explicit approval.** OV P-07. Hubtiger has a pre-approved amount but no observed cumulative split.
- **Shared work queue as an alternative to per-technician assignment.** PD "Work allocation"; OV P-05.
- **Drop-off day that is explicitly not a promised start time**, enforced in the UI. PD "Booking"; OV P-04.
- **Shop review before confirmation, with pending visibly distinct from confirmed.** PD "Acceptance"; OV P-03. Not seen in Hubtiger's tested configuration.
- **Append-only attributed entries with a rider dispute flag and right of reply, never silent deletion.** WS §5 rules 1 and 2; MP CX-7.
- **Rider-initiated, time-limited, revocable record sharing.** WS §5 rules 4 and 5.
- **Server-side EXIF GPS stripping on every upload.** WS §5 rule 9; MP CX-2.
- **Postgres forced row-level security as the tenant boundary, with composite tenant foreign keys.** MP §2 item 1, §4 item 4, DS-4.
- **Labour as a first-class line with a time and a rate, not a faked product row.** MP CX-0; WS §4 W2 "Known blocker".
- **Duplicate-customer merge queue reviewed by staff.** MP WS-8.
- **Sign-in nudge on guest booking that never reveals whether an account exists.** MP WS-7.
- **Bring-your-own provider credentials only, with no resold messaging credits.** CT §6.3. Hubtiger does both.
- **Jack-controlled scenario simulator with pause, fast-forward and reset for live demos.** PD "Jack-controlled simulator"; OV P-01, P-12.
- **Design-partner forum with email-in and email-reply and single sign-on.** MP FOR-1.
- **A watched, unaided simplicity gate as a shipping condition.** MP §2 item 4; AC-05.
