# Design: removing a photo's hidden details

## Context

Booking photos are checked by `readBookingPhotos` (`server/booking-photos.js`),
which reads each photo's real type from its first bytes (`sniffImage`), then
saved by `saveBookingPhotos`. Staff attachments
(`POST /api/workshop-jobs/:jobId/attachments`) accept any file and save its
bytes. Neither touches the bytes today. A quote line's photo is a job
attachment that `sniffImage` recognises (`server/workshop/quotes.js:68`).

## Goals / Non-Goals

**Goals:** no location or other identifying details in any saved booking photo
or job picture; photos still display the right way up and in the right
colours; the picture data itself untouched.

**Non-Goals:** formats other than JPEG, PNG and WebP; product images; photos
already saved (see the proposal).

## Decisions

1. **Remove everything hidden, not only the location.** The time a photo was
   taken and the phone's make and serial number say as much about a customer
   as the place does, and nothing in Wheelhouse reads them. *Alternative:*
   remove only the GPS details inside the Exif block. Rejected: more parsing
   to keep details nobody uses, and the agreement's purpose is privacy.
2. **Keep the two things a picture needs to look right:** its Orientation
   (phones save an upright photo sideways and say "turn this" in the Exif
   block) and its colour profile (JPEG's ICC segment). For a JPEG the Exif
   block is replaced by a new one holding only the Orientation, when there
   was one. PNG and WebP keep their colour chunks (`iCCP`, `sRGB`, `gAMA`,
   `cHRM`; WebP's `ICCP`) and lose `eXIf`, the text chunks and WebP's `EXIF`
   and `XMP ` chunks.
3. **Rewrite the file's wrapper, never the picture.** Each format is a list of
   blocks; the module copies the blocks it keeps byte for byte and leaves out
   the rest, so the picture is never decoded or recompressed. *Alternative:* a
   library that re-encodes (e.g. sharp). Rejected: a large native dependency,
   and re-encoding loses quality.
4. **No new dependency.** One pure module, `server/photo-metadata.js`, with
   `removePhotoDetails(buffer)` returning the cleaned bytes (or the same bytes
   for a file it doesn't recognise). It is run inside `readBookingPhotos`,
   after the type check, and in the attachments route before the file is
   written, so the size saved is the cleaned size.
5. **Nothing after the picture's end is kept.** Some phones add a short video
   after a JPEG ("motion photos"), which can carry its own location; the
   module finds the JPEG's end marker by stepping over each scan and the
   tables between scans, never by searching, and keeps nothing after it. A
   PNG keeps nothing after its IEND chunk. A JPEG cut short inside its picture
   data is kept as far as it goes.
6. **A picture it can't make sense of is refused, not saved with its details.**
   A JPEG, PNG or WebP whose blocks don't add up (cut short, a length running
   past the end) can't be safely cleaned. A booking photo then gets the
   existing "A photo could not be read — please try adding it again"; a staff
   attachment gets "That picture couldn't be read. Try adding it again." A
   file whose first bytes aren't a picture at all is saved as it is, as today.

## Risks / Trade-offs

- [A camera puts location somewhere unexpected, e.g. a maker's own block in a
  JPEG] → Every APP1 to APP15 segment except the ICC profile (APP2) and
  JFIF/Adobe colour markers (APP0, APP14) is dropped, not only the known ones.
- [Orientation lost, so upright photos show sideways] → Tested with a photo
  carrying Orientation 6 (turned right), checked to keep it.
- [A malformed file crashes the server] → The module never trusts a length:
  every read is bounds-checked, and a bad file is refused (decision 5), with
  tests for files cut short at each step.
