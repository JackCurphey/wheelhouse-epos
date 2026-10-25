# Design: the Services room

## Decisions

1. **The closest built pattern is Checklists** (`checklists-settings.tsx`).
   The new room copies its shape:
   - rows with Edit and an outlined Remove, always showing;
   - a Dialog box with Cancel and Save;
   - the same refusal wording;
   - a summary hook.

   The drawing hides Edit and Remove until hover on a desktop. Checklists,
   the built pattern, always shows them; logged.
2. **The groups are the two kinds,** `full` and `individual`. The pills
   choose which kind's services show, starting on Full service. Retired
   services (`active: false`) aren't listed.
3. **A new service** opens the same box empty:
   - its title is "New service" (not drawn; Checklists' box says "New
     checklist");
   - its group is the pill that was chosen;
   - "Customers can book this online" is on.

   The server leaves a service off if that field isn't sent, so the screen
   always sends it.
4. **Save sends** name, kind, minutes, price and bookableOnline. Anything
   else (category, questions, includes, position) is left out, so the server
   keeps what is stored (`readServicePlacement`, `readQuestionsOrKeep`). An
   empty time is sent as empty (no time). A refusal shows the server's own
   words in the box.
5. **Remove** calls `DELETE /api/workshop-services/:id`, which retires the
   service. It doesn't ask first, as Checklists' Remove doesn't; nothing is
   lost, because the server only switches the service off. Logged.
6. **After a save or a remove,** `['workshop-services']` is refreshed, so
   New job, Checklists and the booking page read it again.

## Contract

Only existing routes: `GET`, `POST`, `PUT` and `DELETE` on
`/api/workshop-services`, which are Owner-only. Settings is Owner-only too.
