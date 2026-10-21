-- Confirming online bookings automatically (Book a repair decision 8, Jack,
-- 1 Oct; Jack, 19 Oct, docs/decisions/2026-10-19-auto-confirm.md): a shop
-- setting, off for every shop to start, and a mark on an online booking
-- confirmed straight away until staff open it ("New, booked online").
-- INTEGER 0/1, as show_prices_online (015). Additive only.
-- Spec: openspec/changes/auto-confirm/design.md
ALTER TABLE workshop_settings ADD COLUMN confirm_bookings_automatically INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workshop_jobs ADD COLUMN online_unseen INTEGER NOT NULL DEFAULT 0;
