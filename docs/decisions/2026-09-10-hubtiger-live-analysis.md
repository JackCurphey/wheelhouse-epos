# Hubtiger — live product analysis, 10 September 2026

**Status:** Research report. Not a decision. Feeds the first-release feature scope.
**Method:** Authenticated walk of Jack's Hubtiger trial store ("Deeznuts",
Lightspeed X-Series connected, 5 trial days left) driven through the Chrome
DevTools MCP server, plus a fetch of the public site and help centre. Every
page named below was opened and its accessibility tree or screenshot captured;
captures sit in the session scratchpad, not the repo.
**Builds on:** `docs/decisions/2026-09-08-competitive-trials.md` §3.5 (Jack's
8 Sep trial, on `origin/docs/competitive-trials-2026-09-08`) and
`research/business/business-research.md` §3.6. This report does not repeat what
those already observed; it adds what they did not reach.

**Evidence tags.** **[O]** observed by me today in the authenticated app.
**[J]** observed by Jack on 8 Sep, cited from the trials doc. **[V]** vendor
documentation or in-app changelog. **[R]** third-party reported. **[NF]**
looked for, not found — not proof of absence.

---

## 1. What this pass adds

Seven things the earlier documents did not record at this level of detail.
Some were named in passing before (per-item history and R-Series work orders
in business-research §3.6; repair waivers and the Citrus Lime picker entry in
the 8 Sep trial); what is new is the observed detail, not the headline.

1. **UK pricing in GBP, read from the in-app subscription page [O].** Workshop
   Lite £45, Professional £65, Premium £85 per month; rentals £30 to £229;
   WhatsApp add-on £8/month. This answers the "USD only?" open question in
   business-research §3.6 for this account; billing terms and VAT treatment
   were not inspected. No conversion is attempted here — the three GBP/USD
   pairs do not sit at one exchange rate.
2. **The automated-message catalogue as shown in this store [O]** — 26
   workshop templates, 5 fitting, 2 bike-sale (§4). This is the concrete definition of what
   "automated status messaging" means in this market.
3. **The report dropdown [O]** — 55 named reports in 14 groups (§7). None was
   run.
4. **The status vocabulary, and the transitions offered from one state [O]**
   (§3). Only the Waiting - Parts dropdown was opened.
5. **Every top-level settings page [O]** (sub-flows listed in §11 were not
   exercised), including the automation timers, SLA
   thresholds, calendar options and job-card options (§5, §6).
6. **The in-app changelog [V]**: per-item service history across a chain
   (31 Aug 2026), the new job card (Oct 2025), and a real-time Lightspeed
   **R-Series** work-order sync (Nov 2025) with the explicit rule that special
   orders must originate in Hubtiger (§8).
7. **Four discrepancies between the vendor's public site and the product** (§9).

## 2. Information architecture [O]

Left nav: Dashboard · Services · Calendar · Reports · Customers · Pick-ups ·
Settings · All Notifications · Community · Help · Refer & Earn.

