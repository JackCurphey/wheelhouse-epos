# System build spec — from local app to hosted product

**Date:** 31 August 2026
**Governs:** the whole system, with the workshop module built first.
**Rests on:** `docs/decisions/2026-08-31-business-plan.md` (buyer, price, gates,
design-partner programme) and
`docs/superpowers/specs/2026-08-31-workshop-first-build.md` (the workshop feature
plan, W0-W3). This document is the system around that feature — everything that
has to exist for a real bike shop to use it in a real shop.

Confidence tags: **[V]** verified · **[R]** reported · **[U]** unverified ·
**[NF]** searched, not found.

---

## 1. The gap this spec closes

We have a good application that assumes the wrong deployment model. The README
tells a shop owner to open a terminal and run `npm start` on port 4000 **[V]**.
The business plan deletes self-hosting outright — this buyer does not care about
technology and will never do that. So the work is not only "build the workshop
module"; it is "become a hosted product that a shop can sign up for and use
without ever meeting a terminal."

Second framing that matters more than a feature list: **the deliverable is a
shop using this on real jobs for thirty days.** That is Gate G2. Everything below
is scoped by whether it is required for that, required shortly after, or not
required at all yet.

## 2. Where we are today — verified

**Working and real.** Single Node process, one runtime dependency (`pg`).
Postgres multi-tenancy via row-level security, 25 tables FORCEd, cross-shop reads
return nothing and writes are rejected — verified live **[V]**. Till, inventory,
sales history, dashboard, workshop diary with per-mechanic columns, customer
booking portal, purchase orders including split deliveries, Shopify integration,
a storefront, and an Electron print agent for receipts and labels. CI runs on
every push; 89/89 green on the most recent run **[V]**.

**Scaffolded but unused.** Vite 8 + React 19 + TypeScript + Tailwind 4.3.3 with a
shadcn registry behind four enforcement gates, each mutation-tested. Merged as
PR #9. Nothing user-visible renders through it yet **[V]**.

**Queued, set up, not started.** Architecture stage one: transaction-local
`set_config`, an advisory lock around migrations, `AbortSignal.timeout()` on
outbound fetches, SIGTERM drain and crash guard, a `/healthz` that touches the
database. A seventh item — managed Postgres with point-in-time recovery and one
rehearsed restore — is deliberately excluded from that workflow because a human
owns it **[V]**.

**Absent, and load-bearing for a hosted product.**

| Missing | Consequence |
|---|---|
| Any email capability whatsoever — no provider, no password reset **[V]** | Blocks signup, notifications, approval links |
| Self-serve signup and shop provisioning | Every new shop is a manual database operation |
| Managed Postgres with PITR and a rehearsed restore | One bad day ends the business |
| Subscription billing | Not needed yet — see §5 |
| A public website | Nowhere to send an interested shop |
| A community space | Gate G2 depends on engaged design partners |
| Error tracking, uptime monitoring, status page | We would learn about outages from the shop |
| Workshop test coverage — zero files touch it **[V]** | We are about to lead with the untested part |
| Server-side enforcement on staff diary routes **[V]** | Rules live in the browser; see W0 |

**Stale and misleading.** The README still describes SQLite and `data/shops/`
**[V]**. Anything pointing at port 4000 is wrong; the app is reached through the
gateway on 8080.

## 3. The system — seven surfaces

### A. The product application

One URL, one login. A shop signs up, gets a shop record, and works. No install,
no port numbers, no configuration. The booking portal stays where it is, at
`/book/<shopSlug>`, because that is a customer-facing surface with its own
identity model **[V]**.

**The print agent is the one local component and it has to stay local** — it
talks to a receipt printer over USB. What changes is the install story: a signed
Windows installer and a one-page setup, not a developer's build. Treat it as a
product with a release channel, not a script.

### B. The public website

Its job is to convert an interested shop into a free-workshop signup, and to be
credible to someone deciding whether to trust an unknown vendor with their shop.

Pages: what it is · the free workshop · pricing (published, one number, inc VAT)
· who we are · help and docs · changelog · status · contact. Plus the legal set
in §7, which is not optional.

**Plain English throughout.** Spell out acronyms, no insider jargon. The buyer
does not know what EPOS stands for and should not have to.

Build it in the same repo with the same design tokens as the product, so the two
look like one thing. Static-first: it should be fast, and it should not be able
to take the product down.

