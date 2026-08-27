.class public Lcom/qmods/app/auth/SubscriptionCheckRunnable;
.super Ljava/lang/Object;
.source "SubscriptionCheckRunnable.java"
.implements Ljava/lang/Runnable;

.field private final context:Landroid/content/Context;

.field private final callback:Lcom/qmods/app/auth/SubscriptionCallback;

.field private final handler:Landroid/os/Handler;

.method public constructor <init>(Landroid/content/Context;Lcom/qmods/app/auth/SubscriptionCallback;)V
    .locals 2
    .param p1, "context"    # Landroid/content/Context;
    .param p2, "callback"    # Lcom/qmods/app/auth/SubscriptionCallback;

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->context:Landroid/content/Context;

    iput-object p2, p0, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->callback:Lcom/qmods/app/auth/SubscriptionCallback;

    new-instance v0, Landroid/os/Handler;

    invoke-static {}, Landroid/os/Looper;->getMainLooper()Landroid/os/Looper;

    move-result-object v1

    invoke-direct {v0, v1}, Landroid/os/Handler;-><init>(Landroid/os/Looper;)V

    iput-object v0, p0, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->handler:Landroid/os/Handler;

    return-void
.end method

# NOTE: the URL literal below must match wherever you deployed the
# Cloudflare Worker — see DevicePairingRunnable's equivalent note.
#
# The response also carries `notifications` (admin-sent, see AppNotifier)
# and `force_update` (admin-set minimum versionCode, see ForceUpdateDispatcher)
# alongside the original `subscription` payload — this one call covers all
# three, whether it's the cold-start check or MainActivity's periodic
# in-use recheck (see android-client/README.md "Проверка во время
# использования").
.method public run()V
    .locals 15

    iget-object v0, p0, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->context:Landroid/content/Context;

    const-string v1, "qmods_auth"

    const/4 v2, 0x0

    invoke-virtual {v0, v1, v2}, Landroid/content/Context;->getSharedPreferences(Ljava/lang/String;I)Landroid/content/SharedPreferences;

    move-result-object v3

    const-string v1, "device_token"

    const-string v2, ""

    invoke-interface {v3, v1, v2}, Landroid/content/SharedPreferences;->getString(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object v4

    invoke-virtual {v4}, Ljava/lang/String;->isEmpty()Z

    move-result v5

    if-eqz v5, :do_check

    const-string v6, "not_paired"

    invoke-direct {p0, v6}, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->postError(Ljava/lang/String;)V

    return-void

    :do_check
    :try_start
    invoke-direct {p0}, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->getVersionCode()I

    move-result v6

    new-instance v7, Ljava/lang/StringBuilder;

    invoke-direct {v7}, Ljava/lang/StringBuilder;-><init>()V

    const-string v8, "https://update.qmurzik7.workers.dev/device/subscription?token="

    invoke-virtual {v7, v8}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v7

    invoke-virtual {v7, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v7

    const-string v8, "&version_code="

    invoke-virtual {v7, v8}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v7

    invoke-virtual {v7, v6}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v7

    invoke-virtual {v7}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v8

    invoke-static {v8}, Lcom/qmods/app/auth/Http;->get(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v9

    new-instance v10, Lorg/json/JSONObject;

    invoke-direct {v10, v9}, Lorg/json/JSONObject;-><init>(Ljava/lang/String;)V

    const-string v6, "success"

    const/4 v7, 0x0

    invoke-virtual {v10, v6, v7}, Lorg/json/JSONObject;->optBoolean(Ljava/lang/String;Z)Z

    move-result v11

    if-nez v11, :success_ok

    const-string v6, "revoked"

    const/4 v7, 0x0

    invoke-virtual {v10, v6, v7}, Lorg/json/JSONObject;->optBoolean(Ljava/lang/String;Z)Z

    move-result v11

    if-eqz v11, :not_revoked

    # Server says this device_token no longer resolves to an account (e.g.
    # unlinked via the bot's "Устройства" section) — the saved token is
    # dead, so wipe it locally too and report it the same as "never
    # paired" rather than a generic server error, so the UI routes
    # straight back to the pairing screen instead of a dead-end retry loop.
    invoke-direct {p0}, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->clearToken()V

    const-string v6, "not_paired"

    invoke-direct {p0, v6}, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->postError(Ljava/lang/String;)V

    return-void

    :not_revoked
    const-string v6, "server_error"

    invoke-direct {p0, v6}, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->postError(Ljava/lang/String;)V

    return-void

    :success_ok
    const-string v6, "notifications"

    invoke-virtual {v10, v6}, Lorg/json/JSONObject;->optJSONArray(Ljava/lang/String;)Lorg/json/JSONArray;

    move-result-object v11

    if-eqz v11, :skip_notifications

    const/4 v6, 0x0

    invoke-virtual {v11}, Lorg/json/JSONArray;->length()I

    move-result v7

    :notif_loop
    if-ge v6, v7, :skip_notifications

    invoke-virtual {v11, v6}, Lorg/json/JSONArray;->getJSONObject(I)Lorg/json/JSONObject;

    move-result-object v12

    const-string v8, "id"

    const-string v9, ""

    invoke-virtual {v12, v8, v9}, Lorg/json/JSONObject;->optString(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object v13

    const-string v8, "title"

    invoke-virtual {v12, v8, v9}, Lorg/json/JSONObject;->optString(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object v14

    const-string v8, "message"

    invoke-virtual {v12, v8, v9}, Lorg/json/JSONObject;->optString(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object v9

    invoke-static {v0, v13, v14, v9}, Lcom/qmods/app/auth/AppNotifier;->show(Landroid/content/Context;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V

    add-int/lit8 v6, v6, 0x1

    goto :notif_loop

    :skip_notifications
    const-string v6, "force_update"

    invoke-virtual {v10, v6}, Lorg/json/JSONObject;->optJSONObject(Ljava/lang/String;)Lorg/json/JSONObject;

    move-result-object v11

    if-eqz v11, :skip_force_update

    const-string v6, "required"

    const/4 v7, 0x0

    invoke-virtual {v11, v6, v7}, Lorg/json/JSONObject;->optBoolean(Ljava/lang/String;Z)Z

    move-result v12

    if-eqz v12, :skip_force_update

    const-string v6, "message"

    const-string v7, ""

    invoke-virtual {v11, v6, v7}, Lorg/json/JSONObject;->optString(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object v12

    invoke-direct {p0, v12}, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->postForceUpdate(Ljava/lang/String;)V

    return-void

    :skip_force_update
    const-string v6, "found"

    const/4 v7, 0x0

    invoke-virtual {v10, v6, v7}, Lorg/json/JSONObject;->optBoolean(Ljava/lang/String;Z)Z

    move-result v11

    if-nez v11, :found_ok

    const-string v6, "not_found"

    invoke-direct {p0, v6}, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->postError(Ljava/lang/String;)V

    return-void

    :found_ok
    const-string v6, "subscription"

    invoke-virtual {v10, v6}, Lorg/json/JSONObject;->getJSONObject(Ljava/lang/String;)Lorg/json/JSONObject;

    move-result-object v11

    const-string v6, "active"

    const/4 v7, 0x0

    invoke-virtual {v11, v6, v7}, Lorg/json/JSONObject;->optBoolean(Ljava/lang/String;Z)Z

    move-result v6

    const-string v7, "days_left"

    const/4 v8, 0x0

    invoke-virtual {v11, v7, v8}, Lorg/json/JSONObject;->optInt(Ljava/lang/String;I)I

    move-result v7

    const-string v8, "plan"

    const-string v9, ""

    invoke-virtual {v11, v8, v9}, Lorg/json/JSONObject;->optString(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object v8

    invoke-direct {p0, v6, v7, v8}, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->postResult(ZILjava/lang/String;)V

    :try_end
    .catch Ljava/lang/Exception; {:try_start .. :try_end} :catch_all

    return-void

    :catch_all
    move-exception v0

    const-string v2, "QModsAuth"

    const-string v3, "subscription check failed"

    invoke-static {v2, v3, v0}, Landroid/util/Log;->e(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I

    const-string v1, "network_error"

    invoke-direct {p0, v1}, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->postError(Ljava/lang/String;)V

    return-void
.end method

# Best-effort — 0 (never gates) if the package can't be introspected, which
# should never actually happen for an app looking up its own PackageInfo.
.method private getVersionCode()I
    .locals 5

    :try_start
    iget-object v0, p0, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->context:Landroid/content/Context;

    invoke-virtual {v0}, Landroid/content/Context;->getPackageManager()Landroid/content/pm/PackageManager;

    move-result-object v1

    iget-object v0, p0, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->context:Landroid/content/Context;

    invoke-virtual {v0}, Landroid/content/Context;->getPackageName()Ljava/lang/String;

    move-result-object v2

    const/4 v3, 0x0

    invoke-virtual {v1, v2, v3}, Landroid/content/pm/PackageManager;->getPackageInfo(Ljava/lang/String;I)Landroid/content/pm/PackageInfo;

    move-result-object v4

    iget v4, v4, Landroid/content/pm/PackageInfo;->versionCode:I
    :try_end
    .catch Landroid/content/pm/PackageManager$NameNotFoundException; {:try_start .. :try_end} :catch_default

    return v4

    :catch_default
    const/4 v4, 0x0

    return v4
.end method

# SubscriptionDispatcher's constructor takes 6 params (7 registers including
# the new instance itself) — over the 5-register limit for a plain
# invoke-direct, so this uses invoke-direct/range over a contiguous v0..v6
# block instead (values moved in via move/move-object rather than reused
# from scattered registers, since /range requires contiguous registers).
.method private clearToken()V
    .locals 3

    iget-object v0, p0, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->context:Landroid/content/Context;

    const-string v1, "qmods_auth"

    const/4 v2, 0x0

    invoke-virtual {v0, v1, v2}, Landroid/content/Context;->getSharedPreferences(Ljava/lang/String;I)Landroid/content/SharedPreferences;

    move-result-object v0

    invoke-interface {v0}, Landroid/content/SharedPreferences;->edit()Landroid/content/SharedPreferences$Editor;

    move-result-object v0

    const-string v1, "device_token"

    invoke-interface {v0, v1}, Landroid/content/SharedPreferences$Editor;->remove(Ljava/lang/String;)Landroid/content/SharedPreferences$Editor;

    move-result-object v0

    invoke-interface {v0}, Landroid/content/SharedPreferences$Editor;->apply()V

    return-void
.end method

.method private postResult(ZILjava/lang/String;)V
    .locals 7
    .param p1, "active"    # Z
    .param p2, "daysLeft"    # I
    .param p3, "plan"    # Ljava/lang/String;

    new-instance v0, Lcom/qmods/app/auth/SubscriptionDispatcher;

    iget-object v1, p0, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->callback:Lcom/qmods/app/auth/SubscriptionCallback;

    const/4 v2, 0x0

    move v3, p1

    move v4, p2

    move-object v5, p3

    const/4 v6, 0x0

    invoke-direct/range {v0 .. v6}, Lcom/qmods/app/auth/SubscriptionDispatcher;-><init>(Lcom/qmods/app/auth/SubscriptionCallback;ZZILjava/lang/String;Ljava/lang/String;)V

    iget-object v1, p0, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->handler:Landroid/os/Handler;

    invoke-virtual {v1, v0}, Landroid/os/Handler;->post(Ljava/lang/Runnable;)Z

    return-void
.end method

.method private postError(Ljava/lang/String;)V
    .locals 7
    .param p1, "reason"    # Ljava/lang/String;

    new-instance v0, Lcom/qmods/app/auth/SubscriptionDispatcher;

    iget-object v1, p0, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->callback:Lcom/qmods/app/auth/SubscriptionCallback;

    const/4 v2, 0x1

    const/4 v3, 0x0

    const/4 v4, 0x0

    const/4 v5, 0x0

    move-object v6, p1

    invoke-direct/range {v0 .. v6}, Lcom/qmods/app/auth/SubscriptionDispatcher;-><init>(Lcom/qmods/app/auth/SubscriptionCallback;ZZILjava/lang/String;Ljava/lang/String;)V

    iget-object v1, p0, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->handler:Landroid/os/Handler;

    invoke-virtual {v1, v0}, Landroid/os/Handler;->post(Ljava/lang/Runnable;)Z

    return-void
.end method

.method private postForceUpdate(Ljava/lang/String;)V
    .locals 2
    .param p1, "message"    # Ljava/lang/String;

    new-instance v0, Lcom/qmods/app/auth/ForceUpdateDispatcher;

    iget-object v1, p0, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->callback:Lcom/qmods/app/auth/SubscriptionCallback;

    invoke-direct {v0, v1, p1}, Lcom/qmods/app/auth/ForceUpdateDispatcher;-><init>(Lcom/qmods/app/auth/SubscriptionCallback;Ljava/lang/String;)V

    iget-object v1, p0, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->handler:Landroid/os/Handler;

    invoke-virtual {v1, v0}, Landroid/os/Handler;->post(Ljava/lang/Runnable;)Z

    return-void
.end method
