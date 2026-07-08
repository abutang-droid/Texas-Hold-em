-- Phase 3: private rooms, system config, reports

CREATE TABLE IF NOT EXISTS private_rooms (
    room_code       VARCHAR(6) PRIMARY KEY,
    room_id         VARCHAR(16) NOT NULL UNIQUE,
    host_user_id    BIGINT NOT NULL REFERENCES users(id),
    max_seats       SMALLINT NOT NULL CHECK (max_seats BETWEEN 2 AND 9),
    small_blind     BIGINT NOT NULL CHECK (small_blind > 0),
    big_blind       BIGINT NOT NULL CHECK (big_blind > small_blind),
    buy_in_cap      BIGINT NOT NULL CHECK (buy_in_cap BETWEEN 10 AND 10000),
    status          VARCHAR(16) NOT NULL DEFAULT 'WAITING',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_private_rooms_host ON private_rooms (host_user_id);
CREATE INDEX idx_private_rooms_status ON private_rooms (status);

CREATE TABLE IF NOT EXISTS private_room_agreements (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    ip_address      VARCHAR(45) NULL,
    user_agent      TEXT NULL,
    agreed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_private_agreements_user ON private_room_agreements (user_id, agreed_at DESC);

CREATE TABLE IF NOT EXISTS system_config (
    config_key      VARCHAR(64) PRIMARY KEY,
    config_value    JSONB NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_config (config_key, config_value) VALUES
    ('private_room_enabled', 'true'),
    ('private_room_global_pause', 'false')
ON CONFLICT (config_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS report_tickets (
    id                  BIGSERIAL PRIMARY KEY,
    reporter_user_id    BIGINT NOT NULL REFERENCES users(id),
    reported_user_id    BIGINT NULL REFERENCES users(id),
    room_id             VARCHAR(16) NULL,
    hand_id             VARCHAR(32) NULL,
    category            VARCHAR(32) NOT NULL,
    description         TEXT NULL,
    status              VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_status ON report_tickets (status, created_at DESC);

CREATE TABLE IF NOT EXISTS risk_alerts (
    id              BIGSERIAL PRIMARY KEY,
    alert_type      VARCHAR(32) NOT NULL,
    user_id         BIGINT NULL REFERENCES users(id),
    room_id         VARCHAR(16) NULL,
    detail_json     JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_alerts_type ON risk_alerts (alert_type, created_at DESC);
