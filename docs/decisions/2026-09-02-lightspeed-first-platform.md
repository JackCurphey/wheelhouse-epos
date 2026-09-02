# First platform — Lightspeed, UK first, R-Series

**Date:** 2 September 2026
**Status:** DECIDED by Jack, 2 September 2026.
**Supersedes:** §5b of `2026-09-01-wedge-booking-vs-workshop.md`, which named
Citrus-Lime shops as the first market. Everything else in that document stands,
including §5's Option C reasoning, which is now the fallback rather than the plan.
**Affects:** `docs/superpowers/plans/2026-08-31-master-implementation-plan.md`
§1 and the P3/P5 ordering. It does not touch P0.

Confidence tags: **[V]** verified against a primary source · **[R]** third-party
reported · **[U]** unverified · **[NF]** searched, not found (not proof of absence).

---

## 1. The decision, in four parts

1. **Lightspeed is the first platform**, not Citrus-Lime.
2. **UK shops first**, with North America as a deliberate later phase — not a
   maybe, and not a pivot when the UK disappoints.
3. **R-Series is the integration target**, not X-Series.
4. **The free product is the booking system and the diary together**, as one
   thing, not one leading and the other underneath it.

Point 4 supersedes §4 of `2026-09-01-wedge-booking-vs-workshop.md`, which said
to lead with booking and that *"the diary ships underneath it and is not the
pitch."* Decided by Jack, 2 September 2026: *"both together, because both
together would definitely be an improvement on anything any of the competitors
make."*

**Why the earlier split no longer applies.** §4's argument for booking-led was
that a diary-led pitch asks a shop to replace something it already owns, and
§2 of that document showed every serious competitor ships a workshop module.
That is true of Citrus-Lime, and §3 below shows it is *not* true of Lightspeed:
what Lightspeed ships is a job record with a date on it, not a diary. So the
objection that forced the split is absent on this platform, and splitting the
product in two costs us the only thing that distinguishes it.

What is unchanged from 1 September: the free product runs alongside whatever
till the shop already has, with the paid full system at £49–79/month behind it.

**The claim this rests on is not yet evidenced.** "Both together beat anything
the competitors make" is the whole proposition, and nobody has looked at a
competitor's product. See §6. It is written here as the position taken, not as
a finding.

## 2. Why the earlier reasoning has to be corrected first

The decision was reached on the premise that Citrus-Lime blocks us from building
a diary for their shops. **That premise is wrong and should not be repeated.**

Citrus-Lime's API Usage Agreement bars building an *Application on their API*
that competes with them, and makes that permission revocable without notice
**[V]**. It says nothing about a standalone product sold to shops that happen to
run Citrus-Lime, because it cannot — a contract we never sign cannot bind us.
The 1 September decision already established exactly this: Option C, coexistence,
*"needs no key, no agreement and no permission from anyone."*

**The correct version of the argument, which does support this decision:**

Without API access, Citrus-Lime shops can be offered coexistence and nothing
else. Two diaries, a manual split, and no way to bring their history across.
That kills the migration story, and the migration story is the entire reason a
free diary is worth building — see §4. On Lightspeed the bridge exists. On
Citrus-Lime it does not.

So the choice is not "Citrus-Lime forbids us." It is **"Citrus-Lime gives us no
bridge, and Lightspeed does."**

## 3. What the platform research established

Desk research, 2 September 2026, against Lightspeed's own documentation and UK
trade sources. **No live API call was made**, so this is a documentation-level
read — the same standard as §5c of the 1 September decision, and the same caveat.

### Lightspeed has no workshop diary. It has a job record with a date on it.

This is the finding that makes a diary-led wedge coherent on this platform,
where §2 of the 1 September decision correctly ruled it out generally.

**R-Series** — the Service module produces work orders with a required customer,
a serialised item, `Date In` and `Due`, labour lines carrying hours and minutes,
parts that reserve inventory, employee assignment per line, up to 12 images,
deposits, and four default statuses (Open, Estimate, Waiting, Finished) plus
custom ones **[V]**. It is a genuinely capable *job record*.

What it is not is a diary:

- Two dates, **no times**. Nothing is scheduled to an hour **[V]**.
- **No capacity model.** Nothing knows how many bench hours exist, so nothing
  can prevent double-booking **[V]**.
- **No per-mechanic schedule view.** A person can be assigned; their day cannot
  be seen **[V]**.
- The only calendar is a **read-only iCal feed** where work orders appear as
  **all-day events** on their due date **[V]**.
- **No customer-facing booking.**

**X-Series** is thinner still: a service order captures a duration and a
completion date, seven statuses, an assigned user, a location string, notes —
and caps scheduling at **14 days in advance** **[V]**.

Lightspeed's own UK bike-shop page points shops at **HubTiger** for work order
management **[V]**. They have outsourced the gap rather than closed it. Good news
for the product thesis; it also means the gap is not a secret.

### R-Series is where the bike shops are, X-Series is where new signups go

No published split exists for which series UK bike shops run **[NF]**, and it may
not be findable without asking Lightspeed. The indirect evidence is consistent:

