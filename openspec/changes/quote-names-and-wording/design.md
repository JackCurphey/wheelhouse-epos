# Design

`customerQuote(result, jobId)` in `server/routes/portal.js` wraps the staff
serializer for both customer routes. It reads
`workshop_settings.show_sign_off_to_customers` and the job's mechanic and
customer names, and blanks `mechanicName` and every line's `decidedByName`
unless the switch is 1. `customerFirstName` is the first word of the
customer's name, for the drawn "Thanks, Maya". That adds the first name to
the booking link's no-sign-in quote reply, which carried no customer name
before; anyone holding the link (a 64-character code) sees it, as the drawing
intends (fresh review).

The card shows the mechanic's first name, as drawn ("Alex"), and the phone
answer's `decidedByName` in full, as drawn ("Jo Taylor"). The phone line adds
"at HH:MM" from the line's `decidedAt` when there is one. With no phone on
the shop, "Call [shop phone]" reads "Call the shop".

The staff dialogs call the customer by first name ("Record Maya’s answer"),
as drawn; the withdraw subtitle is the reference and full name. The withdraw
body keeps "Only the booked work stays agreed." where the drawing names the
booked service, since a job's title is free text.
