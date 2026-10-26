# A shop's own automatic messages, the screens

## Why

The screen half of owner setup decision 14 and stage 1 drawing gaps
decision 7. Settings › Messages gets "Your own messages", "+ Add your own
message", and the box drawn as `set-msg-new`. The server half is
`own-messages-server`; Jack's answers are in
`docs/decisions/2026-10-26-receipt-and-own-messages.md`.

**Risky area:** none. This is screens only, and calls the Owner's routes.

## What changes

- **Under Automatic messages**, a heading "Your own messages".
- **Each own message is a row:**
  - its name;
  - when it goes ("6 months after a job is collected · by email");
  - Edit;
  - On or Off.
- **"+ Add your own message"** opens the drawn box "Your own message", "Sent
  automatically", with:
  - Name;
  - "Send it": After a job is collected, Before a booked job, or After a
    sale;
  - "How long after" (or "before"), with Days or Months;
  - "Send by": Text, Email, or both;
  - the Wording, with its put-in buttons;
  - the drawn note;
  - Cancel and "Add the message".
- **Edit opens the same box** with Remove, Cancel and Save (Jack's answer 4).
- **A refusal from the server shows in the box.**
