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

-- Every chat that has ever messaged/pressed a button on the bot, upserted on
-- every single update (handlers/router.ts handleUpdate) — regardless of
-- whether that chat is linked to a qmods.ru account. The ONLY purpose is
-- resolving a typed @username to a chat_id for the device-pairing-by-
-- username flow (see handlers/devicePair.ts, android-client/README.md
-- "Привязка по юзернейму") — Telegram bots cannot message a chat_id they've
-- never received an update from, so a username with no row here truly can't
-- be reached and the app is told to open the bot and press Start first.
CREATE TABLE IF NOT EXISTS telegram_users (
    chat_id     TEXT PRIMARY KEY,
    username    TEXT,             -- lowercase, no leading @; NULL if the account has none
    first_name  TEXT,
    last_seen   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_telegram_users_username ON telegram_users(username);

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

-- Dedupe/cooldown ledger for admin error alerts (see src/errorReport.ts).
-- One row per distinct error signature (where it happened + error name/
-- message + top stack frame, hashed) so a hot failure loop sends one
-- Telegram alert per cooldown window instead of flooding admins, while
-- still counting how many times it has actually fired.
CREATE TABLE IF NOT EXISTS error_alerts (
    signature      TEXT PRIMARY KEY,
    first_seen_at  INTEGER NOT NULL,
    last_seen_at   INTEGER NOT NULL,
    last_sent_at   INTEGER NOT NULL,
    count          INTEGER NOT NULL DEFAULT 1
);

-- Device-auth handshake for the native Android app (see src/db.ts,
-- src/handlers/devicePair.ts, README "Авторизация приложения через бота").
-- The app never sees a qmods.ru credential or the bot's own PHP token —
-- it only ever holds a device_token minted here, after the account owner
-- confirms the pairing by opening a Telegram deep link into this bot.
--
-- Short-lived pairing code shown/deep-linked by the app. Starts 'pending';
-- becomes 'claimed' (with device_token set) once the linked Telegram user
-- opens `t.me/<bot>?start=devicelink_<code>`. Codes are meant to expire
-- (10 minutes, enforced in code, not here) — stale rows are harmless
-- since a 'pending' row that outlives its TTL is simply never claimable.
-- `reason` is only set when status = 'rejected' (currently just
-- 'device_limit' — the account already has an active device_token, see
-- ONE_DEVICE_PER_ACCOUNT below). Existing databases need:
--   ALTER TABLE device_pairings ADD COLUMN reason TEXT;
CREATE TABLE IF NOT EXISTS device_pairings (
    code          TEXT PRIMARY KEY,
    status        TEXT NOT NULL DEFAULT 'pending', -- pending | claimed | rejected
    device_token  TEXT,
    reason        TEXT,
    created_at    INTEGER NOT NULL,
    claimed_at    INTEGER
);

-- Long-lived per-device secret, minted on a successful pairing claim.
-- Maps a device_token straight to a qmods.ru username — the Worker looks
-- this up on every `/device/subscription` call and asks mod/api/bot.php
-- for that username's subscription. No password, no session cookie, no
-- other qmods.ru credential ever touches the app.
CREATE TABLE IF NOT EXISTS device_tokens (
    token       TEXT PRIMARY KEY,
    username    TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    last_seen   INTEGER
);

-- One row per "Купить подписку" attempt (bot inline buttons or the Mini
-- App's "Оплата" tab) — see worker/src/yoomoney.ts and handlers/payment.ts.
-- `id` doubles as the ЮMoney Quickpay `label` param, so the webhook can map
-- an incoming HTTP-notification straight back to who/what/how-much without
-- trusting anything the notification itself claims about the order.
-- 'paid' is set exactly once (see markPaymentOrderPaid's guarded UPDATE) —
-- ЮMoney retries its notification until it gets HTTP 200, so this is the
-- idempotency guard against granting the same order's days twice.
CREATE TABLE IF NOT EXISTS payment_orders (
    id           TEXT PRIMARY KEY,
    telegram_id  TEXT NOT NULL,
    username     TEXT NOT NULL,
    plan_id      TEXT NOT NULL,
    plan_title   TEXT NOT NULL,
    days         INTEGER NOT NULL,
    amount       REAL NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending', -- pending | paid
    operation_id TEXT,
    created_at   INTEGER NOT NULL,
    paid_at      INTEGER
);
