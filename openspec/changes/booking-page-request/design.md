# Design: the request page

- `pending.tsx`: the drawn shell (eyebrow, card, rows, shop's name, buttons) now covers `awaiting_confirmation` too. Its heading is "Your booking request"; its badge purple "Waiting for the shop to confirm"; the drawing's "We'll send you a text when the shop confirms." becomes "Please wait for the shop to confirm before bringing your bike in. Check this page to see when it does." (no texts are sent yet).
- Buttons: Change the date (`canChange`), Cancel request (`canCancel`). With both offered, no contact line.
- `CancelBooking` takes a `request` flag: title "Cancel this request?", buttons Keep my request / Cancel request; the rest as before.
- `ChangeDate` takes a `request` flag: the note "Your request moves to the new date straight away; the shop still needs to confirm it." and the button "Move my request", since the server moves an unconfirmed booking at once (piece 12). The reply replaces the cached link; the page shows the request at its new date.
