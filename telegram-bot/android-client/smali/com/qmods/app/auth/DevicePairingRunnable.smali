.class public Lcom/qmods/app/auth/DevicePairingRunnable;
.super Ljava/lang/Object;
.source "DevicePairingRunnable.java"
.implements Ljava/lang/Runnable;

# The actual pairing flow, run on a background thread by
# DevicePairing.startPairing(). See that class for the public entry point.

.field private final context:Landroid/content/Context;

.field private final callback:Lcom/qmods/app/auth/PairingCallback;

.field private final handler:Landroid/os/Handler;

# Null/empty = classic flow (open the devicelink_ deep link in Telegram).
# Non-empty = "no Telegram on this phone" flow — notify this Telegram
# @username instead of opening a link, see DevicePairing.startPairingByUsername().
.field private final username:Ljava/lang/String;

.method public constructor <init>(Landroid/content/Context;Lcom/qmods/app/auth/PairingCallback;Ljava/lang/String;)V
    .locals 2
    .param p1, "context"    # Landroid/content/Context;
    .param p2, "callback"    # Lcom/qmods/app/auth/PairingCallback;
    .param p3, "username"    # Ljava/lang/String;

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/qmods/app/auth/DevicePairingRunnable;->context:Landroid/content/Context;

    iput-object p2, p0, Lcom/qmods/app/auth/DevicePairingRunnable;->callback:Lcom/qmods/app/auth/PairingCallback;

    iput-object p3, p0, Lcom/qmods/app/auth/DevicePairingRunnable;->username:Ljava/lang/String;

    new-instance v0, Landroid/os/Handler;

    invoke-static {}, Landroid/os/Looper;->getMainLooper()Landroid/os/Looper;

    move-result-object v1

    invoke-direct {v0, v1}, Landroid/os/Handler;-><init>(Landroid/os/Looper;)V

    iput-object v0, p0, Lcom/qmods/app/auth/DevicePairingRunnable;->handler:Landroid/os/Handler;

    return-void
.end method

