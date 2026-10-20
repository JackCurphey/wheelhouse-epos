# Design
- The diary reads `job` and `order` from the address once, then drops them with a replace, so going back or reloading doesn't open them again.
- `?job=<id>` reads the job and opens it as a click on its block does: an offered time opens its request pop-up.
- `?order=<id>` reads the order and its customer, then waits for the mechanics, opening hours and jobs to load before opening New job in "Enter a time instead" form (the diary's day, its first hour, the freest mechanic) with `order` passed in. An order that can't be read, or isn't open, shows the diary's notice instead; one already linked opens its job. Both are checked before any job is made, as the order refuses a link only after.
- New job, once the job is saved, books it in when the bike is here and sends `PUT /api/sale-documents/<id>` `{ workshopJobId }`. The job exists from the save on, so a refused book-in or link no longer leaves the form open (a second Save would make a second job): the form closes and the diary's notice says what didn't happen. This applies to every New job, not only an order's.
- The old app saves the order's title, customer and note before leaving, as its old form's save did.
