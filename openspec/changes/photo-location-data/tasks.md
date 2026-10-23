# Tasks

## 1. The cleaning module

- [x] 1.1 Write tests first (`tests/photo-metadata.test.js`) with small pictures built in the test: a JPEG with an Exif block holding GPS, a time, a camera make and Orientation 6, an XMP block and an ICC profile, which comes back with no GPS, time, make or XMP, Orientation 6 kept, the ICC profile and the picture data byte-for-byte the same; a JPEG with no Exif (unchanged); a PNG with eXIf, tEXt, zTXt and iTXt, which keeps its picture and colour chunks; a WebP (extended) with EXIF and XMP, which loses them, has its flags cleared and its size right; a PDF and random bytes unchanged; files cut short at each step refused, never thrown or hung. Watch each fail for the right reason
- [x] 1.2 Write `server/photo-metadata.js` (`removePhotoDetails`). Verify 1.1 passes

## 2. Where photos come in

- [x] 2.1 Write tests first: a booking request's photo with GPS is saved without it (booking photo tests, through the real route); a staff attachment with GPS is saved without it, and a PDF attachment is saved as sent, and a malformed JPEG attachment is refused in plain words (workshop attachment tests). Watch each fail for the right reason
- [x] 2.2 Run `removePhotoDetails` in `readBookingPhotos` and in the attachments route. Verify 2.1 passes and the existing booking-photo, attachment and quote-photo tests still pass
- [x] 2.3 Log the decisions (remove everything hidden; keep Orientation and colour; refuse a picture that can't be cleaned; nothing after the picture's end) in `docs/decisions/decided-while-building.md` (Jack's section)

## 3. Checks

- [ ] 3.1 `npm run lint`, `npm test` and `npm run test:browser` pass, then a fresh review and `/review` (public routes)

## Workflow follow-up

- Archive the change with `/opsx:archive` as the last commit of the pull request, before it merges.
