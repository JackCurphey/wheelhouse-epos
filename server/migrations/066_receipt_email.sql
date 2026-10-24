-- Emailing a receipt (leftover screens review 1-3, docs/decisions/2026-10-02-leftover-screens-review.md;
-- Jack, 23 Oct, docs/decisions/2026-10-23-overnight-questions.md answer 3;
-- openspec/changes/receipt-email). A receipt goes to the address typed, for
-- that receipt only, so a message can have no customer; and it says which
-- sale it's for. 063 is left for sales in pence (#404), 065 for Your settings
-- (#442). Additive only.
ALTER TABLE customer_messages ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE customer_messages ADD COLUMN sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL;
CREATE INDEX idx_customer_messages_sale ON customer_messages(shop_id, sale_id) WHERE sale_id IS NOT NULL;
