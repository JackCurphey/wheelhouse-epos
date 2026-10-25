-- Customers sign in with a code sent by email (openspec/changes/customer-code-signin;
-- signing-in decision 5). A login made by a code has no password.
ALTER TABLE customer_logins ALTER COLUMN password_hash DROP NOT NULL;

-- The pretend sign-in provider's own records, as WorkOS keeps codes on its
-- side (design 2): each code per shop and email, valid 10 minutes, used once.
CREATE TABLE pretend_signin_codes (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT current_setting('app.current_shop_id')::int REFERENCES shops(id),
  email TEXT NOT NULL,
  code TEXT NOT NULL CONSTRAINT pretend_signin_codes_code_check CHECK (code ~ '^[0-9]{6}$'),
  wrong_tries INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One live code per email, so two asks at once can't leave two (review).
CREATE UNIQUE INDEX idx_pretend_signin_codes_live ON pretend_signin_codes(shop_id, email) WHERE used_at IS NULL;
ALTER TABLE pretend_signin_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pretend_signin_codes FORCE ROW LEVEL SECURITY;
CREATE POLICY pretend_signin_codes_shop_isolation ON pretend_signin_codes
  USING (shop_id = current_setting('app.current_shop_id')::int)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::int);
