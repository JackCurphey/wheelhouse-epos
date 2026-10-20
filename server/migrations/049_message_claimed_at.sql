-- When the messages engine's timer claimed a message for sending (the messages
-- engine, fresh review): a send that never finished is moved to unknown five
-- minutes after its claim, not after its send time, so a message that waited
-- is never mistaken for a stuck one. Null until claimed. Additive only.
-- Spec: openspec/changes/messages-engine/design.md
ALTER TABLE customer_messages ADD COLUMN claimed_at TIMESTAMPTZ;
