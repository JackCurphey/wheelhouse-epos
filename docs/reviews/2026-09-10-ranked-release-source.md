# Ranking source snapshot

Source: https://github.com/JackCurphey/wheelhouse-epos/issues/47#issuecomment-5621074448

Author: JackCurphey. Created: 2026-09-10T15:21:37Z. Updated: 2026-09-10T15:21:37Z. Retrieved 10 September 2026 through the GitHub API. Text below is the exact comment body; ranks/buckets/statuses are historical source data, not corrections made by this plan.

---

## Stack rank — 317 rows, all bucketed

Release 1: **172** · Later: **102** · Not for us: **43** · Unsorted: **0**

Bucketing is Jack's. **The order within Release 1 is Claude's proposal, not Jack's judgement** — Jack asked for a build order on the grounds that everything in Release 1 ships before release anyway, so the sequence is about dependencies rather than value. It is open to challenge. Basis: each wave needs the one above it to exist.

### Release 1 (stack rank)

**Foundations — tenancy, records, service catalogue, the job itself**

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| R1-001 | 314 | Multi-tenant hosted service | BUILT-in-app | Platform |
| R1-002 | 219 | Shop profile | BUILT-in-app | Shop settings |
| R1-003 | 209 | Staff user accounts | BUILT-in-app | Staff, hours and leave |
| R1-004 | 210 | Role model beyond owner/staff | IN-SPEC (not built) | Staff, hours and leave |
| R1-005 | 217 | Staff deactivation with live-session revocation | IN-SPEC (not built) | Staff, hours and leave |
| R1-006 | 176 | Customer records | BUILT-in-app | Customers and items |
| R1-007 | 177 | Customer search by last name, email or phone | BUILT-in-app | Customers and items |
| R1-008 | 181 | Customer detail view | BUILT-in-app | Customers and items |
| R1-009 | 184 | Bike/item as a first-class record | BUILT-in-app | Customers and items |
| R1-010 | 200 | Bookable service catalogue with name and category | IN-SPEC (not built) | Service types |
| R1-011 | 201 | Service cost | BUILT-in-app | Service types |
| R1-012 | 202 | Service duration | IN-SPEC (not built) | Service types |
| R1-013 | 105 | Eleven workshop statuses | IN-SPEC (not built) | Statuses, SLA and workflow rules |
| R1-014 | 63 | Digital work order / job card | BUILT-in-app | Job card |
| R1-015 | 65 | Human-readable job number | IN-SPEC (not built) | Job card |
| R1-016 | 66 | Minimum job-card number setting | NOT-MENTIONED | Job card |

**Availability engine — hours, leave, closures, capacity**

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| R1-017 | 211 | Per-technician working-hours grid | IN-SPEC (not built) | Staff, hours and leave |
| R1-018 | 213 | Shop closing dates / bank holidays | IN-SPEC (not built) | Staff, hours and leave |
| R1-019 | 212 | Staff leave | IN-SPEC (not built) | Staff, hours and leave |
| R1-020 | 214 | Recurring blocks (lunch) | IN-SPEC (not built) | Staff, hours and leave |
| R1-021 | 41 | Opening-hours clamping server-side | IN-SPEC (not built) | Calendar / diary |
| R1-022 | 42 | Working-day / closed-day blocking server-side | IN-SPEC (not built) | Calendar / diary |
| R1-023 | 36 | Per-day hours-available strip per technician | IN-SPEC (not built) | Calendar / diary |
| R1-024 | 48 | Capacity gate on customer booking | BUILT-in-app | Calendar / diary |
| R1-025 | 25 | Arrival lead time before opening | IN-SPEC (not built) | Booking widget / customer front door |
| R1-026 | 4 | Booking lead-time in days setting | NOT-MENTIONED | Booking widget / customer front door |

