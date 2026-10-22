# Design

## Storage (migration 052)
- `workshop_checklists`: `id`, `shop_id`, `name` (text), `items` (JSONB list
  of item labels, in order), `created_at`, `updated_at`. Shop-separated by
  row-level security, as every shop table.
- `workshop_services.checklist_id`: the service's checklist, or null; set to
  null when the checklist is removed. A service has one checklist at most.
- `workshop_job_checklists`: one per job at most (`workshop_job_id` unique,
  deleted with the job), `checklist_id` (null once that checklist is removed),
  `name`, `items` (JSONB list of `{ label, done, note }`), `updated_at`.
  Written by the first tick or note, copying the checklist as it is then; a
  job without one reads its service's current checklist.

## Which checklist a job has
The first of its services, in order, whose service has a checklist: the
online booking's services (`workshop_job_services` by position), then the
labour lines on its order with a service (`sale_document_items.service_id`,
by id). None: the job has no checklist and the page shows no bar.

## Contract
Settings (Owner only to change; everyone signed in may read):
- `GET /api/workshop-checklists` → `[{ id, name, items: string[], serviceIds: number[] }]`
- `POST /api/workshop-checklists` `{ name, items, serviceIds? }` or
  `{ template: true }` (the ten drawn items, named "Full service checklist",
  used for no service yet) → 201 the checklist.
- `PUT /api/workshop-checklists/:id` `{ name?, items?, serviceIds? }` → the
  checklist. `serviceIds` is the whole list: those services move to this
  checklist (leaving any other), and services no longer listed lose it.
- `DELETE /api/workshop-checklists/:id` → 204. Jobs already started keep
  their copy.
- Refusals (400): a name is needed (up to 80 letters); 1 to 50 items, each
  1 to 120 letters; a service that doesn't exist. 404 for a checklist that
  doesn't exist.

The job:
- `GET /api/workshop-jobs/:id/checklist` → `{ name, items: [{ label, done, note }], done, total, notes }`
  or `null` when the job has none.
- `PUT /api/workshop-jobs/:id/checklist/items/:index` `{ done?: boolean, note?: string | null }`
  (`index` from 0) → the checklist as above. A note up to 500 letters; an
  empty note is none. Refused with 409 `illegal` once the work is finished
  (finished work is frozen until reopened, as its other details), 404 when
  the job or its checklist or that item doesn't exist.
- `POST /api/workshop-jobs` also takes `serviceIds` (the services New job
  chose), stored as an online booking's are.

## Not decided by a drawing (logged in decided-while-building)
- Unticked items don't stop Mark ready for collection.
- Anyone signed in may tick; a later tick or note on the same item wins.
