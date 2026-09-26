-- Minimum notice and the shop's time zone (piece 10). A customer may book no
-- sooner than min_notice_minutes from now, and "now" and "today" are read on
-- the shop's own clock (time_zone, an IANA zone name) rather than UTC. Every
-- shop starts on two hours' notice in UK time. Additive only.
-- Spec: docs/superpowers/specs/2026-09-26-book-server-10-notice-timezone-design.md
ALTER TABLE workshop_settings
  ADD COLUMN min_notice_minutes INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'Europe/London';
