-- Caribbean Stud (player vs dealer) open-hand persistence
CREATE TABLE IF NOT EXISTS stud_hands (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    status          VARCHAR(24) NOT NULL,
    ante            BIGINT NOT NULL CHECK (ante > 0),
    raise_amount    BIGINT NOT NULL DEFAULT 0,
    player_cards    JSONB NOT NULL,
    dealer_cards    JSONB NOT NULL,
    community       JSONB NOT NULL,
    remaining       JSONB NOT NULL,
    result_json     JSONB NULL,
    chips_balance   BIGINT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at      TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_stud_hands_user_open
  ON stud_hands (user_id, created_at DESC)
  WHERE status = 'DECISION';
