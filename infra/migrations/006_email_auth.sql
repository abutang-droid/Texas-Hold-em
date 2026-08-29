-- Email + password authentication

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_users_email ON users (LOWER(email)) WHERE email IS NOT NULL;
