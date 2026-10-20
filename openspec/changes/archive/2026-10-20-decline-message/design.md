# Design: declining with a message

## Contract

- `POST /api/workshop-jobs/:id/decline` `{ version, message? }`: unchanged without `message`. With it: a string, trimmed, up to 1,000 characters (400 "The message can be up to 1,000 characters"; not text, 400 "The message must be text"). Saved as `workshop_jobs.decline_message` (migration 047, TEXT, null for none) in the same request as the decline.
- The booking link (`GET …/booking-links/:code`) gains `declineMessage`: the message while the stage is `declined`, else null.

## Staff (request-dialog.tsx)

The new booking request's Decline opens the drawn step instead of the one-line question: bold "Explain what the customer can do next"; "Message to [first name]" (4 rows, up to 1,000 characters) started as "Sorry, we can't fit this service in on [weekday]. Please try another day, or call us and we'll help find one." ([weekday] the day asked for; the drawing's own example named another day for the shop to suggest, which the shop now types itself); the note "Declining releases the request's reservation. The customer is told not to travel for this request."; "Decline & notify customer" (danger) posts the decline with the message; "Keep request" goes back. The customer sees the message on their booking page (texts wait for the messages engine).

## Customer (pending.tsx)

`declined`: eyebrow "Not booked"; heading "Sorry, we can't fit this booking in"; "A message from [shop]:" and the message as a quote, when there is one; "Nothing is booked."; a "Choose another date" link to the shop's booking start (the drawing's "— we've kept your details" is left off: the booking flow doesn't keep them); the shop's name.
