-- The mechanic sign-off, piece 3 (Jack, 16 and 18 Oct,
-- docs/decisions/2026-10-16-mechanic-sign-off.md answer 3): whether the shop
-- shows customers who signed their job off ("Checked by [name]" on the
-- receipt and booking link). Off to start, and off at a real shop until the
-- solicitor's check. INTEGER 0/1, as show_prices_online (015). Additive only.
-- Spec: openspec/changes/sign-off-show-customers/design.md
ALTER TABLE workshop_settings ADD COLUMN show_sign_off_to_customers INTEGER NOT NULL DEFAULT 0;
