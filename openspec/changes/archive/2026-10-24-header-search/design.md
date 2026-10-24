# Design: the header search

## Decisions

1. **One call, `GET /api/search?q=`**, returning `{ jobs, customers }`, five
   of each: one request per typing pause, one count, a steady order. Jobs
   match `reference`, the customer's name or phone, or the bike's make and
   model, newest day first; customers match name, phone or email, active
   only, best match first (starts with, then contains). Two characters at
   least; the screen waits 250 ms after typing stops.
2. **Rows are links, not a list of options** (`staff-search`, 3 Oct: "a
   labelled list of rows, not a listbox"), so each row is reached with Tab
   and opens with Enter; nothing is chosen first. The older `cs-search-c2w`
   drew a listbox; the later one wins.
3. **A job row**: "WH-1042 · Maya Patel", then the bike, the job and its stage
   word and day ("Trek Domane AL 3 · Standard service · Expected · Thu 17
   Sep"), from the job's own fields (walk-through 9 H1 asks for the stage;
   its "approved £…" waits until quote totals are read here). **A customer
   row**: the name, then "Customer · [phone]" when they have one.
4. **Groups with nothing are left out**, and "Nothing matches “[q]”" when no
   group has anything (the till's words, `till.mjs` :602). The live line
   says "3 results" or "Nothing matches “[q]”".
5. **The box's words: "Search jobs and customers"** until orders and products
   are found too (the drawing's "Search jobs, customers, orders, products").
6. **Placement**: a 320 px box after the page title on a computer; below that
   a 44 px search button opening a sheet over the page (480 px at the top
   right on a tablet, the full top with a dimmed page on a phone), with Close
   search and Escape.
