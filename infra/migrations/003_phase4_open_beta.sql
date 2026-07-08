-- Phase 4: v1.1 open beta — IAP, compliance, leaderboard, ops config

DO $$ BEGIN
  CREATE TYPE recharge_channel AS ENUM ('MOCK', 'APPLE_IAP', 'GOOGLE_PLAY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE recharge_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS self_excluded_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_remark TEXT,
  ADD COLUMN IF NOT EXISTS beta_migration_ack_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS has_completed_recharge BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS recharge_orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  channel recharge_channel NOT NULL,
  amount_chips BIGINT NOT NULL,
  bonus_chips BIGINT NOT NULL DEFAULT 0,
  fiat_amount_cents BIGINT,
  product_id VARCHAR(128),
  receipt_token TEXT,
  status recharge_status NOT NULL DEFAULT 'PENDING',
  reference_id VARCHAR(128) NOT NULL UNIQUE,
  meta_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recharge_orders_user ON recharge_orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS daily_recharge_stats (
  user_id BIGINT NOT NULL REFERENCES users(id),
  stat_date DATE NOT NULL,
  total_chips BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, stat_date)
);

INSERT INTO system_config (config_key, config_value) VALUES
  ('official_rake_rate', '0.05'),
  ('private_rake_rate', '0.03'),
  ('bot_daily_budget', '500000'),
  ('newbie_protection_enabled', 'false'),
  ('first_recharge_bonus_enabled', 'true'),
  ('first_recharge_bonus_pct', '50'),
  ('daily_recharge_limit', '50000'),
  ('leaderboard_refresh_minutes', '10'),
  ('beta_migration_active', 'false'),
  ('beta_migration_message', '{"zh-CN":"公测即将开始，内测筹码将清零并重新赠送100筹码。","en-US":"Open beta starts soon. Beta chips will reset; new players receive 100 chips."}')
ON CONFLICT (config_key) DO NOTHING;
