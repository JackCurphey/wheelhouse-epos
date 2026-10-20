# Design
- The diary reads `job` and `order` from the address once, then drops them with a replace, so going back or reloading doesn't open them again.
- `?job=<id>` sets the open job, as a click on its block does.
- `?order=<id>` reads the order and its customer, then opens New job in "Enter a time instead" form (the diary's day, its first hour, the freest mechanic) with `order` passed in. An order that can't be read shows the diary's notice instead.
- New job, once the job is saved (and booked in when the bike is here), sends `PUT /api/sale-documents/<id>` `{ workshopJobId }`. The job exists either way, so a refused link closes the form and shows the diary's notice: "The job is saved, but couldn't be linked to the order: …".
- The old app saves the order's title, customer and note before leaving, as its old form's save did.