**Calendar / diary — needs resources and hours to exist**

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| R1-027 | 27 | Workshop diary with per-mechanic columns | BUILT-in-app | Calendar / diary |
| R1-028 | 32 | Technicians as calendar resource rows | BUILT-in-app | Calendar / diary |
| R1-029 | 28 | Day view | BUILT-in-app | Calendar / diary |
| R1-030 | 43 | 5 / 15 / 30-minute calendar grid | NOT-MENTIONED | Calendar / diary |
| R1-031 | 39 | Drag-to-reschedule | BUILT-in-app | Calendar / diary |
| R1-032 | 33 | Sort calendar resources | NOT-MENTIONED | Calendar / diary |
| R1-033 | 35 | Per-technician Configure control | NOT-MENTIONED | Calendar / diary |
| R1-034 | 29 | Week view | NOT-MENTIONED | Calendar / diary |
| R1-035 | 31 | Month view | NOT-MENTIONED | Calendar / diary |
| R1-036 | 37 | Colour-coded status legend on the calendar | NOT-MENTIONED | Calendar / diary |
| R1-037 | 38 | Renameable status labels on the calendar | NOT-MENTIONED | Calendar / diary |
| R1-038 | 46 | Show original booking date on the calendar | NOT-MENTIONED | Calendar / diary |
| R1-039 | 47 | Bike type shown on the calendar card | NOT-MENTIONED | Calendar / diary |
| R1-040 | 49 | Drop-off day reserves capacity without promising a start time | BUILT-in-prototype | Calendar / diary |
| R1-041 | 50 | Reschedule refused when capacity is gone | BUILT-in-prototype | Calendar / diary |

**Job card core — needs the job, statuses and the catalogue**

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| R1-042 | 64 | Job card opens as a modal over the list | BUILT-in-prototype | Job card |
| R1-043 | 67 | Scheduled date-time on the card | BUILT-in-app | Job card |
| R1-044 | 68 | Technician assignment on the card | BUILT-in-prototype | Job card |
| R1-045 | 70 | Item/bike chip on the card | BUILT-in-app | Job card |
| R1-046 | 76 | Attachments panel, drag-and-drop, 20MB cap | BUILT-in-app | Job card |
| R1-047 | 73 | Status dropdown on the card | BUILT-in-app | Job card |
| R1-048 | 84 | Product search by name, SKU or other | BUILT-in-app | Job card |
| R1-049 | 85 | All / Service Types filter on product search | NOT-MENTIONED | Job card |
| R1-050 | 86 | Line items with SKU and price | BUILT-in-app | Job card |
| R1-051 | 87 | Tax and total on the card | BUILT-in-app | Job card |
| R1-052 | 93 | Barcode exact-match auto-add | NOT-MENTIONED | Job card |
| R1-053 | 98 | SKU groups on the card | NOT-MENTIONED | Job card |
| R1-054 | 80 | Move job control | BUILT-in-app | Job card |
| R1-055 | 99 | Update-an-item dialog (manufacturer, model, year, colour, serial, size, type) | IN-SPEC (not built) | Job card |
| R1-056 | 100 | Select a different item on the job | NOT-MENTIONED | Job card |
| R1-057 | 96 | Service-writer shown on the card | NOT-MENTIONED | Job card |
| R1-058 | 103 | Customer-level service history (job with no bike) | IN-SPEC (not built) | Job card |
| R1-059 | 104 | Job status history — who changed what, when | IN-SPEC (not built) | Job card |
| R1-060 | 92 | Lock job card on collection | IN-SPEC (not built) | Job card |
| R1-061 | 122 | Reopen a completed job | IN-SPEC (not built) | Statuses, SLA and workflow rules |
| R1-062 | 123 | Stale-edit / concurrent-edit conflict handling | IN-SPEC (not built) | Statuses, SLA and workflow rules |
| R1-063 | 97 | Ctrl+Enter to send | NOT-MENTIONED | Job card |

**Status workflow and SLA counters — needs the status set and the card**

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| R1-064 | 106 | Every status label renameable | NOT-MENTIONED | Statuses, SLA and workflow rules |
| R1-065 | 108 | Waiting-for-parts status | BUILT-in-prototype | Statuses, SLA and workflow rules |
| R1-066 | 109 | Waiting-for-client status | NOT-MENTIONED | Statuses, SLA and workflow rules |
| R1-067 | 110 | Warranty job status | IN-SPEC (not built) | Statuses, SLA and workflow rules |
| R1-068 | 111 | Cancelled status | IN-SPEC (not built) | Statuses, SLA and workflow rules |
| R1-069 | 112 | Bike Ready distinct from Collected | BUILT-in-prototype | Statuses, SLA and workflow rules |
| R1-070 | 118 | Promised-ready time distinct from drop-off date | IN-SPEC (not built) | Statuses, SLA and workflow rules |
| R1-071 | 121 | Job tags | NOT-MENTIONED | Statuses, SLA and workflow rules |
| R1-072 | 117 | SLA counter: past scheduled date | NOT-MENTIONED | Statuses, SLA and workflow rules |
| R1-073 | 113 | SLA counter: waiting for parts > 4 days | NOT-MENTIONED | Statuses, SLA and workflow rules |
| R1-074 | 114 | SLA counter: waiting for client > 1 day | NOT-MENTIONED | Statuses, SLA and workflow rules |
| R1-075 | 115 | SLA counter: work > 2 days | NOT-MENTIONED | Statuses, SLA and workflow rules |
| R1-076 | 116 | SLA counter: complete > 2 days | NOT-MENTIONED | Statuses, SLA and workflow rules |