**Dashboard** shows: SLA counters ("waiting for parts longer than 4 days",
"client longer than 1 day", "work longer than 2 days", "complete longer than
2 days", "work past scheduled date"); daily summary split by booking channel
(**Online / App / Portal**), jobs completed, revenue; service ratings;
technician leaderboard; configuration overview (active technicians, service
types, message templates, linked customers, POS inventory synced — 25 in this
store); a floating **Active Timers** widget that persists across every page.

**Services** is the job list: KPI tiles (Pick Ups, Open Jobs, Bike Ready,
Deliveries, Cancelled, I Need Help, Bike Is Here), status filter chips, search,
CSV export, columns Job Card / Customer / Phone / Bike / Work Done / Technician
/ Scheduled / **Original Date** / **Days Since Original Date** / Status, and
**bulk Cancel / Collect / Complete**.

**Calendar**: Day / Week / 2-Week / Month, technicians as rows each with an
iCal link and a Configure control, a per-day **hours-available strip** per
technician, and a 12-colour status legend (Pick Ups, Booked In, Waiting for
Work, Waiting - Client, Waiting - Parts, Warranty, Working On, Bike Ready,
Collected, Deliveries, Appointment scheduled, Fitting completed).
Drag-to-reschedule was verified by Jack [J].

**Customers**: search by last name / email / phone only — there is no browse
list until you search; CSV import; columns include a **Referral Code**.
The customer detail view did not open from the results row in my session
[NF — not reached, not absent].

## 3. Job card [O]

Opened as a modal over the Services list (URL `/store/services/open`).

- Header: customer name, email, phone; job number; scheduled date-time;
  technician; service type. Item chip (`#96 · Demo Bike`) plus **Link Another
  job** (multi-job per visit).
- Controls, left panel: an exit/collect icon, a **status dropdown**, a
  send-to icon, a **messages-and-attachments** icon, a move icon (disabled),
  a **print** icon. None carries a tooltip. The messages panel reads "There
  are no notifications for this job" with a compose box, and the attachments
  panel reads "Drag and drop or tap to add, 20MB max — **Scan QR code to
  upload from a mobile device**". Upload is drag-and-drop or tap in the
  browser, with a QR route for a phone. No native staff app was found [NF];
  a mobile browser was not tested.
- **Status transitions offered from the dropdown** while in Waiting - Parts:
  Waiting For Work · Begin Job · Warranty Job · Waiting For Parts · Waiting For
  Client · Job Completed · Cancel Job. The full status set (from Calendar
  Options) is: Pick Ups, Booked In, Waiting for Work, Working On, Warranty,
  Waiting - Parts, Waiting - Client, Bike Ready, Collected, Deliveries,
  Cancelled — **eleven, every label renameable**. The calendar legend shows
  twelve: it adds Appointment scheduled and Fitting completed (fittings) and
  omits Cancelled.
- Three note tiers: Internal ("only shop employees"), External, Customer.
- Right panel: item name and year; product search "by name, SKU or other"
  with an All / Service Types filter; line items with SKU and price; Tax and
  Total shown as **time and money** ("1Hr 30Mins | £75.00"); **Send quote to
  customer** and **Send quote to POS**. The POS push is broken on this
  X-Series account [J].
- Clicking the item opens **Update an item**: Manufacturer, Model, Year,
  Color, Serial Number, Size, Type (Road…), "Select a different item", and a
  **Service History** tab (the 31 Aug 2026 feature, §8).
- Timer: start/stop on the card; the active timer floats globally.

## 4. Automated messaging — the template catalogue [O]

Settings → Message Templates. Each is a toggle-able template (all were off in
this trial: dashboard reads "0 Active Message Templates"). Names and the
vendor's own one-line trigger descriptions:

**Services (26):** Pickup · Bike Picked Up · Booked In · Booking Reminder
(24 h before, configurable) · Collection Reminder · Waiting for Work · Job
Started · Warranty Work Started · Waiting for Client · **Quote Approval** (link
to an approval page) · **Multi Quote Approval** · Waiting for Parts · **Waiting
for Parts - Delay** (auto after 96 h) · Job Completed · Bike Collected ·
Delivery (link to book delivery) · Delivery Booked · **6 Month Reminder** ·
**Post Service Followup** (3 days after, configurable) · **12 Month Reminder**
(if no service since) · Pre-approved message · Bike not collected · Bike not
collected reminder · Delivery not booked · Delivery not booked reminder ·
Waiver Signed.

**Fittings (5):** Fitting Booked In · Fitting Reminder · Fitting Completed ·
Fitting Follow Up (6 months) · Waiver Signed.
**Bike Sale (2):** Bike Sale · Bike Sale Follow up (1 month later, nudges a
service).

**Timers behind them** (Settings → Other Settings → Messaging Options):
reminder hours before service (24), follow-up days after (3), first
post-service reminder months (6), second (12), bike-not-collected days (2 then
4), delivery-not-booked days (2 then 4).

**Channels:** SMS credits resold at 500/£16, 1000/£30, 2000/£56 [J,O] or
bring-your-own via **Ikeono, Podium, Twilio** [O]; WhatsApp add-on £8/month
[O]; email. Ikeono is US/Canada/Australia only per the changelog [V].

## 5. Settings surface [O]

General: Users · Shop Profile · Other Settings · POS integration · Manage
Subscription. Products: POS Products · Bike Sale. Services: Service Types ·
Bike Fittings · Service Imports. Workflow: Pick-ups/Deliveries Setup · Custom
Service Questions · Checklist Configuration · Workshop & Fitting Waivers ·
Third Parties. Payment: Online Payments · Coupons · Service Deposits.
Messaging: Message Templates · Message Bundles · WhatsApp Integration · Text
Message Platform Integration. Plugins: Website Widget · Shop Rides Widget ·
Receipt Designer.

Notable fields:

- **Users**: roles seen are **Admin** and **Technician** only; tabs for Staff,
  Working Hours (per-technician monthly hours grid), Sort Calendar Resources,
  Staff Leave, Closing Dates. "You can have up to 4 technicians with your
  current payment plan" — the tier gate is enforced here.
- **Shop Profile**: minimum job-card number, enable online bookings, enable
  fittings, tax-inclusive toggle and rate, "Allow Discounts — only available
  for Shopify, Vend, Xero, Teamwork and Lightspeed", store type, **two-factor
  auth (Google Authenticator)**, GDPR marketing-consent prompt and text,
  free-text merge tag, Trustpilot and Google Reviews URLs, **Project 529
  Garage** stolen-bike check toggle.
- **Service Types**: category, name, cost, duration, **linked SKUs auto-added
  to the quote**, allow widget/app booking, per-channel description, per-type
  technician list, per-type checklist and message template.
- **Checklist items**: name, control type (checkbox or value box e.g. seat
  height), pre-service flag (shown at book-in), all-services flag, front-and-
  rear flag, label colour.
- **Custom Service Questions**: drag-and-drop text input / text area /
  checkbox, linked to service types, asked on the widget.
- **Waivers**: pre-service (signed on widget before scheduling) and
  post-service (optionally technician and manager also sign). Present for
  repair, not only rental — see §9.
- **Service Deposits**: single toggle "take payment during online booking".
  **Online Payments**: Stripe connect, framed around pick-up/delivery.
- **Coupons**: code, redeem method, type, value, linked-to, expiry,
  redemptions.
- **Third Parties**: partners who can be responsible for payment on a job
  (insurers, employers); "Send to Third Party Only" for quote approval [V].
- **Other Settings** tabs: Insight Reports (daily productivity and finance
  emails), Workshop Settings (**bays and tags**), Workshop Notifications,
  Messaging Options (§4), Calendar Options (rename statuses, technician
  legend, labour goals, labour totals and revenue on slide-out, show original
  booking date, bike type on card, 5/15/30-minute grid), **Job Card Options**
  (new layout, timers, **multi-quote options**, barcode exact auto-add, quote
  updates service types, bike-is-here default, print after book-in, third-party
  partners, **lock job card on collection**), Inventory Management (transfer a
  bike between customers), Receipt Printer Options (logo, checklist, line
  barcode, QR, work-order barcode that opens the job), Collections Options.
- **Website Widget**: booking lead time in days, language, pre-selected
  service type or group, additional and payment info text, show prices, "where
  did you hear about us", allow coupons, show pre-approved amount, Google Tag
  Manager, Facebook Pixel, theme colours and 22 fonts, iframe or URL embed.
  No time-of-day selection is offered to the customer [J].
- **Service Imports**: Excel job import template (migration path).
- **POS integration**: "UPDATE VEND CONFIG" — default register, tax, user,
  payment type; map each technician to a POS employee so quotes post under
  them; disconnect.

## 6. SLA and workflow rules [O]

Dashboard SLA thresholds: parts > 4 days, client > 1 day, work > 2 days,
complete > 2 days, past scheduled date. Job list carries Original Date and
days elapsed. Waiting-for-parts auto-message at 96 h. Lock-on-collection.
Bulk complete/collect/cancel. Bays and tags are first-class fields.

## 7. Reports [O]

55 named reports in the Reports dropdown, date-ranged, grouped: **Bookings**
(daily snapshot, booked-in detail, how did they hear about us, by platform, by
day-hour, collections and deliveries, vehicle utilisation); **Customer**
(customers, retentions); **Exports** (customers, products, services or work
orders); **Financial** (future work, invoices paid by Stripe); **Gift Cards**;
**Group** (shops booked out, daily store capacity, technician online hours,
bookings by platform, store capacity); **Inventory** (inventory on incomplete
jobs); **Item** (manufacturer split); **Referral**; **Sales** (item sales);
**Service** (rescheduled bookings); **Status** (time-in-status summary and
detail); **Workshop Financials** (revenue by technician with and without
salespeople, average order value, turnover, labour revenue, labour per
technician, outsourced labour per technician, parts per technician, revenue by
part type, job-card breakdown); **Workshop** (technician ratings, performance,
status per technician, services performed, detailed performance, revenue per
technician per day, job turnaround, workshop repairs, technician availability).
Gift cards and referral earnings exist as reports though no settings page for
them was seen [NF].

## 8. In-app changelog (Beamer) [V]

- **31 Aug 2026 — service history on the item**, split-panel list of past jobs
  with technician notes, **across other stores in the chain**, new job card
  only.
- **27 Aug 2026** — hiring customer-experience cover for Australia/NZ hours.
- **4 Nov 2025 — Lightspeed R-Series work orders sync in real time**:
  creating or updating a job card updates the R-Series work order; inventory
  adjusts on add/remove and returns on cancel; linked job cards each get their
  own work order; **special orders must be marked in Hubtiger, not
  Lightspeed**; status must be Job Complete before the sale closes. Setup:
  enable the Service optional module in R-Series and "Use Work Orders for
  Workshop" in Hubtiger.
- **31 Oct / 10 Oct 2025 — new job card**: fewer clicks, schedule multiple
  jobs per customer, SKU groups, linked jobs, service-writer shown, checklist
  alerts block close, Ctrl+Enter to send, "Send to Third Party Only".
- **29–30 Oct 2025** — outage attributed to the Azure network incident. The
  whole product runs on Azure (`*.azurewebsites.net`).
- **29 Sep 2025** — Ikeono unified inbox.

## 9. Contradictions worth recording

1. **Citrus-Lime.** The public integrations page has no Citrus-Lime entry and
   `/integrations/citrus-lime` returns 404 [V, checked directly]. The in-app
   POS picker lists **Citrus Lime** as a connectable platform [J]. Unresolved
   whether it works; a listed option is not a supported integration.
2. **Waivers.** Marketed only under rentals; present in the repair product
   (Workshop Waivers) and in the repair help centre (4 articles) [O, V].
3. **Booking time.** Marketing says customers pick "date & time"; the widget
   offers date only and the system auto-assigned technician and slot [J]. Only
   one widget configuration was tested.
4. **Mobile app.** The only app-store product found is a consumer cyclist app
   [V]; the shop side observed is browser-based with a QR route for phone
   uploads [O]. A staff app was looked for and not found [NF]. The August spec
   asked for mobile/tablet access, not a native app.

## 10. What this means for the first release — a proposal, not a finding

Everything in this section is inference from one trial store plus the
earlier documents. It has no shop-usage data behind it; the ranking is the
author's estimate and is the part of this report the Codex reviews
(`docs/reviews/2026-09-10-hubtiger-analysis-codex-*.md`) attack hardest.

The 8 Sep review (F04) said feature parity is a candidate backlog, not a launch
requirement. Nothing seen today changes that. What it does is make the
parity list concrete and rankable.

**Present in Hubtiger and plausibly expected by a shop that has used it [O]**,
in the author's estimated order of weekly frequency (unmeasured):

1. Status-driven automated messages with a per-status template and toggle,
   over email and SMS at minimum. Hubtiger's 27 templates collapse to about
   ten events a UK shop uses daily: booked in, reminder, started, waiting
   parts, waiting client, quote approval, completed, collected, follow-up,
   6/12-month reminder.
2. Quote approval by link, with a pre-approved amount that skips the ask.
3. Job card with timer, three note tiers, parts from the catalogue, time-and-
   money total, service history on the item.
4. Eleven-ish statuses, renameable, with SLA ageing (original date, days
   since).
5. Checklists per service type, pre-service checks at book-in, blocking close.
6. Bays and tags; print job tag after book-in.
7. Staff hours, leave, closing dates driving the diary's availability strip.
8. Per-technician revenue and time-in-status reporting.
9. Excel job import and CSV customer import for migration.

**Things Hubtiger has that are plausibly deferrable:** fittings, pick-up and
delivery scheduling, coupons, deposits at booking, third-party payers,
multi-quote options, waivers, community posts and rides, referral earnings,
gift cards, the receipt template designer, GTM and Pixel on the widget.

**Where Hubtiger is weak and a shop would notice [O,J]:** no customer time
selection in the tested configuration; no pending-approval queue seen
(booking confirmed instantly in that configuration); a Customers page with no
list view; unlabeled icon buttons on the job card; a quote-to-POS push on
X-Series that returns HTTP 200 and surfaces a raw .NET exception to the shop
with nothing landing in the POS [J]; only Admin and Technician roles seen;
runs on Azure and was taken down by the Oct 2025 Azure incident [V].

**Open, still:** whether the quote push works on R-Series at all, which is a
separate integration from the failing X-Series one — needs an R-Series
account; what a customer
receives on quote approval — send one; whether Citrus Lime in the picker
connects to anything; per-store vs chain data model.

## 11. Not observed today

Customer detail view; Schedule Service wizard (documented by Jack); Receipt
Designer (documented by Jack); Pick-ups configuration flow; Bike Fittings
setup; Shop Rides; Refer & Earn; running any report against data; the
technician Configure dialog on the calendar; what the unlabeled exit and
send-to icons on the job card do (not clicked — they may change state or spend
an SMS credit).
