# Design

Spec wording only. `queueMessage` is called with `UNDO_MS` for Quote to
approve and Bike ready, and without a delay for the booking messages
(`sendBookingMessage`, `server/routes/workshop.js`); the spec now says so.
