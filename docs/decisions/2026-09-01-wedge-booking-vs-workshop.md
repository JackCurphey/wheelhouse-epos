# The wedge — online booking, not the workshop module

**Date:** 1 September 2026
**Status:** PROPOSED. Needs Jack's sign-off before it changes any plan.
**Question raised by:** Jack — *"would it make more sense for the wedge to be
the online booking system rather than the workshop module, given Citrus-Lime
and Lightspeed already have (bad) workshop modules built in?"*

**Affects:** `docs/superpowers/plans/2026-08-31-master-implementation-plan.md`
§1 and the P3/P5 ordering. It does not touch P0.

Confidence tags: **[V]** verified · **[R]** reported · **[U]** unverified ·
**[NF]** searched, not found. Sources are `research/business/strategy.md` and
`research/business/business-research.md` unless stated.

---

## 1. What is already decided, and what is not

The master implementation plan §1 already says we lead with **"the workshop
module, given away free, running alongside whatever till the shop already
has"**, and `PF-2` exists specifically *"because a wedge shop has no till of
ours"*. So the **shape** of the wedge is settled: a standalone product that
does not require ripping out the incumbent till.

What is not settled — and what `business-research.md` §11 lists as an open
decision, *"Full EPOS vs workshop-first go-to-market"* — is **which half of
that free workshop leads**: the internal diary, or the customer-facing booking
and messaging layer.

This decision answers that — and §5 records Jack narrowing it further, from
the whole workshop module down to the booking system alone.

## 2. The premise checks out

Every serious competitor already ships a workshop module. From
`business-research.md` §2.4, all **[V]** unless marked:

| Vendor | Workshop |
|---|---|
| Citrus-Lime | Yes — included in the £105/mo Essentials tier |
| Saledock / Celerant ONE | Yes |
| Seanic Retail | Yes, plus rentals |
| Lightspeed | Service orders |
| Ascend | Yes |
| Bikedesk | Metered tickets |
| RetailEdge | Yes |
| i-BikeShop | **No** |

"A better workshop module" is not white space. Only one vendor in the field
lacks one, and it is a one-person operation. A shop already paying £339/mo for
Citrus-Lime Growth will not run two diaries, so a diary-led pitch asks for a
replacement of something they already own and already paid for — the
highest-friction sale available to us.

## 3. But booking is not a separate module from workshop

Online booking cannot be built without the diary underneath it — capacity,
mechanic availability, opening hours, job creation. We already have both
(`business-research.md` §10.1: drag-to-place week and month diary with
per-mechanic columns, and a customer booking portal with a moderated
pending-approval queue).

So this is not a build decision. **It is a decision about which half defines
the buying trigger, the pitch, and the feature ordering.** Nothing gets
deleted; something gets promoted.

## 4. Decision

**Lead with online booking and customer messaging. The diary ships underneath
it and is not the pitch.**

### Why

1. **It is additive, not replacive.** A shop can put a booking link on its
   website on Monday without touching its till. That is the lowest switching
   cost we can offer, and switching cost is the market's #2 documented
   complaint — fear of a bad migration, sourced to a shop staying on a
   disliked system rather than risk *"losing information we have gathered over
   our 15-year history"* **[V]**.

2. **It is a revenue story, not a cost story.** "Take bookings at 9pm, stop
   answering the phone, fill the diary" sells to a buyer who, per master plan
   §1, *"wants to work on bikes and make money and does not care about
   technology."* "Our job cards are nicer" does not.

3. **Land-and-expand runs the right direction.** Bookings → diary → job
   billing → till. The reverse does not work: you cannot sell a second diary
   to a shop that has one.

4. **The bolt-on companies prove the gap is the customer-facing half.**
   Velodrop (Wayback to Jan 2018), Masterlinq (Oct 2023) and Bikebook Workshop
   (Apr 2024) all built businesses bolting onto Lightspeed and Ascend
   *despite* those incumbents having workshop modules **[V]**. What they
   actually sell is booking, status SMS and reminders — Velodrop's three tiers
   *differ only by bundled SMS credits* **[V]**. Masterlinq markets explicitly
   against *"manual phone bookings"* **[V]**. The incumbents' workshop modules
   are not the thing being displaced; the phone is.

5. **It re-reads our own gap list as the roadmap.** `business-research.md`
   §10.3 lists where we are behind: automated status-triggered SMS and email,
   job photos from a phone, service reminders. Every one of those is the
   customer-facing half. Under a diary-led pitch they are parity
   nice-to-haves; under a booking-led pitch they are the product.

### Price anchor

Bikebook Workshop, the closest UK comparable, is **£49.99/month ex VAT** **[V]**
and is a booking-and-messaging product. That sits inside the £49–79/month band
the master plan already targets, which is a consistency check passing, not a
coincidence — but note the free workshop is the wedge and £49–79 is the *paid
full system*, so we are giving away something Bikebook charges £49.99 for.
That is deliberate and it is the whole argument for the wedge.

## 5. The wedge is the booking system, not the workshop module

Narrowed by Jack, 1 September 2026: *"change the wedge to be the bolt on
booking system rather than the whole workshop... it would be hard to convince
people to rip and replace their existing workshop."*

Accepted. §2 supports it — every competitor but i-BikeShop already ships a
workshop module, so the free workshop as originally scoped still asked a shop
to displace something it owns.

**What this does not change.** A booking system needs a diary underneath it to
know which slots are free: mechanics, opening hours, capacity, overlap. That
machinery ships either way. What narrows is what the *shop* is asked to adopt,
not what gets built — most of it already exists and is tested.

### The open sub-decision: who re-types the booking?