**Messaging — channels first, then the templates that ride them**

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| R1-077 | 154 | Email as a notification channel | IN-SPEC (not built) | Messaging — channels |
| R1-078 | 155 | SMS as a notification channel | BUILT-in-app | Messaging — channels |
| R1-079 | 164 | Storage of shop-supplied provider credentials | IN-SPEC (not built) | Messaging — channels |
| R1-080 | 157 | Bring-your-own Twilio | IN-SPEC (not built) | Messaging — channels |
| R1-081 | 152 | Message log with delivery state and provider id | BUILT-in-app | Messaging — templates |
| R1-082 | 75 | Messages panel on the job with compose | BUILT-in-prototype | Job card |
| R1-083 | 162 | Customer choice of updates and channels | BUILT-in-prototype | Messaging — channels |
| R1-084 | 160 | WhatsApp channel | BUILT-in-prototype (simulated) | Messaging — channels |
| R1-085 | 161 | Unified inbox across channels | NOT-MENTIONED | Messaging — channels |
| R1-086 | 124 | Per-status automated message templates, toggle-able | IN-SPEC (not built) | Messaging — templates |
| R1-087 | 126 | Booked In template | IN-SPEC (not built) | Messaging — templates |
| R1-088 | 127 | Booking Reminder (24 h before, configurable) | IN-SPEC (not built) | Messaging — templates |
| R1-089 | 153 | Ready-for-collection message | IN-SPEC (not built) | Messaging — templates |
| R1-090 | 125 | Pickup / Bike Picked Up templates | NOT-MENTIONED | Messaging — templates |
| R1-091 | 128 | Collection Reminder | NOT-MENTIONED | Messaging — templates |
| R1-092 | 137 | Job Completed template | IN-SPEC (not built) | Messaging — templates |
| R1-093 | 139 | Delivery template with a book-delivery link | NOT-MENTIONED | Messaging — templates |

**Quotes and approval — needs line items and a message channel**

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| R1-094 | 166 | Send quote to the customer | BUILT-in-prototype | Quotes and approval |
| R1-095 | 167 | Customer approves or declines individual lines | BUILT-in-prototype | Quotes and approval |
| R1-096 | 174 | Declined lines excluded from the total | BUILT-in-prototype | Quotes and approval |
| R1-097 | 175 | Re-proposal keeps settled lines | BUILT-in-prototype | Quotes and approval |
| R1-098 | 168 | Pre-approved spending amount that skips the ask | BUILT-in-prototype | Quotes and approval |
| R1-099 | 94 | Quote updates the service type | NOT-MENTIONED | Job card |
| R1-100 | 133 | Quote Approval template with an approval link | IN-SPEC (not built) | Messaging — templates |

**Service config and checklists — the widget surfaces these**

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| R1-101 | 203 | Linked SKUs auto-added to the quote | NOT-MENTIONED | Service types |
| R1-102 | 204 | Allow widget / app booking per service type | BUILT-in-prototype | Service types |
| R1-103 | 191 | Reusable checklist templates per shop | IN-SPEC (not built) | Checklists and service questions |
| R1-104 | 192 | Checklist item control types (checkbox, value box) | NOT-MENTIONED | Checklists and service questions |
| R1-105 | 193 | Pre-service checklist shown at book-in | NOT-MENTIONED | Checklists and service questions |
| R1-106 | 195 | Front-and-rear checklist flag | NOT-MENTIONED | Checklists and service questions |
| R1-107 | 196 | Checklist item label colour | NOT-MENTIONED | Checklists and service questions |
| R1-108 | 199 | Custom service questions (text, textarea, checkbox), drag-and-drop | NOT-MENTIONED | Checklists and service questions |

