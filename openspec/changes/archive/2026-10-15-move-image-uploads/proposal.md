# Proposal: the image upload routes move to their areas (WP-0.4)

## Why

One of WP-0.4's remaining moves. The three image uploads (a product's photo,
the shop's logo and its hero image) are still in `server.js`, sharing one
helper. Moving them finishes the products and website route files, and puts
the shared upload code in `server/lib/uploads.js`, as promised on #180.

## What Changes

- `POST /api/products/:id/photo` moves to `server/routes/products.js`, with
  `MAX_PRODUCT_PHOTO_BYTES`.
- `POST /api/storefront-settings/logo` and `/hero` move to
  `server/routes/website.js`, with `MAX_SHOP_IMAGE_BYTES`.
- `readUploadedImage` and `ALLOWED_IMAGE_TYPES` move to
  `server/lib/uploads.js`, beside `UPLOADS_DIR`.
- `serveUploadedImage` stays in `server.js`, because the dispatcher calls it
  outside the route table (split plan §4.1 rule 1).
- Moved, not rewritten. The only changes are:
  - the 2-space indent inside `register(route)`;
  - `export` on `readUploadedImage`;
  - `catch (err)` becoming `catch {` where `err` was unused, as in Jack's
    moves;
  - updated file headers.

  No behaviour changes (`skip_specs`).

## Lane, drawings and decisions

- **Lane:** Mark's (`server/routes/products.js`, `server/routes/website.js`,
  `server/lib/uploads.js` and `server.js`; split plan §3).
- **Drawings:** none.
- **Decisions followed:** split plan §4.1, and Mark's answer to Jack's
  question 2 on #180.

## Out of scope

- Job attachments and deleting a job (Jack's, now able to use
  `UPLOADS_DIR`). Booking photos and the portal are later moves.

## Impact

- `server/lib/uploads.js`, `server/routes/products.js`,
  `server/routes/website.js`, `server/server.js`, and the new test
  `tests/image-uploads-module.test.js`. Built on #205, which adds
  `server/lib/uploads.js`.
