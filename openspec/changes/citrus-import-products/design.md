## Design

1. **Reading a file (`server/lib/spreadsheet-read.js`).** `.xlsx` (a zip of XML) and `.csv`. No dependency: each part is unpacked with `zlib`'s `maxOutputLength`, so a small file can't unpack to something that stops the server. Anything else, an old `.xls` included, is "can't read". We have not seen a real export file, only its columns (`2026-10-05-citrus-lime-exports.md`), so the format Citrus Lime's "Export to Excel" gives is unconfirmed.

2. **Which report it is (`server/move/citrus-files.js`).** The first of the top 20 rows holding a report's needed columns is its heading row, so a title above the table doesn't matter. Only the columns we use are kept, so nothing else from the file is stored.
   - Price List - Store Level needs Item Lookup Code, Description, Price, Qty On Hand.
   - Barcode/Alias List needs Alias and ILC.

3. **Tables (migration 111).** `move_files`: one per file sent, with its report, name, state (`bringing`, `done`), counts, who sent it and its request key. `move_rows`: one per row, `waiting`, `in` or `look`, with its reason. Once a row is `in` its data is emptied.

4. **Sending (`POST /api/move/files`).** Owner only, and not while someone else is checked in on that computer. `{ fileName, dataBase64, requestKey }`, 30 MB at most, base64 in JSON as other uploads are. The file row and all its rows are written in one transaction and the reply comes after COMMIT. The same key returns the same file; the same key with a different body is refused. A file that can't be read replies 422 `cant_read` and stores nothing.

5. **Bringing across (`server/move/bring-across.js`).** A timer started and stopped beside the messages sender, each 2 seconds (`WH_MOVE_TICK_MS`), which only looks when there's a reason: once at the start, after a file is sent, and while a round left more to do. For each shop, up to 20 batches of 500 rows, each in its own `runWithShop` so no connection is held between them. A batch: BEGIN, take the file's waiting rows `FOR UPDATE SKIP LOCKED`, apply each, write its state and the counts, COMMIT. A restart picks up what's still waiting, because a row and what it wrote commit together. A file's order: price lists before barcodes.

6. **A row that fails unexpectedly** rolls back to its own savepoint and becomes `look` ("Wheelhouse couldn't bring this row across"), so one row can't stop a file.

7. **Price List row.** Item Lookup Code → `sku`; Description → `name`; Department and Category → `category`, as "Drivetrain › Derailleurs" (one alone if only one, else Uncategorised); Price → `price`; Store Cost → `cost`, 0 if empty, as adding a product does; Tax Rate → `vat_rate_bp`, 20% if empty, the column's default; Supplier → `supplier`; Min (Reorder Point) → `low_stock_threshold`, 3 if empty, as adding a product does; Qty On Hand → `stock_qty`; Active of No, False or 0 → off sale. `show_online` stays off, so nothing reaches Shopify or the website. A row needs a look with no code, no description, no price, a price, cost, reorder level or quantity that isn't a sensible number, or a VAT rate that isn't 0, 5 or 20%. A rate of 0.2 is 20%: Excel keeps percentages as fractions.

8. **Stock history.** A non-zero quantity writes one `intake` line, "Brought across from Citrus Lime", under the sender's login, in the same transaction as the product. Below zero is kept: Today already asks for those to be counted.

9. **Never overwrites.** A code already in Wheelhouse is left alone and counted `in` (decision 3: what was done in Wheelhouse stays), so bringing a file twice doesn't double the stock. `INSERT … ON CONFLICT DO NOTHING` holds this against a save at the same moment.

10. **More than one shop in a file.** The file's first Store is the shop's stock; a row from another store needs a look ("Stock at [store]: one shop's stock comes across for now"), since a product has one stock figure until WP-1.4 and WP-5.2.

11. **Barcode row.** Each batch first locks its products in id order, the order sales use. Alias → `barcode`. Needs a look: no such product ("The product isn't in the products file"), a product with another barcode (one barcode each until WP-1.5), or a barcode another product has. When a price list finishes, barcode rows waiting on a missing product are tried again, whichever file arrived first.

12. **What the screens read (`GET /api/move`).** Owner only: each file's report, name, state and counts, oldest first. It carries no cost and no row data.
