-- Phase 1 core schema (MySQL 8.0)
CREATE TABLE IF NOT EXISTS users (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    account_type    ENUM('GUEST','REGISTERED') NOT NULL DEFAULT 'GUEST',
    oauth_provider  ENUM('APPLE','GOOGLE','FACEBOOK') NULL,
    oauth_sub       VARCHAR(128) NULL,
    device_id       VARCHAR(128) NULL,
    nickname        VARCHAR(32) NOT NULL,
    avatar_url      VARCHAR(512) NULL,
    chips_balance   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_exp       INT UNSIGNED NOT NULL DEFAULT 0,
    level           SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    private_room_permission TINYINT(1) NOT NULL DEFAULT 0,
    status          ENUM('ACTIVE','FROZEN','BANNED') NOT NULL DEFAULT 'ACTIVE',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_oauth (oauth_provider, oauth_sub),
    KEY idx_device (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chip_transactions (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED NOT NULL,
    amount          BIGINT NOT NULL,
    balance_after   BIGINT UNSIGNED NOT NULL,
    type            ENUM('RECHARGE','EVENT_GIFT','RAKE','GAME_WIN','GAME_LOSS','PRIVATE_FEE','BUY_IN','CASH_OUT','ADMIN_ADJUST') NOT NULL,
    reference_id    VARCHAR(64) NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_user_time (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hand_histories (
    hand_id         VARCHAR(32) PRIMARY KEY,
    room_id         VARCHAR(16) NOT NULL,
    room_type       ENUM('OFFICIAL','PRIVATE') NOT NULL,
    pot_size        BIGINT UNSIGNED NOT NULL,
    rake_amount     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    winners_json    JSON NOT NULL,
    actions_json    JSON NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_room_time (room_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