**Booking widget / customer front door — the last thing to open up**

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| R1-109 | 220 | Enable / disable online bookings | IN-SPEC (not built) | Shop settings |
| R1-110 | 1 | Online customer self-booking into a shop calendar | BUILT-in-app | Booking widget / customer front door |
| R1-111 | 3 | Guest booking with no account | BUILT-in-prototype | Booking widget / customer front door |
| R1-112 | 2 | Embeddable website widget (iframe or URL) | NOT-MENTIONED | Booking widget / customer front door |
| R1-113 | 6 | Pre-selected service type or service group on the widget | NOT-MENTIONED | Booking widget / customer front door |
| R1-114 | 8 | Show prices on the widget | IN-SPEC (not built) | Booking widget / customer front door |
| R1-115 | 21 | Service-specific acceptance rules | BUILT-in-prototype | Booking widget / customer front door |
| R1-116 | 20 | Instant confirmation vs shop review before confirmation | BUILT-in-prototype | Booking widget / customer front door |
| R1-117 | 22 | Pending-request expiry / review deadline | IN-SPEC (not built) | Booking widget / customer front door |
| R1-118 | 24 | Shop reject with a reason | IN-SPEC (not built) | Booking widget / customer front door |
| R1-119 | 23 | Customer cancel and reschedule | IN-SPEC (not built) | Booking widget / customer front door |
| R1-120 | 17 | Free-text problem description in the customer's own words | BUILT-in-prototype | Booking widget / customer front door |
| R1-121 | 18 | Customer photo/video attachment at request time | BUILT-in-prototype | Booking widget / customer front door |
| R1-122 | 19 | Customer return-access link (progress link) | BUILT-in-prototype | Booking widget / customer front door |
| R1-123 | 16 | Custom service questions asked on the widget | NOT-MENTIONED | Booking widget / customer front door |
| R1-124 | 7 | Additional-info and payment-info free text on the widget | NOT-MENTIONED | Booking widget / customer front door |
| R1-125 | 14 | Widget theme colours and 22 fonts | NOT-MENTIONED | Booking widget / customer front door |
| R1-126 | 11 | Show pre-approved amount on the widget | IN-SPEC (not built) | Booking widget / customer front door |

**Job list views — reads everything above**

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| R1-127 | 52 | KPI tiles (Open Jobs, Bike Ready, Cancelled, Bike Is Here, I Need Help) | NOT-MENTIONED | Job list (Services) |
| R1-128 | 53 | Status filter chips | NOT-MENTIONED | Job list (Services) |
| R1-129 | 54 | Job list search | NOT-MENTIONED | Job list (Services) |
| R1-130 | 56 | Column: technician | BUILT-in-app | Job list (Services) |
| R1-131 | 62 | Shared queue jobs staff can take | BUILT-in-prototype | Job list (Services) |

**Money — tax, payments, invoicing**

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| R1-132 | 221 | Tax-inclusive toggle and rate | IN-SPEC (not built) | Shop settings |
| R1-133 | 222 | Allow discounts | BUILT-in-app | Shop settings |
| R1-134 | 232 | Online customer payment (Stripe connect) | IN-SPEC (not built) | Payments, deposits and coupons |
| R1-135 | 238 | Payment recorded at the counter vs an open payment link | IN-SPEC (not built) | Payments, deposits and coupons |
| R1-136 | 236 | Invoicing from the job | IN-SPEC (not built) | Payments, deposits and coupons |
| R1-137 | 237 | Refunds, voids and returns | IN-SPEC (not built) | Payments, deposits and coupons |
| R1-138 | 26 | Deposit taken during online booking | EXPLICITLY-DEFERRED | Booking widget / customer front door |
| R1-139 | 240 | Third-party partner responsible for payment on a job | NOT-MENTIONED | Third parties (insurer / employer payers) |

**POS integration**

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| R1-140 | 282 | Connect to an external till | IN-SPEC (not built) | POS integration |
| R1-141 | 283 | Lightspeed R-Series work-order sync | IN-SPEC (not built) | POS integration |
| R1-142 | 285 | Inventory adjusted on part add/remove, returned on cancel | IN-SPEC (not built) | POS integration |
| R1-143 | 288 | POS product / inventory sync page | IN-SPEC (not built) | POS integration |
| R1-144 | 287 | Technician mapped to a POS employee | NOT-MENTIONED | POS integration |
| R1-145 | 291 | Disconnect and credential revocation | IN-SPEC (not built) | POS integration |
| R1-146 | 292 | Visible sync freshness / degraded operation | IN-SPEC (not built) | POS integration |
| R1-147 | 284 | Lightspeed X-Series support | IN-SPEC (not built) | POS integration |