### C. The community forum

**Decided:** a forum is in scope, alongside the WhatsApp group already decided in
business plan §5b. They do different jobs and neither replaces the other:

- **WhatsApp** is the conversation — instant, already on their phone, where voice
  notes and photos of a screen arrive. It stays the day-to-day channel.
- **The forum** is the durable, searchable, linkable record — decisions, "why we
  built it this way", how-to answers that should be found twice, and eventually
  shops answering each other. It is also a credibility surface: a visible,
  active space where a prospect can see other shops using the thing.

Private to design partners at first, public later if it earns it. **Email-in and
email-reply is a hard requirement** — these users live in email and WhatsApp, and
a forum they must remember to visit will be a forum nobody visits. Single sign-on
from the product account, so no shop owner ever creates a second password.

Platform choice is an open decision in §8; costs are being researched.

### D. Email

The first genuinely new dependency the project takes on. Transactional only at
this stage: signup and password reset, booking confirmations, job status updates,
inspection approval links, the monthly design-partner digest.

Two constraints already established. **Separate sending domains** — product email
and any future outreach must never share a reputation, and since we have no email
yet we get to set this up correctly before it matters. And **all marketing
messaging is opt-in**, honoured within ten business days globally, with no
marketing SMS to a US number without a compliant consent flow (business plan §6,
constraint 7).

### E. Billing

**Not built before Gate G3.** The free workshop needs no billing at all, and the
first three paying shops can be invoiced by hand or through payment links. Build
the subscription machinery when there is recurring revenue to justify it, not
before. The decision to make early is only whether the provider is a merchant of
record, because that changes who handles VAT.

### F. Platform and operations

Hosted in the UK or EU, with infrastructure providers acting as pure processors —
this is a constraint from our own privacy work, not a preference (business plan
§6, constraint 11), and it also lands us inside New Zealand's service-provider
carve-out if we ever go there.

Required before a real shop depends on us:

1. **Managed Postgres with point-in-time recovery, and one rehearsed restore.**
   Rehearsed means performed, timed, and written down — not "the provider says
   they have backups." No red is not green.
2. **Connection pooling chosen with the tenancy model in mind.** Our RLS context
   is set per request; session-scoped state leaks across tenants under
   transaction pooling. Architecture stage one closes this by making `set_config`
   transaction-local — that must land *before* a pooler, not after.
3. **Deploy and rollback**, with migrations behind the advisory lock.
4. **Error tracking, uptime monitoring, and a public status page.** Cloud outages
   disabling the till is a documented complaint in this market **[V]**, so
   visible, honest uptime is a commercial asset and not just hygiene.
5. **A staging environment** a design partner never sees.

### G. Compliance artifacts

See §7. These are deliverables with owners, not principles.

## 4. Architecture decisions

**Frontend: new surfaces in React, no big-bang rewrite.** The React scaffold
exists and nothing uses it. The workshop rebuild, the inspection workflow, the
website and the customer portal are built on it; the till and inventory stay in
vanilla JS until they earn a rewrite on their own merits. A rewrite of working,
revenue-carrying screens is not on the path to G2.

**Tenancy stays as it is.** Shop resolved at login, RLS enforced in Postgres,
`FORCE` on every shop-scoped table. It is the strongest thing in the codebase and
it is verified. The two exempt tables (`logins`, `customer_logins`) remain the
one place application code must remember shop scoping by hand — that is where the
last two leaks happened, so every write to them gets a test.

**Server is the authority, always.** The current diary proves the failure mode:
rules that exist only in `public/app.js` are not rules. Every constraint gets a
server-side test that a raw HTTP call cannot bypass.

**Data model rules from the privacy work are structural**, not policy-page text:
append-only attributed entries, dispute flag with right of reply rather than
deletion, retention split between the rider-facing view and the shop's own legal
copy, EXIF stripped server-side on every upload. Building these in later means
migrating live customer data; building them now costs almost nothing.

**Boring dependencies.** One runtime dependency today is a genuine asset. Each
new one — an email SDK, an error reporter — is a deliberate decision, not a
default.

## 5. Build order

Mapped to the gates in the business plan. Nothing here reorders them.

### Stage 1 — Foundations (before G1)

- Architecture stage one, via the existing workflow.
- Managed Postgres with PITR; **restore rehearsed and documented**.
- Deploy pipeline, staging, error tracking, uptime, status page.
- Email provider wired; password reset as the first real use.
- Workshop W0: lift the portal's server-side rules into the staff routes, write
  the first workshop tests, fix the three data exposures.
