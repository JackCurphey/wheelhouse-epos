# Design

## Context

The print agent was a desktop helper a shop PC ran: it checked in with the
server every few seconds, listed its printers, and printed sticker jobs a
browser queued for it. The server kept the devices and jobs in memory,
keyed by shop (#510). Only the old app's Print stickers box used it, and
that box already fell back to the browser's print box when no helper was
signed in.

## Decisions

1. **Delete, don't hide.** The folder, the route file, its registration and
   its test go in one change. Nothing in the database belonged to it, so
   there is no migration.
2. **The old app keeps browser printing.** Print stickers keeps its label
   size, quantities and barcode, and always calls `printStickers` (the
   browser print box). The helper's choice, its status line and the
   dashboard's "Connected printers" panel are removed, as the old app is a
   placeholder (21 Oct) and those paths would now call routes that answer
   404.
3. **The id check keeps its test.** `tests/route-id-params.test.js` proved
   a param outside `ID_PARAMS` reaches its handler using the print job's hex
   id. It now uses `POST /api/message-templates/shop_reply/preview`, which
   answers 200 only if `:key` is left alone. Watched failing by adding `key`
   to `ID_PARAMS` (404 "Not found"), then restored.
4. **No dependency changes.** The helper's packages lived in its own
   `print-agent/package.json` and lockfile, which go with the folder; the
   root `package.json` named none of them.

## Risks

- A shop with the helper installed sees it fail to check in. No shop runs
  Wheelhouse yet, so nothing is lost.
