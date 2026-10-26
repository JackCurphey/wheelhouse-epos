# Design: a shop's own messages, the screens

## 1. Where

- **Component:** `OwnMessages` in `src/screens/settings/own-messages.tsx`,
  rendered at the end of `AutomaticMessages`.
- **Data:** it reads `GET /api/own-messages` with React Query, under the key
  `['own-messages']`.

## 2. The rows

- **Each row follows the built-in rows** (`row` in `messages-settings.tsx`):
  - the name;
  - when it goes;
  - Edit;
  - the On/Off button, which sends the whole message back with `enabled`
    flipped, as `PUT` takes the whole message.
- **The "when" line:** "[n] [days|months] [after a job is collected | before
  a booked job | after a sale] · by text | by email | by text or email".
  Singular for 1 ("1 month").
- **The heading and note** match "Bringing customers back": "Your own
  messages", then the drawn note.

## 3. The box

- **Built with the same `Dialog` parts** as `EditMessage`.
- **Starting values** (as drawn): After a job is collected, Months, Email.
  The number starts empty, so the shop chooses it.
- **The label** reads "How long before" when "Before a booked job" is
  chosen; otherwise "How long after".
- **Text and Email** are toggle buttons (`aria-pressed`), as drawn.
- **Put-in buttons:** the drawn seven, putting the tap-in where the cursor
  is, as `EditMessage` does.
- **No preview:** none is drawn for this box.
- **Saving:**
  - the add box sends `POST`; Edit sends `PUT`;
  - Remove sends `DELETE`;
  - a 400 shows the server's words in the box, and the box stays open;
  - any other failure shows "Wheelhouse couldn’t save that. Try again in a
    moment."

## 4. Not drawn, decided here (logged)

- The row's "when" line.
- The Edit box's Remove and Save.
- "How long before".
- No preview.
