## Why

WP-2.4 is the last piece of slice C that doesn't wait on Mark: a shop on Citrus Lime brings its data across. The owner drops in the files Citrus Lime exports, and Wheelhouse does the rest (Moving from Citrus Lime, decision 2). This first pull request is the server half for products and stock, so the screens and customers can follow on top of it.

## What Changes

- The Owner sends a file; Wheelhouse works out which Citrus Lime report it is from its column names, with no column-matching screen. A file it can't read is refused and nothing is kept.
- From Price List - Store Level: products, with prices, cost, VAT rate, supplier, reorder level and stock. From Barcode/Alias List: barcodes. Stock arrives with a history line saying it came from Citrus Lime.
- It carries on by itself in the background, a batch at a time, and survives a restart; a request key means a retried send counts once.
- A row that doesn't fit is kept as "needs a look" with the reason, and the rest come across. Bringing the same file again changes nothing.

## Out of scope

The screens (next pull request, `citrus-import-screens`). Customers and bikes, Fix and Leave it out, Ask us to help (later pull requests of WP-2.4). Serial Number List: Wheelhouse has nowhere to keep a serial number on stock yet. Sizes and colours (WP-1.5, Mark's): each Citrus Lime code comes across as its own product. Stock at a second shop (WP-1.4, WP-5.2). The weekly refresh, sales and workshop jobs (WP-8.1). Real export files: made-up test files only.

## Who and risk

WP-2.4, Jack's. Risky areas: **migrations** (111), **money and stock** (`stock_qty`, prices, costs), and **server.js** (the background timer).

## Follows

- Drawings: `mv-progress`, `mv-progress-failed`, `mv-summary` (`docs/design/user-journeys/generator/moving.mjs`) set what the server must report.
- Decisions: `docs/decisions/2026-09-30-moving-from-citrus-lime-review.md` 2, 3 and 9 (M4); `docs/decisions/2026-10-18-build-for-every-shop.md` 5 (tested on made-up files); stock control decision 6 (stock has a history).
- Columns: `docs/superpowers/specs/2026-10-05-citrus-lime-exports.md`.

## Capabilities

### New Capabilities
- `moving-from-citrus-lime`: bringing a shop's data across from Citrus Lime's exports.

### Modified Capabilities

## Impact

`server/lib/spreadsheet-read.js`, `server/move/`, `server/routes/move.js`, `server/server.js`, migration 111. No new dependency: an Excel file is a zip of XML, which Node's own `zlib` opens with a limit on how large it may unpack.
