# Workshop-first build — spec

**Date:** 31 August 2026
**Decision:** the workshop module is what we build first. See
`docs/decisions/2026-08-31-business-plan.md` §4 (the free wedge) and §5 (the
rider-owned bike record).
**Research behind it:** five parallel passes on 31 Aug 2026 — prior art for a
rider garage, multi-jurisdiction privacy, sharing/theft/insurance mechanics, a
code inventory of what we have today, competitor workshop features, and bike
specification data sourcing. Confidence tags below follow the existing
convention: **[V]** verified against a primary source · **[R]** third-party
reported · **[U]** unverified · **[NF]** searched, not found.

---

## 1. What the research changed

Three findings reshape the plan rather than decorate it.

**Our diary is weaker than we claimed.** The business research and the business
plan both describe "server-enforced hours and overlap." That is true only on the
customer booking path. For staff-created and staff-moved jobs, overlap
prevention, opening-hours clamping, working-day blocking and the complete-job
lock are enforced in `public/app.js` and nowhere else **[V, code]**. Any
authenticated request can double-book a mechanic, place a job at 03:00, or book
a closed Sunday. The rules already exist server-side for the portal route
(`server/server.js:3238-3261`); they were never lifted into the staff routes.

**There is not one test touching workshop behaviour.** Fourteen test files cover
auth, gateway, proxy trust, Shopify and storefront. Nothing covers jobs, the
diary, availability, portal booking or attachments **[V, code]**. We are about
to lead with the untested part of the product.

**The category's open gap is the one we are already closest to.** No production,
independently-verified cycling tool has a rich persistent bike entity.
Citrus-Lime's own documentation confirms its serial handling is transaction-level
only **[V]**; Velodrop's docs have no bike section at all **[NF]**; Bikedesk's
serialised items read as inventory tracking **[U]**; only Bikebook confirms a
bike as a first-class record **[V]**, and bikeryOS makes the full "8-9 year asset
life" claim but was not live in production at the time of research and has no
independent trace **[V for the claim, NF for any validation]**. We already have
`customer_bikes` as a first-class entity **[V, code]** — thin, but real.

## 2. Where we stand against the field