- README rewritten. It currently describes a product we do not sell.

### Stage 2 — Make it signup-able (before first design partner)

- Self-serve signup and shop provisioning.
- Workshop-only mode: a job that completes without a linked till sale, because
  a wedge shop has no till with us.
- Workshop W1: automated status messaging, job status history, internal versus
  customer-visible notes, customer-level service history, booking cancel,
  reschedule and reject.
- The website, live, with the legal set.
- The forum, private, with email-in.
- Print agent installer, if the first partners need receipts.

### Stage 3 — Earn G2

- Onboard three to eight design partners in person, locally.
- Workshop W2: the structured inspection workflow — checklist, photos per item,
  itemised estimate, per-line customer approval. **Labour lines are a
  prerequisite and they touch the till, so scope that first.**
- Instrument usage. G2 is thirty days of real jobs, not signatures.

### Stage 4 — Earn G3

- Workshop W3: the richer bike record, spec autofill if 99spokes' terms allow,
  shop-verified service facts, recall tracking.
- The paid till floor (business plan Track B2): refunds, voids and returns,
  cash-up and Z-report, CSV export, VAT as stored data, permissions, date-range
  reporting.
- Billing, and a published price.

### Not before G3

Storefront and Duda, custom domains and DNS, distributor feeds, a Shopify App
Store listing, offline mode, multi-site, product variants, and the rider-owned
bike record. All frozen in business plan §8 Track D. The bike record is the
leading candidate for the G3 unlock.

## 6. How it ships

**Test-first, and watch it fail.** Every gate we add gets broken on purpose,
watched to fail for the right reason, and restored — the standard already applied
to the four shadcn gates **[V]**. A test that still passes when you break the
code it covers is not a test.

**Definition of done for a stage:** the command that proves it has been run and
its output seen. Not "should work."

**One branch per change, CI green before merge, never to the default branch
directly.**

**Design-partner shops get a feature flag**, so half-finished work reaches
exactly the people who agreed to see half-finished work.

**A changelog written for a bike shop**, not release notes. Screenshots and one
sentence. It doubles as the "what changed" message in the design-partner rhythm.

## 7. Compliance deliverables

Each needs an owner and a date. Most are small; none are optional once a real
shop's real customers are in the system.

| Artifact | Why | When |
|---|---|---|
| Privacy notice for shops (we are processor) | Contractual baseline | Stage 2 |
| Privacy notice for riders (we are controller) | Direct rider accounts make us controller **[V]** | Before any rider account |
| Data processing agreement offered to shops | Article 28; also our own anti-lock-in pitch | Stage 2 |
| Cookie policy and consent, if we set any non-essential cookies | PECR | Stage 2 |
| Terms of service | — | Stage 2 |
| DPIA, or a documented screening decision | Likely required **[R]** | Before rider accounts |
| Records of processing (ROPA) | Separate entries for processor, controller, joint controller and sharing flows | Stage 2 |
| Legitimate Interests Assessment | Wherever we rely on LI | With the ROPA |
| Retention schedule | Rider-facing view versus shop's legal copy | Stage 2 |
| Article 26 joint-controller arrangement | Only once shops write into rider-owned records | Before the bike record |
| Solicitor review | The joint-controller question first | Before the bike record |

## 8. Decisions needed

1. **Hosting, managed Postgres, email provider, billing provider and forum
   software.** Costs and UK/EU regions are being researched; the recommendation
   will be a single stack with a monthly total and a cheaper defensible
   alternative.
2. **Domain name.** Needed for the website, the product, and the separate
   sending domain. Nothing here proceeds far without it.
3. **Is the inspection workflow free or paid?** It is the strongest thing in the
   workshop spec and giving it away may be wrong. Open in the workshop spec too.
4. **Forum public or private at launch.** Private is safer and less credible;
   public is the opposite.
5. **Weekly time budget** — still open in the business plan, and still the only
   thing blocking real dates on any of this.

## 9. Explicitly out of scope

Rewriting the till in React. Mobile apps. Offline mode. Multi-site. Anything in
Track D. A second vertical. Non-UK markets — though the privacy design is already
built to the strictest standard across six jurisdictions, so expansion is a
commercial decision rather than a rebuild.
