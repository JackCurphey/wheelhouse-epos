# Design: a customer's page

## Decisions

1. **One history call**, `GET /api/customers/:id/history`, returning
   `{ items: [...] }`, each `{ kind: 'job' | 'sale' | 'message', at, … }`
   with what its row shows, newest first; jobs carry their states so the
   screen says their stage as the diary does. A job is "open" while its
   booking stands and its bike isn't collected (walk-through 9 L5).
2. **Rows**: a job, "WH-1042", the work, its day and mechanic, its stage,
   opening it in the diary; a sale, "Sale [n]", its day and what was bought,
   its total (the till's figure, in pounds as the till keeps it); a message,
   "Text" or "Email", its name ("Bike ready"), its day and where it went.
   Sales and messages don't open anything yet.
3. **Eight rows show, then "Show all ([n])"** shows the rest.
4. **New job** goes to the diary with `?customer=[id]`, which opens New job
   with them chosen, as `?order=` does for an order.
5. **The page's address** is `/workshop/customers/[id]`, inside the staff frame,
   titled "Customers" as drawn.
