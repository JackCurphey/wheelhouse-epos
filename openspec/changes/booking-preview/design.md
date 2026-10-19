# Design: Preview what the customer sees

## Words (booking-preview.ts, pure)

From the saved workshop settings:
- **Drop-off sentence:** the booking page's own `dropOffLine` rule, for the example booking at 11:30 with the Trek Domane AL 3. A set time: by 11:30 less `timedLeadMinutes` (not before 00:00), e.g. "Drop your Trek Domane AL 3 off by 11:00, half an hour before your booking at 11:30." The whole day (`bookingMode` `dropoff`): "Drop your Trek Domane AL 3 off between [start] and [end]." from the drop-off window.
- **Note:** `confirmationNote` follows in the same paragraph, as on the booking page; empty, nothing follows.
- **Service:** "Standard service · £65.00" with `showPricesOnline`, else "Standard service".
- **When:** "Thursday 17 September, 11:30" for a set time; "Thursday 17 September" for the whole day.

## Screen

A default-style "Preview" button under the note's hint opens a `Dialog` (the mode change pop-up's pattern) titled "What the customer sees" with the subtitle, the example card (a green "Booking confirmed" chip, the heading, the paragraph, three rows), the drawn note, and Close in the footer; the header's ✕ and Escape close it too. It reads the cached `['workshop-settings']`, so a change saved before opening shows; the note box saves when left, which pressing Preview does first.
