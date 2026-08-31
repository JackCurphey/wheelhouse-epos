# Business plan — how the work is structured

**Date:** 31 August 2026
**Status:** decided, except where marked OPEN
**Rests on:** `research/business/strategy.md` and `research/business/business-research.md`
(currently unmerged, PR #7 — merge them before relying on this document)

This is the shape of the work, not a feature list. It exists to stop the project
becoming two years of good software with no customers.

---

## 1. The buyer

An independent bike shop owner who wants to work on bikes and make money. They
do not care about technology, they will not learn a tool, and price is a top-three
factor in every decision they make.

Everything below follows from that sentence. When a choice is unclear, re-read it.

## 2. The premise, stated honestly

All research to date is desk research — Companies House filings, published
pricing, Trustpilot, Wayback. **Nobody has spoken to a bike shop.** The product
gap list in `business-research.md` §10.2 was produced by reading our own code.

The single largest risk is not engineering. It is that the wedge, the price and
the buyer are all unvalidated. The structure below is organised around retiring
that risk, with engineering sized to what discovery justifies.

Second constraint: one person plus agents. Agents can absorb unlimited
engineering; they cannot open a trade account, sit in a shop, or close a
customer. **Mark's calendar is the scarce resource and it goes to the commercial
track.**

## 3. Price

The research anchors on Citrus-Lime Growth at £339/mo. That is the wrong anchor
for this buyer — Growth's premium is ecommerce, which this buyer does not want.
The real alternative set:

| Alternative | Cost ex VAT | What it lacks |
|---|---|---|
| Square / Shopify POS | £0/mo + card fees | Workshop, purchase orders, supplier data |
| Spreadsheets and a cash tin | £0 | Everything |
| Citrus-Lime **Essentials** | £105/mo | Ecommerce (not wanted) |
| Bikebook workshop bolt-on | £49.99/mo | It is a bolt-on, not a till |

**Decision: one flat price in the £49–79/mo band, quoted inc. VAT, one tier.**
No per-supplier licences, no card-rate coupling, no quote-only pricing, no
per-till surcharge. "One price, everything in" is itself the pitch, and the
incumbent structurally cannot match it — their tiers and SIM licences exist for
a reason.

Final number is set at G3, after the support-cost model in §9 and after ten shop
conversations. OPEN until then.

**Consequence, stated plainly:** 1,675 UK independents × ~£800/yr is a £1.3M
ceiling at 100% share. This is a good small business, not a venture outcome.
Multi-territory or a second vertical is the only route past that, and neither is
in this plan.

**Price is the wedge, not the moat.** Citrus-Lime recapitalised in November 2025
and can cut Essentials to £49 for a year to kill us. What retains a shop is that
switching back costs them a week of pain and that we answer the phone.

## 4. The free wedge — workshop, given away

The problem this solves: a shop will not rip out a working till to try an
unproven vendor. So do not ask them to. Give them something that runs *alongside*
the system they already pay for, needs no integration with it, and is
independently worth having.

**Free, forever, standalone: the workshop diary and the customer booking portal.**

Why this and not something else:

- **It is the strongest thing we have.** Drag-to-place week and month diary with
  per-mechanic columns, configurable capacity, job attachments, a moderated
  pending-approval booking queue, guest booking by phone, real SMS. None of the
  three workshop competitors describes a diary of that depth, and none has the
  moderated queue.

  **Corrected 31 Aug 2026 (same day):** an earlier version of this line, and the
  business research it came from, said "server-enforced hours and overlap." That
  is true only on the customer booking path. For staff-created and staff-moved
  jobs, overlap prevention, opening-hours clamping, working-day blocking and the
  complete-job lock live in `public/app.js` and nowhere else — any authenticated
  request can double-book a mechanic or book a closed Sunday. The rules exist
  server-side at `server/server.js:3238-3261` and were never lifted into the
  staff routes. Fixing that is Phase W0 of
  `docs/superpowers/specs/2026-08-31-workshop-first-build.md`. Do not quote the
  diary's server-side enforcement as a strength until that lands.
- **It does not collide with the incumbent.** Workshop booking in most shops is a
  paper diary or a wall calendar, not a POS module. Nothing has to be
  disconnected, migrated or cancelled to start using it. The shop takes zero risk.
- **It needs no integration we do not have.** This is what makes it work now:
  we hold no Lightspeed or Ascend integration and building one is a project. A
  free non-integrated tool sidesteps that entirely.
- **Free beats the paid competition outright.** Bikebook charges £49.99/mo for
  roughly this shape of product. We are not competing with them on features.
- **It accrues exactly the data that makes the flip inevitable.** Customers, bikes,
  service history, mechanic capacity — the shop's most valuable and least
  portable records end up with us, put there by the shop itself, one job at a
  time. When the till conversation happens, the workshop is already ours and the
  workshop is the profit centre.

**On the visible friction:** parts used on a job still have to be rung up on the
incumbent till, so the counter types them twice. Do not fight this and do not
paper over it. It is the argument that closes the flip — the only reason you are
typing it twice is that the till is not ours yet.

**Note this reverses an earlier recommendation.** Two turns of analysis argued
against "workshop bolt-on" as the go-to-market. That objection was to selling a
£49.99/mo bolt-on that needs POS integrations we lack, into a market with three
incumbents. As a *free, non-integrated land grab funded by a paid till we sell
later*, the objection does not apply: no integration is required, and free
outflanks all three. The wedge is free workshop; the business is the paid till.

**Risk, acknowledged:** we are giving away our best asset, and free tiers are
hard to un-free. Accepted, because the paid value of the workshop is
unrealisable for months regardless — we cannot sell a till until §8 Track B2 is
done — so spending it on distribution costs us little we could otherwise bank.
Design partners are grandfathered free forever, in writing.

**What the wedge needs built (Track B1):** hosted multi-tenant signup with no
installation; a workshop-only mode where a job can be completed without a linked
till sale (today a job auto-creates an order billable at the till, and in wedge
mode there is no till); automated status-triggered SMS; job photos from a phone;
service reminders. The last three are also the clearest gaps against Bikebook and
Velodrop, so the wedge and the competitive floor are the same work.

## 5. The rider-owned bike record — recorded direction, not yet built

The rider, not the shop, owns a record of their bikes: make, model, year, frame
number, component spec, purchase date, receipts, photos, and the service history
accumulated across every shop that has ever touched the bike. The rider can share
it with any shop — including a shop that is not our customer and has never heard
of us.

Why this is strategically interesting, in order of strength:

1. **It makes the platform sticky on a second side.** Today the only thing
   holding anyone is the shop's own data. A rider with three years of service
   history in one place has a reason to steer their next shop — and their next
   bike purchase — to somewhere that reads it.
2. **It is an acquisition channel that runs backwards up the funnel.** A rider
   hands a spec to a shop that has never heard of us. That shop meets the product
   as a useful thing a customer gave them, not as a sales call. In a market where
   cold outreach to independents is hard and the buyer distrusts vendors, an
   introduction made by their own customer is the cheapest one available.
3. **It extends the surface we already have.** The customer booking portal exists,
   leaks nothing between shops, and already supports guest booking by phone. This
   is the next step on the same surface, not a new product line.
4. **It inverts the GDPR finding, correctly this time.** The research established
   that Article 20 portability does *not* apply to a shop — a shop is a controller,
   not a data subject, and pitching otherwise is legally wrong. It *does* apply to
   a rider. "Your bike's record is yours and you can take it anywhere" is accurate
   when said to the rider, which means the anti-lock-in story finally gets told to
   the person who actually holds the right.
5. **No evidence anyone owns this category.** Marked **[U]** — we have not looked.
   Do not treat it as white space until someone has searched properly.

**Plausible but unvalidated extensions [U]:** frame number as proof of ownership
against theft, second-hand handover of a bike's history at resale, insurance
evidence. UK bike theft is a real problem; whether any of this is a *buying*
reason has not been researched. Do not build toward these on intuition.

### What has to be true, and what could sink it

- **Cold start.** The record is worth roughly nothing with one shop and no riders,
  and its value rises with coverage. It must ride on the free workshop's installed
  base, not lead it. Sequencing it before the wedge would be building a network
  with no nodes.
- **It is a consumer product.** Different discipline, different support surface,
  different expectations, and the rider is not the one paying. It competes for the
  same scarce calendar time as Track A, which is the resource that actually
  constrains this business.
- **The data-controller question is a design constraint, not a footnote.** If the
  rider owns the record and shops read and write to it, decide before any code:
  who is controller and who is processor for which fields, the lawful basis for a
  shop reading a record it did not create, and what happens when a shop and a
  rider disagree about what is in it. Get this wrong and it is not fixable later.
- **It must not breach the §7 simple gate.** For the shop, this has to be
  invisible until a rider hands them something.

### Decision

Recorded as a direction. **Not unfrozen, and not scheduled.** It is the leading
candidate for the G3 unlock, ahead of everything currently in Track D.

Validation is free and starts now: it is added to the Track A conversations in
§8. Technical design may be specced ahead of the gate — a spec costs a session
and sharpens the questions — but no build starts before G3.

## 5a. Decided: the workshop module is built first

**Decided 31 August 2026.** The workshop is the first thing we build, ahead of
the paid till floor in §8 Track B2 and ahead of the §5 bike record. This is
consistent with the wedge in §4 rather than a change to it — it makes Track B1
the active track and B2 the one built alongside it.

The build order, the feature-by-feature comparison against the field, the bike
spec autofill design, and the legal constraints as data-model rules all live in
`docs/superpowers/specs/2026-08-31-workshop-first-build.md`. Three things from
that spec belong here because they change the business case, not just the code:

1. **Automated status messaging is the one table-stakes feature we lack**, and
   every competitor has it. We have no email capability of any kind — not even
   password reset. That is the first new dependency the project takes on.
2. **The differentiator is the structured inspection workflow** — a checklist at
   intake, photos per item, an itemised estimate, and per-line customer approval.
   Proven in automotive (Shopmonkey, Tekmetric, Mitchell 1 all converged on it),
   absent from every cycling tool, where the best available is a single ad hoc
   photo-and-price message. It makes the shop money rather than saving it time,
   which is the only argument that lands with this buyer.
3. **Two competitor corrections.** Saledock / Celerant ONE — the ACT's endorsed
   UK partner — has no native workshop module and integrates Bikebook instead.
   And i-BikeShop's "Workshop" is a static marketing page, not a tool; it should
   not appear in any competitive comparison. A new vendor also surfaced,
   **bikeryOS** (€699/store/month), claiming both spec autofill and a full
   bike-as-asset record — but it was not live in production at the time of
   research and has no independent trace. Study it; do not treat it as validated.

## 6. Deletions — things this buyer removes from the roadmap

Recorded so they do not quietly creep back:

- **BYO Shopify custom-app tokens.** Since 1 Jan 2026 that flow runs through
  Shopify's Dev Dashboard or CLI. This buyer will never complete it. Either we
  perform it as a setup service or the storefront leaves the near-term plan.
- **Self-hosting.** No Docker, no `npm start`, no port numbers. Hosted by us, one
  URL, one login. The current README describes a thing this buyer cannot do.
- **Custom domains and DNS.** Frozen.
- **Hardware choice.** One tested bundle with part numbers and a total price.
  "Works with any ESC/POS printer" is a technology answer to a non-technology buyer.
- **Self-service migration.** They will not do it. CSV export stays on the floor
  list as anti-lock-in credibility, but inbound migration is a service we perform,
  free, as the closing lever. Nobody in the market solves getting data out; that
  finding becomes a service, not a slogan.

## 7. Simple is a gate, not an adjective

> A shop owner who has never seen the system completes a cash sale, adds a
> product, and books a workshop job — unaided, no training, no manual.
> **Watched, not self-reported.**

Any feature that cannot survive that test does not ship to this buyer, however
many competitors have it. This is also the honest filter on the floor list: a
permissions model and VAT-as-stored-data survive it; a reporting suite mostly
does not.

## 8. Four tracks

**Track A — Commercial. Mark only. Starts now, never pauses.**
Long lead times, so it runs ahead of the product rather than after it.
1. Open the Madison trade account. The credit review is the slow part and it
   gates the entire distributor story later.
2. Ten UK shop conversations. Not demos — thirty minutes on what they run, what
   it costs, what they would never give up, what would make them switch. Target
   the displaceable base: Seanic and i-BikeShop customers, plus shops on Square,
   Shopify POS and spreadsheets.
3. Get one Citrus-Lime shop to disclose their real all-in bill including SIM
   licences. Published nowhere; it is the pricing anchor.
4. Obtain one vendor DPA and read the end-of-contract clause. Load-bearing for
   the migration pitch and nobody has read one.
5. One thirty-minute call with TrueCommerce. One call, not a strategy — the
   research already downgraded it.
6. Run the §7 usability test on every design partner, in their shop.
7. Validate the §5 rider-owned bike record inside the same ten conversations, at
   no extra cost: would you look at a service history a customer brought in from
   another shop? Would you trust it? Would you add to it? And through the design
   partners, ask riders: do you know your bike's spec, and where is it written
   down today?

**Track B1 — The free wedge. Agents. Scope in §4.**
The only engineering that matters before G2.

**Track B2 — The paid till floor. Agents. Closed list.**
Exactly the `business-research.md` §10.2 blockers and nothing else: refunds,
voids and returns; cash-up and Z-report; CSV export of everything; VAT as stored
data; permissions model; date-range reporting.

Built *during* the wedge period, informed by shops already using the workshop.
This is the reordering that matters: the floor list is what makes us a till, and
none of it is needed to get shops onto the wedge. Building it first would mean
building it blind.

Every feature idea arriving before G2 goes in a parked file, not a branch.

**Track C — Foundation. Agents. Background, continuous.**
Architecture stage one as already planned: transaction-local `set_config`,
advisory lock on migrations, fetch timeouts, SIGTERM drain, `/healthz`. Then
managed Postgres with PITR and one *rehearsed* restore — a human owns that one.
Not optional. The first time a shop's day is lost, the business ends.

**Track D — Frozen.**
Storefront and Duda, DNS, distributor feeds, Shopify App Store listing, offline
mode, multi-site, product variants. All defensible, all unbounded. Frozen behind
G3. Track A may reorder this list; nothing else may unfreeze it.

## 9. Support economics — model before publishing a price

Price-sensitive plus non-technical equals phone support. At £59/mo, one support
call a month per shop is most of the margin. This is not a reason to avoid the
segment — it is the reason done-for-you onboarding and prescribed hardware are
economics rather than generosity. Build the model before G3.

## 10. Gates

| Gate | Condition | Unlocks |
|---|---|---|
| **G1** | PR #7 merged; Track C stage one green in CI; wedge scope written | Track B1 starts |
| **G2** | **3 shops running the free workshop on real jobs for 30 days** | Anything beyond the closed B2 list |
| **G3** | 3 shops paying at a published price | One Track D item, chosen by what those 3 shops asked for |
| **G4** | 10 paying, under 5% monthly churn sustained 3 months | Spending real money: hires, paid tooling, App Store project |

G2 does the work. It is the gate that stops this becoming excellent software
with no customers. Note it is stated in *usage*, not signatures — a shop that
signed up and never booked a job is not a data point.

**Dates: OPEN.** Gate spacing needs Mark's weekly time budget, which is not yet
decided. Track A is roughly 20–25 hours of Mark's own time to complete; the rest
is agent-executable. Fill the dates in when the budget is set.

## 11. Kill criteria

Written now, while it is still cheap to be honest.

- Ten shop conversations produce **zero** free-workshop installs → the wedge is
  wrong. Change the wedge; do not build more.
- Three shops run the free workshop for 30 days and **none** converts to paid →
  the price or the till floor is wrong. Re-test both before building further.
- Twelve months from G2 with fewer than ten paying shops → the segment does not
  support the effort. Stop, or change territory.

## 12. Hygiene blocking the above

- **Merge PR #7.** The research this plan rests on sits on an unmerged branch.
  Same for PR #6.
- **Nine commits exist on no remote ref**, across `design/audit-remediation-plan`
  and `design/workos-auth-migration`. Push them.
- `.agents/` is gitignored volatile scratch and one copy has already been
  destroyed. This plan, the gates and the kill criteria live here in `docs/`.
- `master` → `main` still needs the repo owner. Blocking nothing, but it
  retargets open PRs cleanly if done before the branch count grows.

## 13. Open

1. **Weekly time budget** — needed for gate dates.
2. **Final price** — set at G3. Note the workshop anchor: Bikebook charges
   £49.99/mo ex VAT for roughly what we intend to give away.
3. **Whether the free workshop stays free publicly after G4**, or becomes
   free-with-limits. Design partners are grandfathered regardless.
4. **Rider-owned or shop-owned-with-rider-access** for the §5 bike record. These
   produce materially different products, different data-protection positions and
   different network effects. Decide before the technical spec hardens.
