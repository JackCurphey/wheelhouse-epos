## Why

WP-1.5 ("Products, stock, sizes and colours, in pence"; Stock control decisions 4 and 10; Release 2 rule 3) is what the restock list, the rest of the Stock screens, stock take by size and the Citrus import's sizes wait for. It is too large for one pull request, so this change holds only the split: the order of the pieces and the choices that run through all of them. Each piece is its own OpenSpec change, written just before it is built, and is archived in its own pull request.

## What Changes

Nothing by itself. `design.md` has the data model and `tasks.md` the ordered pieces. Archived, with no spec change of its own, when the last piece merges.

## Out of scope

Roles and the settings store (WP-1.1, WP-1.2) and the till on sync (step C, WP-1.6): Mark's. The old till and old sales tables keep working throughout.

## Who and risk

WP-1.5. #560 lists it as waiting on Mark; under the working agreement Jack's side is taking it, as Mark has shown no activity since 26 Oct. Every piece with a migration or touching stock is risky (**migrations**, **money and stock**) and gets `/review`.

## Follows

- Decisions: `docs/decisions/2026-10-01-stock-control-review.md` 2, 3, 4, 6, 8, 10, 11; `docs/decisions/2026-10-05-shops-and-sites.md`; `docs/decisions/2026-10-27-answers.md` answer 2.
- Specs: `docs/superpowers/specs/2026-10-05-wp-1-4-shops-and-sites.md`; `openspec/changes/wp-1-6-sales-in-pence/design.md` (products' pounds go with WP-1.5).
- Drawings the pieces lead to: `st-list`, `st-search-size`, `st-filter-bearings`, `st-categories`, `st-category-edit`, `st-product-sizes`, `rs-add-product`, `tr-sites`.