# 1. POST /device/pair/start -> {code, deep_link}
# 2. hand code+deepLink to the callback, open Telegram on the deep link
# 3. poll GET /device/pair/status?code=... every ~2.5s for up to ~5 minutes
# 4. on "claimed": save device_token, call onPaired(); on "expired"/timeout:
#    call onFailed() with a short reason code.
#
# Each poll attempt has its own try/catch: a single transient exception
# (typically the network flapping right as the user switches back from
# Telegram to this app) no longer aborts the whole flow — it's logged and
# the loop just tries again next tick. Only 5 CONSECUTIVE failed attempts
# in a row give up with "network_error"; any successful attempt (even one
# that just reports "pending") resets the consecutive-failure count. An
# exception during the one-shot /pair/start call still fails immediately —
# there's no loop to retry within yet.
#
# NOTE: this method's URL literals must match wherever you deployed the
# Cloudflare Worker (see telegram-bot/worker/wrangler.toml PUBLIC_URL) —
# update both occurrences below if it differs from the QMods default.
.method public run()V
    .locals 13

    :try_start
    const-string v1, "https://update.qmurzik7.workers.dev/device/pair/start"

    invoke-static {v1}, Lcom/qmods/app/auth/Http;->post(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v2

    new-instance v3, Lorg/json/JSONObject;

    invoke-direct {v3, v2}, Lorg/json/JSONObject;-><init>(Ljava/lang/String;)V

    const-string v4, "success"

    const/4 v5, 0x0

    invoke-virtual {v3, v4, v5}, Lorg/json/JSONObject;->optBoolean(Ljava/lang/String;Z)Z

    move-result v6

    if-nez v6, :start_ok

    const-string v7, "start_failed"

    invoke-direct {p0, v7}, Lcom/qmods/app/auth/DevicePairingRunnable;->postFailed(Ljava/lang/String;)V

    return-void

    :start_ok
    const-string v7, "code"

    invoke-virtual {v3, v7}, Lorg/json/JSONObject;->getString(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v8

    const-string v7, "deep_link"

    invoke-virtual {v3, v7}, Lorg/json/JSONObject;->getString(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v9

    invoke-direct {p0, v8, v9}, Lcom/qmods/app/auth/DevicePairingRunnable;->postCodeReady(Ljava/lang/String;Ljava/lang/String;)V

    iget-object v1, p0, Lcom/qmods/app/auth/DevicePairingRunnable;->username:Ljava/lang/String;

    if-eqz v1, :classic_flow

    invoke-virtual {v1}, Ljava/lang/String;->isEmpty()Z

    move-result v2

    if-nez v2, :classic_flow

    # "No Telegram on this phone" flow — ask the server to notify this
    # @username instead of opening a deep link. Any exception here (bad
    # username encoding, network) falls through to :catch_start_failed
    # below, same as a classic-flow failure — only a parsed {success:false}
    # response gets its own specific reason via postFailed.
    new-instance v2, Ljava/lang/StringBuilder;

    invoke-direct {v2}, Ljava/lang/StringBuilder;-><init>()V

    const-string v3, "https://update.qmurzik7.workers.dev/device/pair/notify-username?code="

    invoke-virtual {v2, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2, v8}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    const-string v3, "&username="

    invoke-virtual {v2, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    const-string v3, "UTF-8"

    invoke-static {v1, v3}, Ljava/net/URLEncoder;->encode(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object v4

    invoke-virtual {v2, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    const-string v3, "&device="

    invoke-virtual {v2, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    sget-object v4, Landroid/os/Build;->MODEL:Ljava/lang/String;

    const-string v3, "UTF-8"

    invoke-static {v4, v3}, Ljava/net/URLEncoder;->encode(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object v4

    invoke-virtual {v2, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v3

    invoke-static {v3}, Lcom/qmods/app/auth/Http;->post(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v4

    new-instance v5, Lorg/json/JSONObject;

    invoke-direct {v5, v4}, Lorg/json/JSONObject;-><init>(Ljava/lang/String;)V

    const-string v3, "success"

    const/4 v6, 0x0

    invoke-virtual {v5, v3, v6}, Lorg/json/JSONObject;->optBoolean(Ljava/lang/String;Z)Z

    move-result v6

    if-nez v6, :username_notify_ok

    const-string v3, "error"

    const-string v6, "telegram_not_started"

    invoke-virtual {v5, v3, v6}, Lorg/json/JSONObject;->optString(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object v3

    invoke-direct {p0, v3}, Lcom/qmods/app/auth/DevicePairingRunnable;->postFailed(Ljava/lang/String;)V

    return-void

    :username_notify_ok
    goto :continue_after_start

    :classic_flow
    invoke-direct {p0, v9}, Lcom/qmods/app/auth/DevicePairingRunnable;->openTelegram(Ljava/lang/String;)V

    :continue_after_start
    :try_end
    .catch Ljava/lang/Exception; {:try_start .. :try_end} :catch_start_failed

    const/4 v10, 0x0

    const/4 v12, 0x0

    :poll_loop
    const/16 v1, 0x78

    if-lt v10, v1, :poll_continue

    const-string v7, "timeout"

    invoke-direct {p0, v7}, Lcom/qmods/app/auth/DevicePairingRunnable;->postFailed(Ljava/lang/String;)V

    return-void

    :poll_continue
    const-wide/16 v0, 0x9c4

    invoke-static {v0, v1}, Ljava/lang/Thread;->sleep(J)V

    :poll_try_start
    new-instance v1, Ljava/lang/StringBuilder;

    invoke-direct {v1}, Ljava/lang/StringBuilder;-><init>()V

    const-string v2, "https://update.qmurzik7.workers.dev/device/pair/status?code="

    invoke-virtual {v1, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v1

    invoke-virtual {v1, v8}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v1

    invoke-virtual {v1}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v2

    invoke-static {v2}, Lcom/qmods/app/auth/Http;->get(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v3

    new-instance v4, Lorg/json/JSONObject;

    invoke-direct {v4, v3}, Lorg/json/JSONObject;-><init>(Ljava/lang/String;)V

    const-string v5, "status"

    const-string v6, ""

    invoke-virtual {v4, v5, v6}, Lorg/json/JSONObject;->optString(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object v11

    const-string v5, "claimed"

    invoke-virtual {v5, v11}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z

    move-result v6

    if-eqz v6, :check_expired

    const-string v5, "device_token"

    invoke-virtual {v4, v5}, Lorg/json/JSONObject;->getString(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v6

    invoke-direct {p0, v6}, Lcom/qmods/app/auth/DevicePairingRunnable;->saveToken(Ljava/lang/String;)V

    invoke-direct {p0, v6}, Lcom/qmods/app/auth/DevicePairingRunnable;->postPaired(Ljava/lang/String;)V

    return-void

    :check_expired
    const-string v5, "rejected"

    invoke-virtual {v5, v11}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z

    move-result v6

    if-eqz v6, :check_timeout

    # ONE_DEVICE_PER_ACCOUNT: server refused the claim (most likely the
    # account already has another device paired) — done polling either way.
    const-string v5, "reason"

    const-string v6, "device_limit"

    invoke-virtual {v4, v5, v6}, Lorg/json/JSONObject;->optString(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object v5

    invoke-direct {p0, v5}, Lcom/qmods/app/auth/DevicePairingRunnable;->postFailed(Ljava/lang/String;)V

    return-void

    :check_timeout
    const-string v5, "expired"

    invoke-virtual {v5, v11}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z

    move-result v6

    if-eqz v6, :next_attempt

    const-string v5, "expired"

    invoke-direct {p0, v5}, Lcom/qmods/app/auth/DevicePairingRunnable;->postFailed(Ljava/lang/String;)V

    return-void

    :next_attempt
    const/4 v12, 0x0

    add-int/lit8 v10, v10, 0x1

    goto :poll_loop

    :poll_try_end
    .catch Ljava/lang/Exception; {:poll_try_start .. :poll_try_end} :poll_catch

    :poll_catch
    move-exception v0

    const-string v2, "QModsAuth"

    const-string v3, "device pairing poll attempt failed, retrying"

    invoke-static {v2, v3, v0}, Landroid/util/Log;->e(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I

    add-int/lit8 v12, v12, 0x1

    const/4 v1, 0x5

    if-lt v12, v1, :retry_next

    const-string v3, "network_error"

    invoke-direct {p0, v3}, Lcom/qmods/app/auth/DevicePairingRunnable;->postFailed(Ljava/lang/String;)V

    return-void

    :retry_next
    add-int/lit8 v10, v10, 0x1

    goto :poll_loop

    :catch_start_failed
    move-exception v0

    const-string v2, "QModsAuth"

    const-string v3, "device pairing start failed"

    invoke-static {v2, v3, v0}, Landroid/util/Log;->e(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I

    const-string v1, "network_error"

    invoke-direct {p0, v1}, Lcom/qmods/app/auth/DevicePairingRunnable;->postFailed(Ljava/lang/String;)V

    return-void
.end method

.method private postCodeReady(Ljava/lang/String;Ljava/lang/String;)V
    .locals 4
    .param p1, "code"    # Ljava/lang/String;
    .param p2, "deepLink"    # Ljava/lang/String;

    iget-object v0, p0, Lcom/qmods/app/auth/DevicePairingRunnable;->handler:Landroid/os/Handler;

    iget-object v1, p0, Lcom/qmods/app/auth/DevicePairingRunnable;->callback:Lcom/qmods/app/auth/PairingCallback;

    const/4 v2, 0x0

    new-instance v3, Lcom/qmods/app/auth/CallbackDispatcher;

    invoke-direct {v3, v1, v2, p1, p2}, Lcom/qmods/app/auth/CallbackDispatcher;-><init>(Lcom/qmods/app/auth/PairingCallback;ILjava/lang/String;Ljava/lang/String;)V

    invoke-virtual {v0, v3}, Landroid/os/Handler;->post(Ljava/lang/Runnable;)Z

    return-void
.end method

.method private postPaired(Ljava/lang/String;)V
    .locals 5
    .param p1, "token"    # Ljava/lang/String;

    iget-object v0, p0, Lcom/qmods/app/auth/DevicePairingRunnable;->handler:Landroid/os/Handler;

    iget-object v1, p0, Lcom/qmods/app/auth/DevicePairingRunnable;->callback:Lcom/qmods/app/auth/PairingCallback;

    const/4 v2, 0x1

    const/4 v4, 0x0

    new-instance v3, Lcom/qmods/app/auth/CallbackDispatcher;

    invoke-direct {v3, v1, v2, p1, v4}, Lcom/qmods/app/auth/CallbackDispatcher;-><init>(Lcom/qmods/app/auth/PairingCallback;ILjava/lang/String;Ljava/lang/String;)V

    invoke-virtual {v0, v3}, Landroid/os/Handler;->post(Ljava/lang/Runnable;)Z

    return-void
.end method

.method private postFailed(Ljava/lang/String;)V
    .locals 5
    .param p1, "reason"    # Ljava/lang/String;

    iget-object v0, p0, Lcom/qmods/app/auth/DevicePairingRunnable;->handler:Landroid/os/Handler;

    iget-object v1, p0, Lcom/qmods/app/auth/DevicePairingRunnable;->callback:Lcom/qmods/app/auth/PairingCallback;

    const/4 v2, 0x2

    const/4 v4, 0x0

    new-instance v3, Lcom/qmods/app/auth/CallbackDispatcher;

    invoke-direct {v3, v1, v2, p1, v4}, Lcom/qmods/app/auth/CallbackDispatcher;-><init>(Lcom/qmods/app/auth/PairingCallback;ILjava/lang/String;Ljava/lang/String;)V

    invoke-virtual {v0, v3}, Landroid/os/Handler;->post(Ljava/lang/Runnable;)Z

    return-void
.end method

.method private saveToken(Ljava/lang/String;)V
    .locals 4
    .param p1, "token"    # Ljava/lang/String;

    iget-object v0, p0, Lcom/qmods/app/auth/DevicePairingRunnable;->context:Landroid/content/Context;

    const-string v1, "qmods_auth"

    const/4 v2, 0x0

    invoke-virtual {v0, v1, v2}, Landroid/content/Context;->getSharedPreferences(Ljava/lang/String;I)Landroid/content/SharedPreferences;

    move-result-object v3

    invoke-interface {v3}, Landroid/content/SharedPreferences;->edit()Landroid/content/SharedPreferences$Editor;

    move-result-object v3

    const-string v1, "device_token"

    invoke-interface {v3, v1, p1}, Landroid/content/SharedPreferences$Editor;->putString(Ljava/lang/String;Ljava/lang/String;)Landroid/content/SharedPreferences$Editor;

    move-result-object v3

    invoke-interface {v3}, Landroid/content/SharedPreferences$Editor;->apply()V

    return-void
.end method

# Best-effort: if there's no Telegram (or another app registered for t.me
# links) installed, this silently no-ops — the app should still show the
# code as text (from onCodeReady) so the user can open the link manually.
.method private openTelegram(Ljava/lang/String;)V
    .locals 3
    .param p1, "deepLink"    # Ljava/lang/String;

    :try_start
    new-instance v0, Landroid/content/Intent;

    const-string v1, "android.intent.action.VIEW"

    invoke-static {p1}, Landroid/net/Uri;->parse(Ljava/lang/String;)Landroid/net/Uri;

    move-result-object v2

    invoke-direct {v0, v1, v2}, Landroid/content/Intent;-><init>(Ljava/lang/String;Landroid/net/Uri;)V

    const/high16 v1, 0x10000000

    invoke-virtual {v0, v1}, Landroid/content/Intent;->addFlags(I)Landroid/content/Intent;

    iget-object v1, p0, Lcom/qmods/app/auth/DevicePairingRunnable;->context:Landroid/content/Context;

    invoke-virtual {v1, v0}, Landroid/content/Context;->startActivity(Landroid/content/Intent;)V
    :try_end
    .catch Landroid/content/ActivityNotFoundException; {:try_start .. :try_end} :catch_none

    return-void

    :catch_none
    move-exception v0

    return-void
.end method
