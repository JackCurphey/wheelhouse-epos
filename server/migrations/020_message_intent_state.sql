-- The messageIntent machine, on the table that already holds messages rather
-- than in a parallel one. customer_messages.status is free text that existing
-- code writes; it is left exactly as it is. intent_state is the constrained
-- column the new model uses, and Phase 3 is where sending starts writing it.
--
-- 'unknown' matters most here. A provider timeout is not a failure - the SMS
-- may well have gone - and recording it as one is how a customer receives the
-- same message three times.

ALTER TABLE customer_messages
  ADD COLUMN intent_state TEXT NOT NULL DEFAULT 'intended'
    CHECK (intent_state IN ('intended', 'sending', 'delivered', 'failed', 'unknown'));
