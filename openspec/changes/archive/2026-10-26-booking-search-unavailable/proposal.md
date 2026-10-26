# Booking: a search over a shop's single jobs, and "Online booking is unavailable"

## Why

Two booking screens are drawn but not built:
- **`bk-service-many`:** a shop with many single jobs gets a search box above
  them.
- **`bk-unavailable`:** when booking can't load, the page says "Online booking
  is unavailable just now" and to call the shop. Today it says "We couldn't
  load this shop's services", which is a computer's view of the problem, not
  the customer's.

They're in this week's overnight queue (Jack, 25 Oct: "work that needs no
input").

## What changes

- **The search box.** On the service list (`/book/:shopSlug/services`), when
  a shop has more than 8 single jobs, a search box sits above them:
  - placeholder "Search [n] individual services — like “brakes” or
    “puncture”";
  - it narrows the single jobs as the customer types;
  - full services always show;
  - a ticked job stays ticked when the search hides it.
- **The unavailable page.** When the shop's services can't load (anything but
  "not found"), the heading is "Online booking is unavailable just now",
  with "Please try again in a little while, or call the shop to book." "Try
  again" stays.

## Not changing

- **"We can't find this shop"** for a wrong address stays as it is.
- **The drawn "Show all [n] individual services" link** isn't built: the
  built list already shows every job, and the search narrows it.
- **The drawn shop name, address and phone** can't show on the unavailable
  page. They come with the services that failed to load (logged).

## Drawings and decisions

- `bk-service-many` and `bk-unavailable` in
  `docs/design/user-journeys/generator/book.mjs`.
- Book a repair decision 5: every service at once.
- Fewest clicks: typing narrows the list straight away, with no search button.