- All **13 integrated bicycle vendor feeds** — distributors and brands, offering
  catalogue sync, PO upload and stock levels — are **R-Series only** **[V]**. For
  a bike shop that ecosystem is the reason to be on Lightspeed, and losing it is
  why nobody migrates off R.
- *Bicycle Retailer*'s August 2025 shop panel names Lightspeed users specifically
  on R-Series, one arriving through the old Merchant OS **[V]**. Small panel, US,
  directional only.
- Lightspeed's own **Summer Offer 2026** promotion sells X-Series plans to new
  customers **[V]**.

R-Series also has by far the better API for this: `Workorder` with full CRUD,
`WorkorderLine`, `WorkorderItem`, `WorkorderStatus`, fields including `timeIn`,
`etaOut`, `employeeID`, `serializedID`, `workorderStatusID`, scope
`employee:workbench` **[V]**. X-Series' `POST /api/2.0/services` has no
documented scheduled-date or duration attribute in its create payload **[V]** —
it cannot represent a scheduled job, which is the thing we are building.

### Lightspeed's licence does not bar a competing product

Nothing in the API licence bars a competing product; the non-exclusivity clause
protects *Lightspeed's* right to compete, and the data clauses constrain what an
integrator does with data rather than who they are **[V]**. A registered OAuth
app connects to up to 30 stores while still unapproved **[V]** — a full pilot
without asking permission. This is the opposite of the Citrus-Lime position and
it is the substance of §2.

## 4. What the integration is for — read out, not write back

**This is the part that should govern the build.**

Every competitor bolted onto Lightspeed integrates in one direction: push a
booking in as a work order. They do that because they intend to live alongside
Lightspeed permanently. For a bolt-on, the integration *is* the product.

Our endgame is replacing the till. That inverts the direction. **Read
continuously out of Lightspeed from day one** — products, stock, customers, sale
history, work orders. The free diary performs a quiet migration the whole time
it is being useful.

Why this is the right call:

1. **It attacks the market's #2 documented pain directly.** `strategy.md` §5.2
   records lock-in and migration fear as STRONG **[V]**, sourced to a shop
   staying on a system it dislikes rather than risk *"losing information we have
   gathered over our 15-year history."* Under this model, on switching day the
   history is already here and has been for a year.
2. **It turns the switch into a settings change instead of a project**, which is
   the reason land-and-expand normally stalls at "land".
3. **No competitor on that list will copy it.** Their business dies with the
   migration; ours begins with it.

Write-back — creating a Lightspeed work order from one of our bookings — is a
convenience, and it mainly benefits Lightspeed. Available whenever it is worth
building. Not the point.

**The risk this creates, recorded deliberately.** Continuously copying a
retailer's entire dataset is a larger ask of a shop's trust than "we take your
bookings", and it must be their explicit, informed choice with a plain-English
explanation and a way to stop and delete. It is also the kind of thing a vendor's
terms can be revised to prohibit later, even though Lightspeed's current terms do
not. Neither is a reason not to do it. Both are reasons to do it openly.

## 5. UK first, then North America

**UK first, because that is where the domain knowledge is.** Decided by Jack:
*"that's what I have the knowledge on."* Knowing the trade — what a shop's week
looks like, what a mechanic actually needs at the bench, which objections are
real — is worth more at this stage than market size, and it does not travel.

Note this reason stands on its own and deliberately does not lean on the
design-partner programme. `2026-09-01-ownership-signoff.md` records `DP-1`
through `DP-4` — shop conversations, recruiting partners, in-shop usability
tests, the WhatsApp group — as *"dont think this is necessary."* Any argument
for UK-first built on recruiting design partners is arguing from a programme
that has been struck out.

**North America is planned, not hypothetical.** `strategy.md` §3 already reaches
the same conclusion from the numbers: the UK alone is a single-digit-millions
market, supporting *"a profitable small company, not a venture outcome"*, and
*"multi-territory or multi-vertical expansion is required for anything larger."*

**The cost of going UK-first on this platform, stated plainly.** Lightspeed's
bike vertical is North American. All 13 integrated vendors are US-facing — Quality
Bicycle Products, J&B Importers, Hawley, BTI, Seattle Bike Supply, Hans Johnsen,
Downeast, KHS, Sinclair, plus Specialized, Giant, Raleigh and Electra **[V]**.
Not one UK distributor: no Madison, no Extra UK, no Ison, no ZyroFisher. Three
of those names — Specialized, Giant, Raleigh — do trade in the UK, but the feeds
are their North American operations. The UK
trade press positions Lightspeed for *"tech savvy multi channel retailers"*
rather than typical independents, and notes it *"lacks cycling specific data
structures"* **[V, from push.bike, who sell a supplier-data module that fixes
exactly that gap — an interested source]**.

**So the UK Lightspeed population is the open question this decision rests on,
and it is unmeasured [NF].** No public source gives it. Citrus-Lime claims ~400
UK bike shops and *"around 80% of the cycle market"* **[R — their own marketing,
and the same source inflated its workshop network to "thousands of retailers"
when §3.7 of the research established ~143, so discount heavily]**. push.bike
reads the market differently again, treating Citrus-Lime and Abacus as legacy
installations with Bikedesk and Ascend taking modern adoption **[R]**.

