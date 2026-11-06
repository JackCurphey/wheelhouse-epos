# Tasks

Each test written first and watched failing for the right reason; each rule broken on purpose, with the break confirmed landed.

## 1. First pull request: who adds and changes a product

- [x] 1.1 Record Jack's answers 9 and 10
- [x] 1.2 Test: staff refused on every product write, the Owner's sign-in with someone checked in refused, adjusting and receiving still everyone's (`tests/product-editing-owner.test.js`); the old app's refusal shown plainly (`tests/browser/old-app-product-refused.spec.ts`)
- [x] 1.3 `server/lib/product-editor.js` on every product write

## 2. Second pull request: a product's details, and finding by them

- [x] 2.1 Test: migration 121 (`tests/migration-121.test.js`); answers, refusals, search by measurement, filters (`tests/product-details.test.js`)
- [x] 2.2 Migration 121; `server/lib/product-details.js`; the answers route; the list's search and filters
- [x] 2.3 Query plans on large data under the app role

## 3. Third pull request: making and changing a product with sizes

- [x] 3.1 Test: names, categories made, stock, renames in step, refusals, Owner only, busy, a race with a category rename, a sale's line (`tests/product-groups-editing.test.js`)
- [x] 3.2 `server/routes/product-groups.js`
- [x] 3.3 Log; full runs; archive as the top pull request's last commit