**Table stakes** — present in essentially every dedicated cycling workshop tool
(Bikebook, Velodrop, Bikedesk, Hubtiger, Citrus-Lime's module, Seanic):

| Capability | Us today |
|---|---|
| Online customer self-booking into a shop calendar | **Have** — portal, guest booking by phone, server-side capacity gate |
| Digital work order with status | **Have** — five statuses, no state machine, no history |
| Parts drawn from inventory onto a job | **Have** — writes through to a linked order |
| Service history on repeat visits | **Partial** — per bike only; a job with no bike appears in no history view |
| Mobile/tablet access | **Partial** — browser only, not designed for the shop floor |
| **Automated SMS/email on status change** | **Absent.** SMS is manual, one call site, no templates. **Email does not exist anywhere in the codebase** — not even password reset |

Automated status messaging is the single biggest table-stakes gap and it is the
one every competitor has.

**Differentiators others have that we do not:** deposits taken at booking
(Bikebook only) **[V]**; live multi-supplier stock feeding job cards with
automatic special-order creation (Citrus-Lime, and claimed by bikeryOS)
**[V]**; two-way messaging on the job itself (Velodrop, Velobench) **[V]**.

**Genuinely unclaimed across the whole category** — tested, not assumed:

1. **Structured inspection to itemised estimate with per-line approval.** Every
   cycling tool that has "quotes" has a single ad hoc photo-and-price message.
   Bikebook's is the best of them and is still one item at a time **[V]**.
2. **A bike entity with a real schema** — spec, serial, purchase date, and a
   service timeline independent of which shop did the work.
3. **Technician efficiency and commission reporting** — absent from every
   cycling tool searched, mature in automotive **[V]**.
4. **Recall and safety-notice tracking by model and serial** — found nowhere
   **[NF]**. The industry has real recall events (e-bike batteries, brakes) and
   a persistent bike record is the natural place to hang them.

**The automotive pattern worth stealing.** Shopmonkey, Tekmetric and Mitchell 1
independently converged on the same workflow **[V]**: a technician runs a
reusable checklist on a tablet at intake, attaches photos and video per item,
items auto-populate a priced estimate, the customer gets a link by text or
email and approves or declines **individual line items**, and approved items
flow into the work order with no re-entry. Tekmetric publish a figure that shops
sending eight or more images with an inspection saw sales rise 17% **[V, their
own number, not independently audited]**.

That is the differentiator to build. It is proven in a more mature market, it is
absent from cycling, and it makes the shop money rather than saving it time —
which is the only argument that lands with a buyer who wants to work on bikes
and make money.

**Pricing anchors [V]:** Bikebook £49.99/mo ex VAT · Velodrop $59/$95/$129 ·
Bikedesk €99/€149 · bikeryOS €699/store/mo · Citrus-Lime £105/£339/£515 with the
workshop module included at every tier. Our wedge gives away what Bikebook
charges £49.99 for.

**Two corrections to the competitor set [V]:** Saledock / Celerant ONE has **no
native workshop module** — it integrates Bikebook. And i-BikeShop's "Workshop"
is a static marketing content page, confirmed from their own demo, not a
workshop tool at all; it should not appear in any competitive comparison.

## 3. Bike spec autofill

The goal — type "Trek Madone SLR 7, 2022, 56cm" and have the components appear —
is achievable for the marketing spec and **not** achievable for the facts a
mechanic actually needs.

**What is buyable.** 99spokes' live OpenAPI spec was read directly **[V]**: 39
named component slots, per-size geometry, gearing, suspension, motor and battery,
price history, and a model-year filter that explicitly covers discontinued
models — which matters, because servicing happens on old bikes. Access is by
API key on request with per-key restrictions on bikes and fields. **No pricing
is published, and there is no public statement on whether we may cache the data
or redisplay it to shops** **[NF]**. Those two terms decide everything, so they
are an email, not an assumption.

**What nobody sells.** Only bottom bracket is properly structured (standard,
shell width, threaded). Missing from every source checked, licensed or not
**[NF]**: rotor mount standard (6-bolt vs Center Lock), cassette range, seatpost
diameter, valve type, spoke lengths, torque figures, and any mapping from a bike
model to its consumable wear parts. Headset, chain and cassette come back as
free-text maker/model strings. Derailleur hanger identification is the sharpest
case — Wheels Manufacturing, DerailleurHanger.com and rear-derailleur-hanger.com
all exist and are well populated, and **none has an API** **[NF]**. It is a
human web-lookup problem across the whole industry.

**So the design inverts the gap.** Autofill the spec sheet from 99spokes where
terms allow, and treat the service-critical facts as **shop-verified fields,
captured once by the mechanic who has the bike on the stand, then reused
forever**. Every subsequent visit inherits them, and so does every other shop
the rider later shares the record with. This is the same conclusion two other
research passes reached from different directions — that provenance is only
trustworthy when it originates at the point of sale or service — and it makes
the missing data an asset instead of a blocker: the wear-parts mapping nobody
sells is something we accumulate from our own job history, and it compounds the
longer a shop uses us.

**Other sources.** Shimano publish free, year-versioned compatibility PDFs with
no login **[V]** — a good seed for our own compatibility rules; the facts are
ours to encode, the PDFs are not ours to redistribute. BIDEX BikeData is a free
German industry standard whose terms **explicitly bar "platforms without a
specialist trade reference," with a stated intent to litigate** **[V]**; whether
a UK EPOS vendor qualifies is unstated, coverage looks DACH-centric, and there is
no evidence Madison, ZyroFisher or Extra UK use it **[NF]**. Worth one email.
Trek, Specialized and Giant keep public historical spec archives, human-readable,
no API, terms unverified **[V/NF]** — not a scraping green light.

## 4. Build order

### Phase W0 — make what we have real

Nothing new ships until this is done. It is small and it is all repair.

1. Lift the portal's server-side rules into the staff routes: overlap, opening
   hours, working days, and rejecting edits to a completed job. The logic exists
   at `server/server.js:3238-3261`; it needs to apply to
   `POST`/`PUT /api/workshop-jobs`.
2. Workshop test coverage, written first and mutation-tested per the project
   standard. Jobs, diary rules, availability, portal booking, attachments.
3. Three data exposures found in the code review **[V]**: the portal's
   `/bookings` returns `orderId`, `orderStatus` and `orderTotal` to the customer;
   the single `notes` field is sent to the customer with no internal/visible
   split; guest booking matches an existing customer by **unverified phone
   number alone**, so a booking can land in a stranger's history.

### Phase W1 — table stakes

4. **Email.** There is no email capability of any kind. This blocks
   notifications, approval links and password reset. It is the first new
   dependency the project takes on.
5. **Automated status-triggered messaging**, SMS and email, with per-shop
   templates. `customer_messages` already carries `direction` and `provider_sid`
   "ahead of need" for exactly this **[V, migration 008]**.
6. **Job status history** — who changed what, when. Needed for notifications,
   and required for the attribution the legal position depends on (§5).
7. **Internal vs customer-visible notes.**
8. **Customer-level service history**, not only per-bike.
9. **Booking cancel and reschedule by the customer; reject with a reason by the
   shop.** Neither exists; there is no rejected or cancelled status.

### Phase W2 — the differentiator

The structured inspection workflow, built to the automotive pattern.

10. Reusable checklist templates per shop.
11. Photos per inspection item, captured on a phone.
12. An itemised estimate generated from flagged items, each line individually
    approvable or declinable by the customer via a link.
13. Approved lines flow into the job's existing linked order with no re-entry.

**Known blocker:** we have no labour concept. `sale_document_items` requires a
real `product_id` **[V, code]**, so labour can only be faked as a product row.
Labour lines with a time and a rate are a prerequisite for this phase, not a
nice-to-have.

### Phase W3 — the bike record

14. Extend `customer_bikes`: year, frame size, wheel size, groupset, e-bike
    system, purchase date, photo. Index `serial_number`; it currently has no
    index and no uniqueness constraint, so lookup is a full scan **[V, code]**.
15. Spec autofill from 99spokes, subject to terms.
16. **Shop-verified service facts** captured once — hanger, bottom bracket
    standard, rotor mount, chain speed, tyre and valve size. This is the part no
    data source sells.
17. Wear-parts mapping accumulated from our own job history.
18. Recall and safety-notice tracking by model and serial — unclaimed by anyone.

### Deliberately deferred

Deposits at booking, two-way messaging threads, technician efficiency and
commission reporting, workshop display screens, multi-supplier live stock on job
cards. All real, none of them the wedge.

## 5. Legal constraints — data-model rules, not a policy page

From the multi-jurisdiction privacy research (UK, EU/Ireland, US, Canada,
Australia, New Zealand). No irreconcilable conflicts were found: the regimes
differ in strictness, not direction, so one design satisfies all of them.

| # | Rule | Source |
|---|---|---|
| 1 | Shop-authored entries are **append-only and attributed**. A rider never edits or deletes a mechanic's entry | ICO rectification guidance **[V]** — an opinion that is clearly labelled as an opinion, with its author named, is very hard to call inaccurate. This is what makes the record defensible |
| 2 | Riders get a **dispute flag with a right of reply** and restriction while under review — never silent deletion | ICO Art 16/18 practice **[V]** |
| 3 | A direct rider account makes us a **controller**, not a processor. Own notice, own lawful basis, own rights handling | ICO controller test **[V]** |
| 4 | Shop-written records into a rider-owned garage are probably **joint controllership**, needing a documented Article 26 arrangement whose essence is shown to riders | **[V/U]** — the highest-value legal opinion to buy first |
| 5 | Sharing to a shop we have no contract with must be **rider-initiated, time-limited, read-only, scoped, logged and revocable**, with a standard notice shown at the point of access. No standing bulk push | ICO Data Sharing Code **[V]** — ad hoc sharing is permitted without a bilateral agreement |
| 6 | **Receiving a shared record must not create a marketing channel.** Soft opt-in requires an actual sale relationship | PECR **[V]** |
| 7 | All marketing SMS and email is **opt-in**, honoured within 10 business days globally. **No marketing SMS to a US number without a TCPA-compliant consent flow** — liability attaches to the message, not to our footprint | Build-to-strictest across PECR, CASL, TCPA **[V/R]** |
| 8 | Retention splits: the rider-facing view can close on request; the originating shop's own copy survives for legal-claims and tax retention | Art 17 exemptions **[V]** |
| 9 | Strip EXIF GPS server-side on every upload | **[V]** — riders photograph bikes at home |
| 10 | Age-appropriate defaults; block under-13 self-registration. The Children's Code catches any service *likely to be accessed* by children | **[V/R]** |
| 11 | Never describe the record as an ownership or title register unless it actually checks a stolen-bike database. It proves association, not ownership | consumer-protection reasoning **[U]** — solicitor question |

A DPIA is likely required. Eight questions were flagged as needing a solicitor
rather than more research; the joint-controller call (#4) is the one to pay for
first, because it drives the contracts, the ROPA and both privacy notices.

## 6. Calls to make

- **99spokes** (`data@99spokes.com`) — pricing, whether we may cache in our own
  database, whether we may redisplay to shops and their customers, UK model-year
  coverage depth, and what happens to cached data if we stop paying.
- **BIDEX** — does a UK EPOS vendor selling to bricks-and-mortar shops qualify as
  a permitted service provider, and is UK-market coverage real?
- **Bike Index** — their terms require express written permission for commercial
  integration, and there is no self-serve route for a third POS vendor. One
  email. Treat as opportunistic, not load-bearing: six staff, ~$150-195k/yr
  revenue, and a marginal UK presence next to BikeRegister **[V]**.
- **A solicitor** — the joint-controller question first.

## 7. Open

1. Whether spec autofill ships at all depends on 99spokes' terms. The shop-verified
   fallback (§3) does not, and should be built either way.
2. Whether the inspection workflow is part of the free wedge or the first paid
   feature. It is the strongest thing in this spec and giving it away may be
   wrong.
3. Labour lines are a prerequisite for W2 and touch the till, not just the
   workshop. Scope that before starting W2.