**Printing**

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| R1-148 | 294 | Receipt / job-card printing | BUILT-in-app | Printing |
| R1-149 | 78 | Print the job card | BUILT-in-app | Job card |
| R1-150 | 79 | Print job tag automatically after book-in | NOT-MENTIONED | Job card |
| R1-151 | 298 | Print automatically after book-in | NOT-MENTIONED | Printing |
| R1-152 | 297 | Work-order barcode that opens the job | NOT-MENTIONED | Printing |

**Import and migration**

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| R1-153 | 179 | Customer CSV import | IN-SPEC (not built) | Customers and items |
| R1-154 | 276 | Customer CSV import | IN-SPEC (not built) | Imports and migration |
| R1-155 | 278 | Import row quarantine on malformed data | IN-SPEC (not built) | Imports and migration |
| R1-156 | 279 | Resumable, checkpointed import | IN-SPEC (not built) | Imports and migration |
| R1-157 | 182 | Duplicate-customer detection and merge | IN-SPEC (not built) | Customers and items |
| R1-158 | 183 | Phone-number match creating identity | EXPLICITLY-DEFERRED | Customers and items |

**Reports — need the data to have accumulated**

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| R1-159 | 258 | Bookings reports (daily snapshot, booked-in detail, by platform, by day-hour) | NOT-MENTIONED | Reports |
| R1-160 | 273 | VAT / tax reporting | IN-SPEC (not built) | Reports |
| R1-161 | 271 | Workshop financials (revenue and labour per technician, AOV, turnover, parts, job-card breakdown) | EXPLICITLY-DEFERRED | Reports |
| R1-162 | 264 | Group / multi-store capacity reports | EXPLICITLY-DEFERRED | Reports |

**Remaining shop settings and platform hardening**

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| R1-163 | 223 | Store type | NOT-MENTIONED | Shop settings |
| R1-164 | 224 | GDPR marketing-consent prompt and text | IN-SPEC (not built) | Shop settings |
| R1-165 | 225 | Free-text merge tag | NOT-MENTIONED | Shop settings |
| R1-166 | 228 | Workshop notification settings | BUILT-in-prototype | Shop settings |
| R1-167 | 229 | Workshop-only mode (job without a till sale) | BUILT-in-app (partial) | Shop settings |
| R1-168 | 248 | Custody tracked separately from work and payment | BUILT-in-prototype | Pick-up and delivery |
| R1-169 | 253 | Bike Sale product module | BUILT-in-app | Bike sale |
| R1-170 | 316 | Public status page and error tracking | IN-SPEC (not built) | Platform |
| R1-171 | 317 | Point-in-time recovery and a tested restore | IN-SPEC (not built) | Platform |
| R1-172 | 315 | Chain / multi-store data model | EXPLICITLY-DEFERRED | Platform |

