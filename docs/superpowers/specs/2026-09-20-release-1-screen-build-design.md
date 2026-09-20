# Release 1 — building the 84 atlas screens as real product

Date: 20 September 2026. **Design agreed with Jack in session; not yet an
implementation plan and not evidence that anything is built.** The
implementation plan follows this document and is where packages, row IDs and
test commands land.

Authority above this document: [scope
reduction](../../decisions/2026-09-10-release-1-scope-reduction.md) and the
[Release 1 workshop plan](../plans/2026-09-10-release-1-workshop-plan.md). This
design says *how* the atlas becomes software; it does not re-open *what* is in
Release 1.

## Intent

Turn the [84-screen journey
atlas](../../design/release-1-journey/README.md) — today a set of static HTML
specimens with fixed fixtures — into a working staff and customer application
backed by the existing Postgres schema and server.

## Starting facts, verified 20 September 2026

- The atlas in the repo is byte-identical to both copies in `~/Downloads`
  (SHA-256 `c3cd12bf5c427dfb2bf9bb910c441e6a2ac587dc2bf43868a5e7d0799e2ddf37`,
  148,286 bytes). The repo copy is the latest download; there is nothing newer
  to fetch, and the atlas is not published as a claude.ai artifact.
- Jack's full review export is now committed at
  [`docs/reviews/2026-09-17-release-1-screen-review-jack.md`](../../reviews/2026-09-17-release-1-screen-review-jack.md):
  84 of 84 screens reviewed, 71 approved as shown, 13 carrying notes. It
  previously existed only in `~/Downloads` and in one browser's local storage.
- **Nothing is deployed.** `.github/workflows/` contains only `test.yml`; there
  is no deploy pipeline, no hosted environment and no shop using the system.
  The `NODE_ENV=production` references in the README are refusal-to-start
  guards, not a deployment.
- The frontend platform is decided (D-005: shadcn/ui + Tailwind + React on
  Vite). `src/staff/main.tsx` is a deliberately inert entry point that mounts
  only when a `#wh-root` element exists. The live staff UI is the 6,933-line
  vanilla `public/app.js`.
- Composition of the 84 screens **as reviewed**, from `screen-index.json`. Phase 0 has since revised this to 82 — see the plan's outcome section: by journey group,
  book 5, intake 11, quote 8, work 17, edges 24, setup 19. By role, service desk
  desktop 33, customer phone 24, manager desktop 17, mechanic phone 10.

## Decisions taken in this session

| # | Decision | Decided by | Consequence |
|---|---|---|---|
| A | Revise the atlas against the 13 notes **before** planning the build | Jack | Phase 0 exists; no rejected screen gets built |
| B | Do not wait for Mark's issue #50 review; absorb it when it arrives | Jack | Some rework risk accepted if he objects structurally |
| C | Build a **new staff app** and cut over at the end, rather than strangling `public/app.js` screen by screen | Jack | No partial delivery; progress is reported as tests and schema coverage until the screen layer starts |
| D | The new app covers **only the 84 screens**; till, inventory, suppliers, purchase orders and storefront stay in the existing app | Jack | "Cutover" means the workshop half only; two apps behind one login |
| E | Extend the **existing server and schema**, not a new service or new database | Jack | One database, one job record, no sync problem, existing tenancy and auth work retained |
| F | Sequence the build **by layer**, not by vertical slice | Jack | Justified below |

### Why layer-first is right here

Vertical slices buy continuous delivery of working software to users. There are
no users (see starting facts), so that benefit is worth nothing and its
coordination cost is pure loss.

The usual failure of layer-first — designing tables and endpoints for screens
nobody has specified — is largely retired in this project. The atlas specifies
84 screens with their states, transitions and next-destinations in
machine-readable form, and every one has been reviewed. That is not the normal
starting position for a layer-first build.

Two limits on this, which shape the phases below:

1. **Screens are pictures, not contracts.** The atlas shows what a state looks
   like, not how it is entered or what happens when two people race for it. The
   concurrency rules in the workshop plan's acceptance criteria — one winner for
   the last capacity slot, a stale link that cannot approve a changed price, a
   print acknowledgement that never arrives — appear in no screen. Therefore the
   first layer is the **state machine**, not the schema.
2. **Three areas cannot be designed from any layer yet**, because the facts do
   not exist: Lightspeed (no account, no confirmed series), printing (no
   confirmed printer, label stock or scanner) and messaging (no chosen
   providers). These are P00 in the workshop plan. They run as proof spikes in
   parallel from day one and their adapters stay behind interfaces until
   evidence lands. Treating them as ordinary layers would block the build behind
   a dependency that cannot be cleared at a keyboard.

## Phases

### Phase 0 — revise the atlas against the 13 notes

