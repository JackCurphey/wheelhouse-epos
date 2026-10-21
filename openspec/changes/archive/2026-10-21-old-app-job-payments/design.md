# Design
- The refusal sits straight after the request body is read, before the cashier and before the sale. It applies whatever state the job's work is in, because only the old app sends no key.
- The old app redirects rather than refusing: its two entry points, `loadOrderIntoCart` and the order modal's Convert, check `doc.workshopJobId` first. Its own Complete sale on a job's order can no longer be reached, because the order never loads into its cart.
- The old app is a placeholder to be deleted (answer 2). Nothing new is built in it.
