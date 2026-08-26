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
.method public run()V
    .locals 12

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
    new-instance v6, Ljava/lang/StringBuilder;

    invoke-direct {v6}, Ljava/lang/StringBuilder;-><init>()V

    const-string v7, "https://update.qmurzik7.workers.dev/device/subscription?token="

    invoke-virtual {v6, v7}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v6

    invoke-virtual {v6, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v6

    invoke-virtual {v6}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v7

    invoke-static {v7}, Lcom/qmods/app/auth/Http;->get(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v8

    new-instance v9, Lorg/json/JSONObject;

    invoke-direct {v9, v8}, Lorg/json/JSONObject;-><init>(Ljava/lang/String;)V

    const-string v6, "success"

    const/4 v7, 0x0

    invoke-virtual {v9, v6, v7}, Lorg/json/JSONObject;->optBoolean(Ljava/lang/String;Z)Z

    move-result v10

    if-nez v10, :success_ok

    const-string v6, "server_error"

    invoke-direct {p0, v6}, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->postError(Ljava/lang/String;)V

    return-void

    :success_ok
    const-string v6, "found"

    const/4 v7, 0x0

    invoke-virtual {v9, v6, v7}, Lorg/json/JSONObject;->optBoolean(Ljava/lang/String;Z)Z

    move-result v10

    if-nez v10, :found_ok

    const-string v6, "not_found"

    invoke-direct {p0, v6}, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->postError(Ljava/lang/String;)V

    return-void

    :found_ok
    const-string v6, "subscription"

    invoke-virtual {v9, v6}, Lorg/json/JSONObject;->getJSONObject(Ljava/lang/String;)Lorg/json/JSONObject;

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

    const-string v1, "network_error"

    invoke-direct {p0, v1}, Lcom/qmods/app/auth/SubscriptionCheckRunnable;->postError(Ljava/lang/String;)V

    return-void
.end method

# SubscriptionDispatcher's constructor takes 6 params (7 registers including
# the new instance itself) — over the 5-register limit for a plain
# invoke-direct, so this uses invoke-direct/range over a contiguous v0..v6
# block instead (values moved in via move/move-object rather than reused
# from scattered registers, since /range requires contiguous registers).
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
