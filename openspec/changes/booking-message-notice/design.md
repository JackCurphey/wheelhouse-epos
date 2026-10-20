# Design
- `sendBookingMessage` returns `{ skipped: 'no_contact', name: TEMPLATES[key].name }` when `whyNotQueued` says no contact; the four routes add it to their replies as `bookingMessage`.
- `noMessageNote(reply, customer)` words the note; the request pop-up passes it to the diary through `onNotice`, the offer pop-up through `onOffered(note)`. The diary keeps one note, shown with the floating messages, until Close.