### Later (102)

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| Later | 13 | Facebook Pixel on the widget | NOT-MENTIONED | Booking widget / customer front door |
| Later | 12 | Google Tag Manager on the widget | NOT-MENTIONED | Booking widget / customer front door |
| Later | 10 | Allow coupon entry at booking | NOT-MENTIONED | Booking widget / customer front door |
| Later | 5 | Widget language selection | NOT-MENTIONED | Booking widget / customer front door |
| Later | 40 | Server-side overlap prevention on staff moves | IN-SPEC (not built) | Calendar / diary |
| Later | 71 | Link another job (several jobs per visit) | NOT-MENTIONED | Job card |
| Later | 72 | Schedule multiple jobs per customer in one pass | NOT-MENTIONED | Job card |
| Later | 74 | Send-to / share icon | NOT-MENTIONED | Job card |
| Later | 77 | QR code to upload from a mobile device | NOT-MENTIONED | Job card |
| Later | 81 | Internal notes (employees only) | IN-SPEC (not built) | Job card |
| Later | 82 | External notes tier | IN-SPEC (not built) | Job card |
| Later | 83 | Customer-visible notes tier | IN-SPEC (not built) | Job card |
| Later | 88 | Total expressed as time and money | IN-SPEC (not built) | Job card |
| Later | 89 | Job timer start/stop on the card | NOT-MENTIONED | Job card |
| Later | 90 | Globally floating active-timer widget | NOT-MENTIONED | Job card |
| Later | 91 | Checklist alerts that block closing the job | IN-SPEC (not built) | Job card |
| Later | 101 | Service History tab on the item | BUILT-in-app | Job card |
| Later | 102 | Service history across other stores in a chain | EXPLICITLY-DEFERRED | Job card |
| Later | 107 | Explicit allowed transitions (state machine) | IN-SPEC (not built) | Statuses, SLA and workflow rules |
| Later | 120 | Workshop bays as a first-class field | NOT-MENTIONED | Statuses, SLA and workflow rules |
| Later | 131 | Warranty Work Started template | NOT-MENTIONED | Messaging — templates |
| Later | 132 | Waiting for Client template | NOT-MENTIONED | Messaging — templates |
| Later | 129 | Waiting for Work template | NOT-MENTIONED | Messaging — templates |
| Later | 130 | Job Started template | NOT-MENTIONED | Messaging — templates |
| Later | 134 | Multi Quote Approval template | NOT-MENTIONED | Messaging — templates |
| Later | 135 | Waiting for Parts template | IN-SPEC (not built) | Messaging — templates |
| Later | 136 | Waiting for Parts - Delay, automatic after 96 h | NOT-MENTIONED | Messaging — templates |
| Later | 138 | Bike Collected template | NOT-MENTIONED | Messaging — templates |
| Later | 140 | Delivery Booked template | NOT-MENTIONED | Messaging — templates |
| Later | 141 | 6-month service reminder | IN-SPEC (not built) | Messaging — templates |
| Later | 142 | Post-service follow-up (3 days after) | IN-SPEC (not built) | Messaging — templates |
| Later | 143 | 12-month reminder if no service since | IN-SPEC (not built) | Messaging — templates |
| Later | 144 | Pre-approved message | BUILT-in-prototype | Messaging — templates |
| Later | 145 | Bike-not-collected message and reminder | NOT-MENTIONED | Messaging — templates |
| Later | 147 | Waiver Signed message | NOT-MENTIONED | Messaging — templates |
| Later | 149 | Bike Sale and Bike Sale Follow-up messages | NOT-MENTIONED | Messaging — templates |
| Later | 150 | Configurable timers behind the templates (reminder hours, follow-up days, 6/12 months, 2-then-4 days) | NOT-MENTIONED | Messaging — templates |
| Later | 151 | Suppression / opt-out rechecked at send time | IN-SPEC (not built) | Messaging — templates |
| Later | 158 | Bring-your-own Ikeono | NOT-MENTIONED | Messaging — channels |
| Later | 159 | Bring-your-own Podium | NOT-MENTIONED | Messaging — channels |
| Later | 165 | Provider-balance / revoked-credential error surface | IN-SPEC (not built) | Messaging — channels |
| Later | 170 | Multi-quote options | NOT-MENTIONED | Quotes and approval |
| Later | 172 | Send quote to the POS | IN-SPEC (not built) | Quotes and approval |
| Later | 178 | No browsable customer list | IN-SPEC (not built) | Customers and items |
| Later | 180 | Referral code on the customer | NOT-MENTIONED | Customers and items |
| Later | 185 | Item fields: manufacturer, model, year, colour, size, type | IN-SPEC (not built) | Customers and items |
| Later | 187 | Transfer a bike between customers | NOT-MENTIONED | Customers and items |
| Later | 188 | Duplicate-serial detection | IN-SPEC (not built) | Customers and items |
| Later | 189 | Project 529 Garage stolen-bike check | NOT-MENTIONED | Customers and items |
| Later | 190 | Bike spec autofill from a data source | IN-SPEC (not built) | Customers and items |
| Later | 194 | All-services checklist flag | NOT-MENTIONED | Checklists and service questions |
| Later | 197 | Checklist attached per service type | NOT-MENTIONED | Checklists and service questions |
| Later | 198 | Photos per inspection item | IN-SPEC (not built) | Checklists and service questions |
| Later | 205 | Per-channel service description | NOT-MENTIONED | Service types |
| Later | 206 | Per-service-type technician list | NOT-MENTIONED | Service types |
| Later | 207 | Per-service-type message template | NOT-MENTIONED | Service types |
| Later | 208 | Price and duration snapshotted at booking | IN-SPEC (not built) | Service types |
| Later | 216 | Two-factor authentication (Google Authenticator) | IN-SPEC (not built) | Staff, hours and leave |
| Later | 226 | Trustpilot / Google Reviews URLs | NOT-MENTIONED | Shop settings |
| Later | 230 | Subscription management page | EXPLICITLY-DEFERRED | Shop settings |
| Later | 231 | Published tiered pricing (Lite / Professional / Premium) | EXPLICITLY-DEFERRED | Shop settings |
| Later | 233 | Take a deposit during online booking | EXPLICITLY-DEFERRED | Payments, deposits and coupons |
| Later | 234 | Coupons (code, redeem method, type, value, expiry, redemptions) | NOT-MENTIONED | Payments, deposits and coupons |
| Later | 235 | Gift cards | EXPLICITLY-DEFERRED | Payments, deposits and coupons |
| Later | 239 | Billing stub separated from real settlement | BUILT-in-prototype | Payments, deposits and coupons |
| Later | 241 | "Send to third party only" for quote approval | NOT-MENTIONED | Third parties (insurer / employer payers) |
| Later | 242 | Pick-ups and deliveries scheduling module | NOT-MENTIONED | Pick-up and delivery |
| Later | 243 | Pick-ups nav section and setup flow | NOT-MENTIONED | Pick-up and delivery |
| Later | 244 | Customer books a delivery from a link | NOT-MENTIONED | Pick-up and delivery |
| Later | 245 | Collections options | IN-SPEC (not built) | Pick-up and delivery |
| Later | 247 | Authorised-collector verification | IN-SPEC (not built) | Pick-up and delivery |
| Later | 254 | Bike-sale follow-up nudging a service | IN-SPEC (not built) | Bike sale |
| Later | 255 | Pre-service waiver signed on the widget before scheduling | NOT-MENTIONED | Waivers |
| Later | 256 | Post-service waiver with optional technician and manager signature | NOT-MENTIONED | Waivers |
| Later | 257 | A named report catalogue with date ranges | NOT-MENTIONED | Reports |
| Later | 261 | Export reports (customers, products, services, work orders) | IN-SPEC (not built) | Reports |
| Later | 262 | Financial reports (future work, invoices paid) | NOT-MENTIONED | Reports |
| Later | 263 | Gift-card reports | NOT-MENTIONED | Reports |
| Later | 265 | Inventory-on-incomplete-jobs report | NOT-MENTIONED | Reports |
| Later | 266 | Item manufacturer split report | NOT-MENTIONED | Reports |
| Later | 267 | Referral report | NOT-MENTIONED | Reports |
| Later | 268 | Item sales report | BUILT-in-app | Reports |
| Later | 270 | Time-in-status summary and detail | NOT-MENTIONED | Reports |
| Later | 272 | Workshop performance (ratings, turnaround, availability, services performed) | EXPLICITLY-DEFERRED | Reports |
| Later | 274 | Jobs-per-shop-per-week usage dashboard | IN-SPEC (not built) | Reports |
| Later | 275 | Excel job-import template | IN-SPEC (not built) | Imports and migration |
| Later | 277 | Historical sales / refunds / notification history import | IN-SPEC (not built) | Imports and migration |
| Later | 280 | Cutover authority and rollback limit | IN-SPEC (not built) | Imports and migration |
| Later | 281 | Live till integration and migration | EXPLICITLY-DEFERRED (prototype) | Imports and migration |
| Later | 289 | Vend / Shopify / Xero / Teamwork connectors | BUILT-in-app (Shopify only) | POS integration |
| Later | 290 | Citrus-Lime connector | EXPLICITLY-DEFERRED | POS integration |
| Later | 293 | Purchase orders with split deliveries | BUILT-in-app | POS integration |
| Later | 295 | Receipt Designer (template editor) | NOT-MENTIONED | Printing |
| Later | 296 | Print options: logo, checklist, line barcode, QR | NOT-MENTIONED | Printing |
| Later | 303 | In-app changelog | IN-SPEC (not built) | Community and referral |
| Later | 304 | In-app help centre | IN-SPEC (not built) | Community and referral |
| Later | 305 | Service ratings by the customer | NOT-MENTIONED | Community and referral |
| Later | 306 | Technician leaderboard | EXPLICITLY-DEFERRED | Community and referral |
| Later | 307 | Browser-based shop side, no native staff app | IN-SPEC (not built) | Mobile and devices |
| Later | 308 | Fully responsive shop and customer surfaces | BUILT-in-prototype | Mobile and devices |
| Later | 310 | Phone camera capture of media | BUILT-in-prototype (device capture unproven) | Mobile and devices |
| Later | 311 | QR route to upload from a phone | NOT-MENTIONED | Mobile and devices |

