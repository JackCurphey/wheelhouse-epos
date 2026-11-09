# Design

## 1. Which products are bikes (`server/lib/bikes.js`; not drawn)

`isBike(category)`: true when any part of the product's category path ends in the word "bike" or "bikes", ignoring capitals: "Bikes", "Road bikes", "Bikes › E-bikes", "Kids’ bikes". "Bike parts" and "Bike lights" are not. One function; a product sends it as `isBike` (`serializeProduct`), so the receive screen asks for frames by the same rule the server checks. Logged for Jack to overrule.

## 2. Frames (migration 125)

`stock_frames`: `id`, `shop_id` (the business's own, row-level security as 122's table), `product_id` (`(product_id, shop_id)` referencing `products`), `site_id` (the shop it's at), `frame_number` (as typed or scanned, trimmed, up to 60 characters), `frame_key` (capitals, spaces taken out: what is compared), `state` (`in_stock`, `held` or `sold`), `delivery_id`, `delivery_line_id`, `stock_movement_id` (the received line it came in on), `received_by_name`, `received_at`; and for later, empty until the till sells one: `sold_at`, `customer_id`, `customer_bike_id`. A unique index on `(shop_id, frame_key)` where the state isn't `sold`: no frame is in stock twice, and two deliveries booking the same frame at once can't both win. Additive and safe to run twice.

**How a sold bike carries it (for WP-3.1 and WP-3.2):** the till's "Which one?" (`till-serial`) picks an in-stock frame of the product being sold; selling sets `state = 'sold'`, `sold_at`, `customer_id`, and makes or finds the customer's bike (`customer_bikes`, `serial_number` = the frame number, make and model from the product), whose id goes in `customer_bike_id`. The warranty reads the frame's `sold_at`. Held for Cycle to Work sets `held` (its piece adds who it's held for).

## 3. Booking in (`POST /api/deliveries/receive`; `bookIn`)

- Each item may send `frames`, a list of frame numbers. For a bike, the route that the screen uses requires them: one per bike booked in ("Each bike needs its frame number: [Bike name]"), each 1–60 characters, none twice in the delivery, none in stock already: "Frame [number] is already in stock — booked in [date]". A product that isn't a bike with frames is refused ("Only a bike has frame numbers").
- Inside the booking's transaction, after its stock line: one `stock_frames` row per frame, at the booking's shop (the computer's, or the business's oldest, as stock lines), with the delivery, the delivery line, the stock line and who. A clash with a frame booked at the same moment answers 409 with the same words.
- The old app's `POST /api/purchase-orders/:id/receive` (a placeholder to delete) records none.
- Set aside (damaged or wrong) bikes aren't booked in, so their frames aren't sent: the screen sends the first frames scanned for the bikes booked in, and the last scanned as the ones set aside (section 5).

## 4. Reading them

- `GET /api/stock-frames/check?number=` (anyone with the page, as receiving): `{ inStock: { frameNumber, productName, bookedInAt } | null }`, for the box's warning before booking in.
- `GET /api/products/:id` adds, for a bike, `frames`: each `{ id, frameNumber, state, bookedInAt, supplierName, deliveryId }`, in stock first, then held, then sold, newest first in each. Each stock line in `history` gains `delivery: { id, supplierName } | null` (the supplier as the delivery kept it) and `frames` (how many frames came in on it, for a bike).
- `GET /api/stock-list` adds `framesInStock` to a bike's row.

## 5. The screens

- **Receiving** (`receive-page.tsx`, `frame-number.tsx`): `take(p)` for a bike opens "Frame number" (`rs-frame`): "[Bike name] · bike [n] in this delivery", a scan box "Scan the sticker on the frame, or type it", the note "Scanning the sticker counts the bike straight away. A typed number needs “Count this bike”." and "Each bike is then known by its frame number — the till picks it at the sale, and its warranty starts from the right bike."; Cancel and Count this bike. Enter (a scanner presses it) counts as Count this bike does. Before counting, the frame is checked against the delivery and `GET /api/stock-frames/check`; one in stock shows `rs-frame-dup`'s alert, "This frame number is already in stock — booked in [date]. Check the sticker, or scan the next bike.", and one already scanned here "This frame number is already in this delivery." The line keeps `frames` and reads "[Supplier code] · Frame [a] · Frame [b]" (`rs-receive-marked`). A bike's count isn't typed or stepped up ("Scan each bike for its frame number" under it); stepping down takes off the last frame. Book in sends each bike line's first (count − set aside) frames.
- **A bike's page** (`product-page.tsx`, `st-product-bike`): above the history, "Bikes by frame number", one row each: "Frame [frame number]" (mono) with an In stock tag and "Booked in [date] from [Supplier]". With none: "No bikes in stock yet. Each bike's frame number is recorded when it's booked in." A received line in the history reads "Received · delivery from [Supplier]" (or "Booked in · delivery from [Supplier]" off an order) linking to the delivery, and for a bike "[n] frame numbers" in its detail.
- **Stock** (`st-list`): a bike's line reads "[Category] · [n] bikes, each by frame number".
