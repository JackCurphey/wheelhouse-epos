# Design: booking search and "unavailable"

## Decisions

### 1. When the search box shows
- **More than 8 single jobs** (categories and "Other" together). Not drawn:
  the drawing shows five jobs and then a sixth as "[Individual service]",
  and 8 is about one phone screen of cards.
- **Where:** above the first single-job section, so it never pushes the full
  services down.
- **[n]** is the shop's number of single jobs.

### 2. Matching
- **Rule:** a job matches when its name contains every word typed, ignoring
  case; the words can come in any order.
- **Where it lives:** `matchesSearch(name, text)` in `service-selection.ts`,
  tested on its own.
- **Ticked jobs:** the search only hides cards. Ticks, the running summary
  and Continue read the draft as before, so a hidden tick stays.
- **Nothing matching:** a line in place of the single jobs (not drawn):
  "No single jobs match “[text]”."

### 3. The unavailable page
- **Where:** `BookFrame` already handles a failed services load. Only its
  words change: the heading becomes "Online booking is unavailable just
  now", followed by "Please try again in a little while, or call the shop to
  book."
- **Try again** stays: it was approved earlier, and it saves a reload.
- **The shop lines:** the drawing's shop name, address and phone come from
  the services that failed, so they can't show (logged).

### 4. Not drawn, or left out (logged)
- The threshold of 8.
- The no-match line.
- No "Show all" link.
- No shop lines on the unavailable page.