The numbers are contested. The direction is not: most UK independents are not on
Lightspeed.

**This is accepted knowingly.** The UK Lightspeed population may be small enough
that it only ever supports design partners rather than a business — in which case
the US phase arrives sooner than planned, and the build does not change, because
the adapter is identical in both territories.

Do not let this sit as a silent assumption. It is the first item in §7.

## 6. Who else is already here

Unlike Citrus-Lime, Lightspeed's workshop gap is not unoccupied. Known: Velodrop
(supports both R-Series and X-Series **[V]**), Workshop by Bikebook (£49.99/month
ex VAT, integrates with both series **[R]**), velobench, Trail Hits Hub, HubTiger,
and Masterlinq. Plus general appointment tools Lightspeed lists as partners —
Booxi and Resurva **[V]**.

We are not entering white space. We are entering a crowded bolt-on market with a
different endgame, and §4 is the whole of the differentiation. "Free" and "better"
are worth little on their own here; "free, better, and it becomes your till" is
the position.

**The claim that is not yet evidenced, and it is now the whole proposition.**
§1.4 commits to booking and diary together *because together they beat anything
the competitors make*. Nobody has looked at a competitor's product. §8 of the
1 September decision flagged this on 31 August and it is still not done —
**trial accounts with Velodrop and Bikebook, both free, no card**.

This is the only one of our three claims a shop can check in ten minutes, so it
is the one that has to be true, and it cannot be settled from documentation.
Until those trials are run, treat "better than theirs" as an assumption the
plan rests on rather than a fact it stands on. If it turns out to be wrong, §1.4
is the part that has to change, not the platform choice.

## 7. Open items

1. **How many UK bike shops actually run Lightspeed?** **[NF]** Unmeasured, and
   this decision rests on it. Nearest routes: ask Lightspeed's UK sales, count
   Lightspeed-powered shops in a UK directory sweep, or ask the bolt-on vendors
   how many UK customers they have.
2. **Velodrop and Bikebook trials.** Unstarted since 31 August, and now the
   highest-value open item on this list — §1.4 makes "better than theirs" the
   product's whole reason to exist, and this is the only thing that tests it.
   Both free, no card.
3. **Which series a UK Lightspeed shop is actually on** — worth asking the first
   design partner directly rather than inferring from US distributor lists.
4. **R-Series API operational limits** — rate limits, and whether work-order
   changes can be received as webhooks or must be polled. Not yet researched.
   Decides whether the diary can stay in sync or has to poll, which affects both
   architecture and how a busy shop's day feels.
5. **Reddit sweep** — r/bikeshops and r/BikeMechanics, still unreachable in every
   research pass **[NF]**, still the hole under the demand evidence.

## 8. What would falsify this

- **A UK Lightspeed population too small to matter.** If a directory sweep finds
  a few dozen shops, UK-first becomes design-partner recruitment only and the US
  phase has to move up. The build is unaffected; the commercial plan is not.
- **Velodrop or Bikebook turning out to have a genuinely good diary.** Then §6's
  differentiation narrows to the migration story alone, and §4 has to carry the
  entire proposition on its own.
- **R-Series being closed to new customers.** Not established either way
  **[NF]** — it still receives product updates, but Lightspeed's new-customer
  promotions sell X-Series. If R-Series is a closed installed base, the target
  market cannot grow and X-Series has to be reconsidered despite its weaker API.
- **Lightspeed shipping a real diary.** They have the machinery — Lightspeed Golf
  runs a full tee sheet with slot-level booking and 24/7 online reservations
  **[V]**. They built scheduling for golf and never brought it to retail service.
  If that changes, the product gap closes and only the migration story survives.

## 9. What changes in the plan

| Item | Change |
|---|---|
| Master plan §1 | First platform is Lightspeed R-Series, UK shops first. Replaces the Citrus-Lime targeting in §5b of the 1 September decision |
| Integration direction | Read out of Lightspeed continuously, from day one. Write-back deferred as a convenience, not a milestone |
| `PF-2` workshop-only mode | Unchanged and still required — a shop runs our jobs without our till either way |
| Option C coexistence | Retained as the fallback for any platform we cannot read from, including Citrus-Lime. Not the plan for Lightspeed |
| New work | A Lightspeed R-Series OAuth app, and a continuous read of products, stock, customers, sales and work orders. No task ID yet |
| Data-handling commitment | New requirement, from §4: explicit informed consent for the continuous read, plain-English explanation, and a working stop-and-delete |

## 10. What this does not decide

- **X-Series.** Deferred, not ruled out. A second adapter later is a different
  question from where the first shop comes from — the same wording §5b used
  about Lightspeed, now pointing the other way.
- **Citrus-Lime.** Not abandoned. Option C still works there and needs nothing
  from anyone. It is second in the queue, not struck off.
- **When the US phase starts.** Planned, unscheduled. Item 1 in §7 will inform it.
