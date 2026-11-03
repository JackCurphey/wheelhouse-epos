## Design

1. **Reaching the page.** Drawn in the sidebar "while the move is on" (decision 4), reached from Getting started. Getting started isn't built (WP-5.1), so until then the page is in the Owner's sidebar, after Today. `ROOMS` stays as drawn for everyone (the test against `diary.mjs` still holds); `roomsFor` adds it for the Owner. Only the Owner: others get a sentence, as the Owner's other pages do.

2. **Which board shows.** Nothing sent: `mv-start`. A file being sent, one still coming across, or a problem to deal with: `mv-progress`. Otherwise `mv-summary`. So leaving and coming back lands on the right board. A file refused isn't stored, so its row lasts while the page is open.

3. **Sending.** One file at a time. A send with no answer goes once more with the same key, so it can't count twice. Over 30 MB isn't sent, and reads as can't read. 422 is "Couldn't read it"; any other failure is "Not sent", so nobody hunts for a fault in a good file.

4. **Rows.** A refused file's row is named after the file, because Wheelhouse can't say which of the five kinds an unreadable file was. Barcodes count under Products. Products' number on the summary is the price list's, since a barcode isn't a product.

5. **What's drawn but waits.** Customers, Sales and Workshop jobs stay as rows, with a grey "Later", so the drawn list keeps its shape. Customers change in the next pull request. Next: run alongside, Look at the [n] and Ask us to help aren't shown until they do something. The stages show Bring your data as Now and the others Later, not as links, as nothing is there yet.

6. **More files from the summary.** The summary has no drop zone as drawn, but someone may have sent only some files. It gets the Weekly refresh card's slim zone, "Drop more files here".
