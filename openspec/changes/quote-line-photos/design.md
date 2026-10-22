# Design

## One photo per line, as drawn
Every drawing shows one photo on a line ("1 photo"); the decision says
photos are optional. A line keeps one: `photo_attachment_id`. Draft saves
delete and re-insert lines, so the staff screen sends each line's `photoId`
back with it, as it sends the reason; a new revision's lines carry what staff
send. The file itself is one of the job's files, uploaded through the
existing `POST /api/workshop-jobs/:jobId/attachments`; removing it from Files
and photos clears the line (`ON DELETE SET NULL`).

## Checks
Saving a line with `photoId` (409 `illegal`, as other quote line refusals):
it is an integer, an attachment of the same job, and its file's first bytes
are JPEG, PNG or WebP (`sniffImage`, from the booking photos).

## The customer's photo route
`GET …/booking-links/:code/quote/lines/:lineId/photo` resolves the link like
the quote route, takes the job's current customer-readable quote, and finds
the line on it with a photo. Anything else is 404, the same as a line that
doesn't exist. It reads the file, sniffs it again, and sends it with the
sniffed type, `Content-Disposition: inline`, `X-Content-Type-Options:
nosniff` and `Cache-Control: private, no-store`.

## Screens
Staff: a hidden file input (`accept="image/jpeg,image/png,image/webp"`)
behind the drawn button; the upload goes to the job's files, then the draft
saves with the new `photoId`. The view dialog shows the photo, Replace photo
(the same picker) and Remove from line (saves with no `photoId`; the file
stays in Files and photos).
Customer: a 96x72 thumbnail button named "Photo of [line]: [reason] — open
larger photo", the magnifier badge and "Tap to enlarge"; a dialog titled with
the line, the reason under it, the photo, and Close.
