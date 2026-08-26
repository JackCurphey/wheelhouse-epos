-- Customer online booking portal: a second, parallel account system for
-- customers (as opposed to staff), plus a 'pending' workshop_jobs status for
-- bookings a mechanic hasn't reviewed yet.
--
-- customer_logins/customer_sessions mirror the shape of logins/sessions
-- (see auth.js) and carry no shop_id/RLS for the same reason: resolving
-- "which shop does this session belong to" has to happen before any shop
-- context exists. Unlike staff logins.email (globally unique across every
-- shop), customer_logins.email is unique only PER SHOP - the same person
-- can legitimately be a customer at two unrelated shops running this
-- software, so there's no reason to block that the way staff accounts do.

CREATE TABLE customer_logins (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_customer_logins_email_per_shop ON customer_logins(shop_id, email);

CREATE TABLE customer_sessions (
  token TEXT PRIMARY KEY,
  customer_login_id INTEGER NOT NULL REFERENCES customer_logins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- workshop_jobs.status is plain TEXT (no CHECK constraint) - 'pending' is
-- validated in application code (server.js's JOB_STATUSES), same as every
-- other status value already is. Nothing to alter here; noted for the
-- migration history's sake.