### Not for us (43)

| Priority | Row | Hubtiger feature | Our status | Area |
|---|---|---|---|---|
| No | 15 | Customer picks a date only, no time of day | IN-SPEC (not built) | Booking widget / customer front door |
| No | 9 | "Where did you hear about us" capture | NOT-MENTIONED | Booking widget / customer front door |
| No | 30 | 2-week view | NOT-MENTIONED | Calendar / diary |
| No | 34 | Per-technician iCal subscription link | NOT-MENTIONED | Calendar / diary |
| No | 44 | Labour goals shown on the calendar | NOT-MENTIONED | Calendar / diary |
| No | 45 | Labour totals and revenue on the day slide-out | NOT-MENTIONED | Calendar / diary |
| No | 51 | Job list as a table | BUILT-in-app | Job list (Services) |
| No | 55 | Job list CSV export | IN-SPEC (not built) | Job list (Services) |
| No | 57 | Column: original booking date | NOT-MENTIONED | Job list (Services) |
| No | 58 | Column: days since original date (ageing) | NOT-MENTIONED | Job list (Services) |
| No | 59 | Bulk cancel | NOT-MENTIONED | Job list (Services) |
| No | 60 | Bulk collect | NOT-MENTIONED | Job list (Services) |
| No | 61 | Bulk complete | NOT-MENTIONED | Job list (Services) |
| No | 69 | Service type on the card | IN-SPEC (not built) | Job card |
| No | 95 | "Bike is here" default | IN-SPEC (not built) | Job card |
| No | 119 | Revised completion estimate visible to the customer | BUILT-in-prototype | Statuses, SLA and workflow rules |
| No | 146 | Delivery-not-booked message and reminder | NOT-MENTIONED | Messaging — templates |
| No | 148 | Fitting message set (booked, reminder, completed, 6-month follow-up, waiver) | NOT-MENTIONED | Messaging — templates |
| No | 156 | Resold SMS credit bundles | EXPLICITLY-DEFERRED | Messaging — channels |
| No | 163 | Message bundles page | EXPLICITLY-DEFERRED | Messaging — channels |
| No | 169 | Approval bound to an immutable estimate version | IN-SPEC (not built) | Quotes and approval |
| No | 171 | "Send to third party only" for approval | NOT-MENTIONED | Quotes and approval |
| No | 173 | Approved lines flow into the job's order with no re-entry | IN-SPEC (not built) | Quotes and approval |
| No | 186 | Serial number on the item | BUILT-in-app | Customers and items |
| No | 215 | Technician count capped by subscription tier | NOT-MENTIONED | Staff, hours and leave |
| No | 218 | Mechanic cannot operate the till but can edit work | IN-SPEC (not built) | Staff, hours and leave |
| No | 227 | Insight report emails (daily productivity and finance) | NOT-MENTIONED | Shop settings |
| No | 246 | Vehicle utilisation reporting | NOT-MENTIONED | Pick-up and delivery |
| No | 249 | Bike fitting as a distinct service line | NOT-MENTIONED | Bike fittings |
| No | 250 | Fitting statuses (Appointment scheduled, Fitting completed) | NOT-MENTIONED | Bike fittings |
| No | 251 | Bike Fittings setup page | NOT-MENTIONED | Bike fittings |
| No | 252 | Fitting waivers | NOT-MENTIONED | Bike fittings |
| No | 259 | "How did they hear about us" report | NOT-MENTIONED | Reports |
| No | 260 | Customer and retention reports | NOT-MENTIONED | Reports |
| No | 269 | Rescheduled-bookings report | NOT-MENTIONED | Reports |
| No | 286 | Special orders originating in the workshop system | IN-SPEC (not built) | POS integration |
| No | 299 | Signed one-page print-agent installer | IN-SPEC (not built) | Printing |
| No | 300 | In-product community feed | IN-SPEC (not built) | Community and referral |
| No | 301 | Shop Rides widget | NOT-MENTIONED | Community and referral |
| No | 302 | Refer & Earn / referral earnings | NOT-MENTIONED | Community and referral |
| No | 309 | Mechanic inspection on a phone | BUILT-in-prototype | Mobile and devices |
| No | 312 | Consumer-facing rider app | EXPLICITLY-DEFERRED | Mobile and devices |
| No | 313 | Workshop display screens | EXPLICITLY-DEFERRED | Mobile and devices |

---

Two things spotted while checking the data, neither changed:

- Rows **179** and **276** are both "Customer CSV import", in different areas. Looks like one feature counted twice in the 317.

- Rows **79** and **298** are both auto-print after book-in ("Print job tag automatically after book-in" / "Print automatically after book-in"). Possibly the same thing.