Apply Jack's notes so the atlas is the build target rather than a document the
build contradicts. The substantive changes:

| Screens | Note | Effect |
|---|---|---|
| 17, 33 | No mechanic phone view; one page per job on tablet or desktop, including finish/check/mark-ready and item scanning | The 10 "Mechanic · phone" screens collapse into a smaller set of tablet screens. This is a removal, not a restyle |
| 11 | Barcode rather than QR; shop chooses what the tag's top line shows (job number, customer name or bike) | Changes the tag layout and the resolver contract in P08 |
| 01 | Three service options lead to a second page of detailed options (e.g. individual services) | Adds a screen |
| 03, 70 | Booking mode is a shop setting; third mode "appointment only" | Changes P04/P05 capacity behaviour, not just settings UI |
| 38, 39, 44 | Week view as built in `public/app.js:1493`; customer calendar with filled slots blocked out as in `public-portal/portal.js`; month boxes coloured with "full" / "space available"; right-click to set default diary view | Existing working code becomes the spec for three screens |
| 27, 68 | Shop-authored service checklist templates; editable inspection checklist and variable number of customer questions | Extends P03 |
| 04 | Optional shop deposit option, "as it works at Tallboys" | **Blocked on Mark** — the reference is his |
| 82 | Bike dropdown, since a customer may have several bikes | Small, contained |

Phase 0 cannot complete without five decisions that are Jack's or Mark's, not
mine: barcode symbology and whether the 2D path is dropped entirely; what
"appointment only" does to drop-off capacity; how service subcategories nest;
what the deposit option means concretely; and whether the mechanic job page is
one scrolling page or tabs.

### Phase 1 — state machine

Write down, and agree, the states and legal transitions for: job lifecycle,
custody, quote revision and approval, capacity holds and expiry, print task
lifecycle, and message send intention. Include the failure and race outcomes,
not only the happy path. This is the document the schema is derived from.

### Phase 2 — schema and migrations, one pass

Extend the existing 15 migrations to cover the Phase 1 model. Because there is
no production data, this pass may restructure freely; that freedom disappears
the moment a shop is live, so it is spent here deliberately.

### Phase 3 — API layer

Endpoints on the existing `server/server.js`, with one rule: **every endpoint
traces to a named screen in `screen-index.json`**. An endpoint no screen
consumes is not built. This is the specific guard against layer-first's usual
failure mode.

### Phase 4 — the screens

Built in the new React app, in journey order (book → intake → quote → work →
setup → edges), against a backend that already exists and is tested. Edges last,
because 24 of the 84 are alternative outcomes of journeys that must exist first.

### Phase 5 — integration and verification

P07 Lightspeed handoff, P06 real channel delivery, P08 physical print and scan —
each gated on its P00 proof — then the store acceptance scenarios from the
workshop plan, and the revised ledger reconciled against evidence.

### Parallel throughout — P00 proofs

P00a Lightspeed account and series; P00b printer, label stock, driver host and
scanner; P00c message providers and inbound routing. Each blocked on Jack
supplying access or hardware answers. Their adapters are interfaces until then.

## Testing

Test-first per phase. The state machine gets table-driven transition tests
before any schema exists. Schema work gets two-shop tenant-isolation tests run
under the non-superuser role. Each endpoint gets its failure cases, including
the concurrency cases named in Phase 1, before its success case is wired to a
screen. Screens get component tests plus the existing Playwright check pattern.

Every new test is confirmed by breaking the code it covers, watching it fail for
the right reason, and restoring — a test that passes against deliberately broken
code is not testing anything.

## Done-conditions

- Phase 0: the atlas HTML regenerates and `check-static.mjs` passes, with the 13
  notes visibly applied and the screen count updated from 84 to whatever the
  mechanic-page collapse produces.
- Phases 1–3: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`
  all pass, and every endpoint names its consuming screen.
- Phase 4: each journey group demonstrable end to end against the real database.
- Phase 5: the workshop plan's store acceptance scenarios, with evidence.

## Explicitly not in this design

Wheelhouse invoicing, payment links, deposits beyond the Phase 0 question,
refunds, customer import, reporting, group capacity, disaster recovery, a second
Lightspeed adapter, and retiring `public/app.js`. Decision D above keeps the
existing app alive for everything outside the 84.

## Known risks

1. **No demo for a stretch.** Accepted under decision C; the mitigation is that
   phase done-conditions are runnable checks rather than screenshots.
2. **Mark's review is outstanding.** Accepted under decision B. If he objects to
   something structural, Phase 1 or 2 is rework.
3. **Phase 0 is blocked on five decisions and one Mark reference**, so it cannot
   be completed in a single unattended pass.
4. **The P00 proofs have been pending since 10 September.** Phase 5 cannot start
   without them, and no amount of internal work substitutes.
