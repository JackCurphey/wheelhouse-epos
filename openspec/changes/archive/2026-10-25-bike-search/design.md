# Design: finding a bike in the header search

## Decisions

1. **The server.** `bikes` is a third list in `/api/search`, five at most.
   - **Matched on:** make and model together ("trek domane"), or the frame
     number, as plain text: a % or _ is just that character.
   - **Also returned:** the owner's name, to show on the row.
   - **Excluded:** removed bikes, and bikes whose owner was removed.
   - **Order:** a frame number that starts with what was typed comes first;
     then by make and model.
   - Fewer than two characters still returns empty lists, now
     `{ jobs: [], customers: [], bikes: [] }`.
2. **The screen.** A "Bikes" group after Customers.
   - **Not drawn:** the drawing (`staff-search`, `app-map.mjs:52-66`) has
     Jobs, Orders, Customers and Products, and no Bikes group. The row
     copies the Customers row.
   - **The row:** the bike's name links to `/workshop/bikes/[id]`. Under it:
     "[Owner] · [Colour] · [Frame number]", leaving out what's blank.
3. **The box's name** becomes "Search jobs, customers and bikes". It follows
   the pattern of naming what is built so far, which the drawing's "Search
   jobs, customers, orders, products" also uses. Logged in
   `decided-while-building.md`.
