-- D1 schema for the QMods Telegram bot Worker.
-- This is ONLY the bot's own operational state (Cloudflare-side). It does
-- NOT duplicate QMods users/subscriptions/devices — those stay on qmods.ru
-- and are always read live through mod/api/bot.php and mod/admin/bot.php.
--
-- Apply with:
--   wrangler d1 execute qmods-telegram-bot --file=./schema.sql --remote

-- Per-chat conversation state (e.g. "waiting for the /link code",
-- "waiting for admin broadcast text"). One row per chat.
CREATE TABLE IF NOT EXISTS bot_state (
    chat_id     INTEGER PRIMARY KEY,
    awaiting    TEXT NOT NULL,      -- e.g. 'link_code', 'admin_search', 'admin_issue_days'
    payload     TEXT,               -- JSON blob with extra context (e.g. target username)
    updated_at  INTEGER NOT NULL
);

-- Simple sliding-window rate limiting (link attempts, admin broadcast spam,
-- general command flood). Defense in depth on top of the PHP-side
-- bot_link_attempts.json throttling in mod/api/bot.php.
CREATE TABLE IF NOT EXISTS rate_limits (
    key           TEXT PRIMARY KEY,  -- e.g. 'link:<chat_id>'
    count         INTEGER NOT NULL DEFAULT 0,
    window_start  INTEGER NOT NULL
);

-- Audit trail for admin actions taken through the bot (issue/remove/delete
-- subscription, broadcast/direct messages). Independent of qmods.ru's own
-- data/actions.log, so bot-originated actions are traceable from either side.
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_telegram_id   TEXT NOT NULL,
    action              TEXT NOT NULL,
    payload             TEXT,
    created_at          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log (created_at);