This is the question that decides whether a booking-only bolt-on survives
contact with a real shop. If bookings arrive in our system and jobs are
managed in Citrus-Lime, someone keys every booking twice. Shops tolerate that
for about a week. Three ways out:

**Option A — write back into the incumbent POS.** A booking appears as a job
in their Citrus-Lime or Lightspeed diary automatically. No double keying, and
it is what Bikebook and Velodrop do. The cost is a dependency on the
incumbent's API: Citrus-Lime's key is *"gated behind a support call"* **[V]**,
and since 20 November 2025 they are BGF-backed with money earmarked for
technology development **[V]** — every incentive to close that door on a
competitor. Survivable, not a moat, and the whole wedge stops working the day
they revoke access.

**Option B — accept the double keying, make it cheap.** The booking arrives
with everything the shop needs; they copy it into their own system once. Zero
dependency, honest, and strictly worse than what two competitors already
offer. Viable only if the copy genuinely takes seconds.

**Option C — coexistence. Online bookings become jobs *here*; everything else
stays where it is.** The shop keeps Citrus-Lime for till, stock and the jobs
they take by phone. Jobs that arrive through our booking link are worked in
our system, through to the job-done email. No rip-and-replace, no double
keying, no API dependency. Over time the online share grows and their old
module withers on its own, without anyone having to decide to abandon it.

**Recommended: Option C.** It is the only one of the three that is neither
dependent on a competitor's goodwill nor visibly worse than what a shop can
already buy.

It does mean a shop briefly runs two diaries, which §3's reasoning warned
against — that warning was about asking a shop to *replace* its diary
wholesale, and this is not that. The split has an obvious rule the shop can
state in one sentence: online bookings live here, phone bookings live there.
That is a different proposition from "abandon what you have", and it is the
reason the objection does not carry over.

`PF-2` (workshop-only mode — a job completes without a linked till sale)
is exactly the machinery Option C needs, and it is already in the plan.

## 6. What changes if this is signed off

Nothing in P0. The changes are in ordering and wording:

| Task | Change |
|---|---|
| `WS-2` automated status messaging | Promoted to the first product task after P0. It is the wedge's core feature, not a table stake |
| `WS-5` customer cancel/reschedule | Promoted with it — same surface, same pitch |
| `CX-2` job photos from a phone | Rises in priority; Bikebook sells this **[V]** |
| Service reminders | **Not currently a task anywhere.** Velodrop has them **[V]** and they are a revenue lever for the shop, not just parity. Needs adding |
| `WEB-1` public website | Copy leads with booking and customer messaging, not the diary |
| `PF-2` workshop-only mode | Promoted into the wedge itself. Under Option C it is not a convenience, it is the thing that lets a shop run our jobs without our till |
| Master plan §1 | Reword "we lead with the **workshop module**, given away free" → we lead with the **booking system**, given away free, running alongside whatever till and whatever workshop module the shop already has. The diary ships underneath it and is not the pitch |
| Scope of the free tier | Narrows. Not "the workshop", but: the booking link, the slots behind it, the jobs those bookings become, and the messages that keep the customer informed |

## 6b. Follow-up — reconnecting guest bookings to accounts

Agreed by Jack, 1 September 2026. Raised while fixing DS-7, which removed
the phone-number match that used to link a guest booking to an existing
customer. That match was a real convenience and losing it costs something:
a regular who books as a guest three times becomes three customer records.

**Rejected first idea.** The obvious replacement — telling the guest form
"there is already an account with that number, please sign in" — leaks the
shop's customer list. Anyone could type numbers into a public page and learn
which ones belong to real customers. It is the same reason a login page says
"invalid email or password" rather than "no such email": the specific message
helps the honest user and helps a stranger fishing just as much.

**Two changes that get the same result without the leak:**

| | What it is | Why it is safe |
|---|---|---|
| **The unconditional nudge** | The guest booking form always shows "Got an account? Sign in to keep all your bookings together" — shown to everyone, regardless of what they typed | The message never varies, so it carries no information about who exists |
| **The staff merge queue** | The shop sees "this guest booking's phone matches Sam Regular — same person?" and merges, or does not | A person who knows their customers decides, instead of a stranger's typing |

Together these recover the deduplication DS-7 gave up. The nudge catches
people who already have an account; the merge queue cleans up everyone else.

Neither is scheduled yet. The nudge is small and belongs with `WEB-1`; the
merge queue is a new task with no ID, closest in spirit to `WS-4`
(customer-level service history), which has the same "one customer, many
records" shape.

**The rule to keep:** never let a public form confirm whether an account
exists. Any future version of this that varies its message based on what the
visitor typed reintroduces exactly what was rejected here.

## 7. What would falsify this

- If shops turn out to book overwhelmingly by phone and walk-in *by
  preference* rather than by constraint, the booking portal is a solution to a
  problem the buyer does not feel. Reddit was unreachable in every research
  pass **[NF]** and that hole is not yet filled; r/bikeshops and
  r/BikeMechanics still need a manual sweep.
- If Velodrop's and Bikebook's POS write-back is already deep and good, the
  "standalone island" position is weaker than assumed and Option 1 gets more
  attractive.

## 8. Do this before committing

`business-research.md` §11 already lists it and nobody has done it: **trial
accounts with Velodrop and Bikebook — both free, no card.** An afternoon in
both settles how deep their POS write-back goes, and whether
quotes/estimates and parts-attached-to-job are genuinely a category-wide gap
**[U]**. That is the difference between "we are a cheaper Bikebook" and "we do
the thing none of them do."

This decision does not block on that. The ordering changes in §6 are right
either way. The trial changes how loudly we claim differentiation.
