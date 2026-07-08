-- Phase 1 core schema (PostgreSQL 16)
-- Requires: PostgreSQL 14+

CREATE TYPE account_type AS ENUM ('GUEST', 'REGISTERED');
CREATE TYPE oauth_provider AS ENUM ('APPLE', 'GOOGLE', 'FACEBOOK');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'FROZEN', 'BANNED');
CREATE TYPE chip_tx_type AS ENUM (
  'RECHARGE', 'EVENT_GIFT', 'RAKE', 'GAME_WIN', 'GAME_LOSS',
  'PRIVATE_FEE', 'BUY_IN', 'CASH_OUT', 'ADMIN_ADJUST'
);
CREATE TYPE room_type AS ENUM ('OFFICIAL', 'PRIVATE');

CREATE TABLE users (
    id                      BIGSERIAL PRIMARY KEY,
    account_type            account_type NOT NULL DEFAULT 'GUEST',
    oauth_provider          oauth_provider NULL,
    oauth_sub               VARCHAR(128) NULL,
    device_id               VARCHAR(128) NULL,
    nickname                VARCHAR(32) NOT NULL,
    avatar_url              VARCHAR(512) NULL,
    chips_balance           BIGINT NOT NULL DEFAULT 0 CHECK (chips_balance >= 0),
    total_exp               INTEGER NOT NULL DEFAULT 0 CHECK (total_exp >= 0),
    level                   SMALLINT NOT NULL DEFAULT 1 CHECK (level >= 1),
    preferred_locale        VARCHAR(10) NOT NULL DEFAULT 'en-US',
    private_room_permission BOOLEAN NOT NULL DEFAULT FALSE,
    private_room_permission_at TIMESTAMPTZ NULL,
    status                  user_status NOT NULL DEFAULT 'ACTIVE',
    settings_json           JSONB NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_oauth UNIQUE (oauth_provider, oauth_sub),
    CONSTRAINT chk_preferred_locale CHECK (preferred_locale IN ('zh-CN', 'en-US'))
);

CREATE INDEX idx_users_device ON users (device_id);
CREATE INDEX idx_users_status ON users (status);

CREATE TABLE chip_transactions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    amount          BIGINT NOT NULL,
    balance_after   BIGINT NOT NULL CHECK (balance_after >= 0),
    type            chip_tx_type NOT NULL,
    reference_id    VARCHAR(64) NULL,
    meta_json       JSONB NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chip_tx_user_time ON chip_transactions (user_id, created_at DESC);
CREATE INDEX idx_chip_tx_type ON chip_transactions (type);
CREATE INDEX idx_chip_tx_ref ON chip_transactions (reference_id);

CREATE TABLE hand_histories (
    hand_id         VARCHAR(32) PRIMARY KEY,
    room_id         VARCHAR(16) NOT NULL,
    room_type       room_type NOT NULL,
    pot_size        BIGINT NOT NULL CHECK (pot_size >= 0),
    rake_amount     BIGINT NOT NULL DEFAULT 0 CHECK (rake_amount >= 0),
    board_cards     VARCHAR(20) NULL,
    winners_json    JSONB NOT NULL,
    actions_json    JSONB NOT NULL,
    player_snapshot JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hand_room_time ON hand_histories (room_id, created_at DESC);
CREATE INDEX idx_hand_type_time ON hand_histories (room_type, created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
