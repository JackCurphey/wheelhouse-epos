# Design

1. **`EmailReceiptDialog`**, with no customer on the sale, shows the drawn
   tick (`tick()`, `collect.mjs:233`) under the box, starting unticked.
2. **Sent with the tick** moves the pop-up to its second step: "Add a
   customer", with "Receipt sent to [to]" and the drawn fields. Name is
   focused. Email is filled with the address it went to. Phone is optional.
   The offers tick sits on the right, unticked.
3. **Add the customer** posts `{ name, email, phone, marketingPermission }`
   to `/api/customers`. A refusal (no name, say) shows in the pop-up. On
   success the till carries on as after a sent receipt (`onSent`).
4. **Not now** carries on the same way and posts nothing.
5. The countdown stays paused through both steps (the pop-up is still open).
