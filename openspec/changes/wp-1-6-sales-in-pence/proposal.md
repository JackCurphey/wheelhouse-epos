# Proposal: one sales record in pence, and where open orders live (WP-1.6, data part)

## Why

WP-1.6 moves the till onto the offline core's `till_sales` tables (migration
036), which keep every sale once, in whole pence, with VAT per line. Issue
#134 (Codex's review finding 8) points out what the build plan doesn't say:
- Several places still write and read the old sales tables in pounds: the
  till, the workshop's job orders, Shopify orders and the dashboard.
- `till_sales` has nowhere to keep an **open** order, the kind a job has
  until it is paid.

The offline spec left this to "the implementation plan", saying it "must list
them" (`docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md`,
§6). This change is that list, plus how everything keeps working during the
move and how totals are checked afterwards. Jack listed the workshop's part
on #134. This adds Mark's part, and answers Jack's question there.

## What Changes

- **Open orders stay in `sale_documents`, kept in pence** (Mark, 15 Oct,
  answering Jack on #134). A job keeps its order exactly as it does now.
  The order also records how much has been paid towards it, so that from
  WP-3.1 more than one till sale can pay it. That covers a deposit then the
  balance (Selling at the till decisions 8 and 11), Cycle to Work deposits
  (Cycle to Work decision 4), and items ordered in.
- **Money in the database moves from pounds to pence.** The old app keeps
  getting pounds from the server, with the statuses it understands, until
  its screens are gone.
- **Reports read both records.** The dashboard, the sales list and a
  customer's history count every sale exactly once, whether it is in the old
  tables or the new `till_sales`. Till sales show on the day they were made.
- **A totals check**, run before and after each step:
  - every converted amount matches its pounds value;
  - every order's lines add up to its total;
  - every sale's lines and payments add up to its total;
  - past days' takings are unchanged.

  An unknown mismatch stops the step.
- **The rules WP-3.1 must follow** when the new till pays an order. The
  check that a job can be finished before taking money stays exactly as it
  is today.
- **The full list** of every place that writes or reads the old sales tables
  or money in pounds is in `design.md`, Mark's and Jack's both.

## Capabilities

### New Capabilities

- `sales`: how a sale is recorded (once, in pence, with VAT per line), how an
  open order is kept and paid off, how reports count sales, and the totals
  check.

### Modified Capabilities

None yet. `workshop-jobs` describes a job's order and paying for a job. When
Jack's tasks change how its amounts are stored, his pull request updates that
spec's wording, which says nothing about pounds or pence today.

## Lane, drawings and decisions

- **Lane:** both. The till, sales, Shopify, dashboard and the move itself are
  Mark's (split plan §3; WP-1.6). The workshop's amounts and screens are
  Jack's (his part of #134). Per split plan §4.3, the contract is
  `design.md`'s "Money contract", and Mark's server half merges before Jack's
  workshop half starts.
- **Drawings:** none changed. What staff see stays the same. Amounts still
  show as £ (`types.ts:52-55`).
- **Decisions followed:**
  - Selling at the till decisions 8 (deposits are one of the ways to pay),
    9 (refunds start from the original sale) and 11 (part-paying a workshop
    job starts from the payment): `docs/decisions/2026-09-29-selling-at-the-till-review.md`.
  - Cycle to Work decision 4 (orders can wait for a deposit):
    `docs/decisions/2026-10-02-cycle-to-work-review.md`.
  - Paying for finished work (`docs/decisions/2026-10-08-paying-for-finished-work.md`).
    It keeps working as it does.
  - The offline core: each sale recorded once, never refused, in pence with
    VAT per line (`docs/superpowers/specs/2026-09-27-release-2-foundations-offline-design.md`).

## Out of scope

- **Moving the new till onto sync** (`till_sales`). That's the send-queue
  part of WP-1.6, with the till's registration and offline copy. The view in
  this change already counts till sales.
- **Paying an order at the new till.** That's WP-3.1 ("paying for a workshop
  job"), built to `design.md` Decision 8. Until then, jobs are paid as they
  are today.
- **How VAT is split on a deposit**, and **what VAT rate labour carries**.
  The labour rate is asked on #134; nothing is assumed.
- **Products' prices in pence.** That's WP-1.5, though this change lists the
  `products.price` readers it depends on.
- **Copying old sales into `till_sales`.** History stays where it is and is
  read alongside the new sales.
- **Refunds.** There is no refund table today, and Selling at the till
  decision 9 shapes them later.

## Impact

- Migrations: pence columns on `sale_documents` and `sale_document_items`,
  and a view that reads both sales records.
- Server: the `sale-documents` routes, convert, `loadDocumentLine`, the
  dashboard, the sales list and a customer's history, plus Jack's workshop
  files listed on #134.
- A new totals check script and its tests.
- Every file and line is listed in `design.md`.
