# Book server work, piece 6: customer photos

**Date:** 2026-09-25. **Approved in session by Jack** (design, 25 Sep, in two
sections). **Not yet reviewed as a written spec**: Jack reviews this file
before the plan is written.

**Serves:** book screen `problem` (03), which says "Add photos or a short
video … Optional · you can also show us at drop-off". Also the staff job view:
the prototype shows the rider's media on the job (`prototype/src/main.tsx:1302`).

**Part of:** the server prerequisite work for journey plan 4a
(`docs/superpowers/plans/2026-09-20-phase-4a-book.md:59`, item 3 gap table:
"Customer photo/video upload: attachments ... are staff-only"). Piece 6 of six;
Release 1 per decision J2
(`docs/decisions/2026-09-23-book-journey-routing-and-modes.md:52`). Pieces 1-5
are merged (#64-#70).

## Decisions this rests on (Jack, 25 Sep)

1. **Photos only.** No video in this piece. Video can come later, once hosting
   and storage are decided.
2. **Photos are sent only while booking,** in the booking request. They can't
   be added afterwards from the private link.
3. **Up to 5 photos per booking, each up to 10 MB.**
4. **Only staff see the photos.** The private link shows only how many were
   sent (for example "2 photos received").
5. **Stored as staff attachments marked "from the customer"**, reusing the
   existing attachments table, files on disk, list, download and clean-up.
   There is no separate store.
6. **Checked before anything is saved; saved only once the booking is
   accepted.** A refused booking leaves no job, no customer row and no file.

## What is built

### Storage (migration 029)

- Add `workshop_job_attachments.from_customer BOOLEAN NOT NULL DEFAULT false`.
- Existing rows are staff attachments, so `false` is correct for them.
- The files go to the existing `UPLOADS_DIR` under a random `storage_key`, as
  staff attachments do (`server/server.js`, "Workshop job attachments").

### Checking the photos: a new pure module, `server/booking-photos.js`

- `readBookingPhotos(input)` returns `{ value: Photo[] }` or `{ error }`, where
  `Photo = { buffer, contentType, extension }`.
- **Input:** `photos` is optional. It is a list of `{ dataBase64 }` objects.
  - Absent, null or `[]` all mean no photos.
  - Anything else that is not a list is refused.
- **Rules:**
  - More than 5 photos → "You can add up to 5 photos".
  - Data that is not a string, is empty, or doesn't decode → "A photo could not
    be read — please try adding it again".
  - A decoded photo over 10 MB → "Each photo can be up to 10 MB".
  - The type is decided from the file's first bytes (JPEG `FF D8 FF`; PNG
    `89 50 4E 47 0D 0A 1A 0A`; WebP `RIFF`....`WEBP`). A name or type the
    browser claims is never trusted. Anything else → "Only photos can be added
    (JPEG, PNG or WebP)".
- **Pure:** no database and no disk.

### Booking: `POST /api/portal/:shopSlug/bookings`

- **Request size:** the request's size cap rises from `readJsonBody`'s 2 MB
  default to fit 5 photos of 10 MB after base64 (`Math.ceil(5 * 10 MB * 1.4)`).
  - A request over that cap is refused with 400 "Those photos are too large
    to send — please add fewer or smaller photos".
  - It must not give a 500.
- **When photos are checked:** `readBookingPhotos` runs with the other checks,
  before any database write. That is after the service lookup and answers
  check, and before the guest branch, as pieces 3 and 5 order it.
- **Not-sure bookings:** photos are allowed on a "not sure" booking, because
  they describe the problem, not the service.
- **When photos are saved:** inside the booking lock, right after the job is
  inserted.
  - Each file is written to disk and a `workshop_job_attachments` row is
    inserted with `from_customer = true`.
  - The row's `original_name` is `Customer photo N.<ext>` (`N` counts from 1 in
    the order sent). The customer's own file name is never stored.
  - The row's `content_type` is the checked type.
- **If saving fails:** if any write or insert fails, the files already written
  for this booking are deleted and the error is raised, so the transaction
  rolls back and no job is kept.

### Staff

- `serializeAttachment` gains `fromCustomer`.
- The existing staff routes are unchanged:
  - `GET /api/workshop-jobs/:jobId/attachments` lists the photos alongside
    staff files;
  - `GET .../attachments/:id` downloads them;
  - job delete removes the files.

### Private link read-back (piece 4)

- It gains `photoCount`: the number of `from_customer` attachments on the job.
- It shows no photos, names or ids.

## Tests (written first, each seen failing)

- **Migration:** the column exists, with its type, not-null and default; an
  existing-style insert gets `false`.
- **Unit (`booking-photos`):**
  - each file type is accepted, identified by its content;
  - a text file renamed `.jpg` is refused;
  - 6 photos are refused and 5 are accepted;
  - 10 MB is accepted and 10 MB + 1 byte is refused;
  - a non-list, empty data and non-string data are each refused;
  - absent, null and `[]` mean no photos.
- **Booking** (signed in for the successful bookings):
  - photos are stored as `from_customer` rows with `Customer photo N` names and
    the checked types;
  - the files on disk match the bytes sent;
  - a booking with no photos works as before;
  - a "not sure" booking can carry photos.
- **Refusals**, sent as a guest, each leaving no job, no customer row and no
  new file in `UPLOADS_DIR`:
  - too many photos;
  - a photo that is too big;
  - not a photo;
  - an over-cap request body (400, not 500).
- **Staff:** the attachments list shows `fromCustomer: true`, and the download
  returns the bytes.
- **Private link:** `photoCount` is 2 for a booking with 2 photos and 0 for
  one with none. Keep the link test file under 30 lookups.

## Out of scope

- **Video** (decision 1).
- **Adding photos after booking,** from the private link or elsewhere.
- **Showing photos on the private link.**
- **Removing the hidden location details (EXIF) inside photos.** Only staff
  see the photos, and the booking page's planned shrink step usually drops
  those details.
- **Photo answers to service questions** (piece 5 lists these as piece 6's).
  With decision 2, photos belong to the booking, not to a question.
- **All screens:** the photo picker on the booking page, and the staff display.
- **Moving the files to hosted storage;** that happens when hosting is chosen
  (PL-1).

## To verify when planning

- **The booking route:** where it catches `readJsonBody` errors today (an
  over-cap body must give a 400), and exactly where the photo check and the
  photo writes slot in (`server/server.js`, `POST /api/portal/:shopSlug/bookings`).
- **`createWorkshopJob` and `withBookingLock`:** confirm that an error thrown
  after the job insert rolls back the job and its hold.
- **The guest limiter:** confirm it runs after the photo check, so refused guest
  test bookings don't use its 5 per hour.
- **Migration number:** 028 is the latest merged, so this is 029.
