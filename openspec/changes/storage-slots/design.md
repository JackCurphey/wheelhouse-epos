# Design

## Storage (migration 054)
- `storage_slots`: `id`, `shop_id`, `name`, `position`; shop-separated by RLS.
- `workshop_settings.storage_slots_on` (0/1, off to start: a new shop has no slots).
- `workshop_jobs.storage_slot_id` → `storage_slots(id)`, `ON DELETE SET NULL`.
- Per shop for now; the plan's per-site slots wait for sites in the workshop (WP-1.4).

## Rules (not drawn; logged)
- Chosen at book-in only ("no hook until the bike is booked in", walk-through
  answer 11, 3 Oct); not required; two bikes may share one.
- Changed while the bike is in the shop; cleared when it is collected
  (collect sets it to null in the same write).
- Removing a slot clears it from the jobs on it. Switching slots off hides them
  everywhere and keeps the list.

## Contract
- `GET /api/workshop-settings` and `PUT` carry `storageSlotsOn` (Owner only).
- `GET /api/storage-slots` → `[{ id, name }]` in order (everyone signed in).
- `POST /api/storage-slots` `{ name }` → 201 `{ id, name }`; `DELETE /api/storage-slots/:id` → 204 (Owner only).
  A name is 1 to 40 letters and unique in the shop (400 otherwise); 404 for one that isn't there.
- Every job reply carries `storageSlotId` and `storageSlotName` (null when none).
- `POST /api/workshop-jobs/:id/book-in` takes an optional `storageSlotId`
  (400 "That slot doesn't exist" for one that isn't the shop's).
- `PUT /api/workshop-jobs/:id/storage-slot` `{ storageSlotId: number | null }`
  → the job (changed reply); 409 `illegal` unless the bike is in the shop.

## Screens
- Settings fold "Storage slots", summary "On · [n] slots" or "Off".
- New job: "Where the bike is kept" pills when slots are on and "The bike is
  here now" is on; none chosen to start.
- Book in on the job page and the Overview, when slots are on: the drawn
  till-book-in box ("Book in · job WH-1042", the pills, Not now / Done).
- The job page: "Kept on [slot]" in the customer strip, a button opening the
  same box to change it. The Overview: "Kept on [slot]" for a bike in with a
  slot. A diary block: the slot on its third line where there's room.
