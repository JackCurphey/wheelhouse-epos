# Design
- The link is a button under the Bike list, disabled until a customer is chosen.
- Open: a bordered box under the list with the four fields in two rows, an error line, and Cancel ("Cancel adding a bike" for screen readers) and Add bike.
- Add bike posts `{ make, model, colour, serialNumber }` to `POST /api/customers/:id/bikes`, refreshes the customer's bikes, chooses the new one and closes the box. Neither make nor model: "Enter a make or a model." A refusal shows the server's words.
