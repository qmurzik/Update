.class public Lcom/qmods/app/auth/UnlinkRunnable;
.super Ljava/lang/Object;
.source "UnlinkRunnable.java"
.implements Ljava/lang/Runnable;

# Background work for SubscriptionChecker.unlink() — see that method for
# the public entry point and the "always clears locally" rationale.

.field private final context:Landroid/content/Context;

.field private final onDone:Ljava/lang/Runnable;

.field private final handler:Landroid/os/Handler;

.method public constructor <init>(Landroid/content/Context;Ljava/lang/Runnable;)V
    .locals 2
    .param p1, "context"    # Landroid/content/Context;
    .param p2, "onDone"    # Ljava/lang/Runnable;

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/qmods/app/auth/UnlinkRunnable;->context:Landroid/content/Context;

    iput-object p2, p0, Lcom/qmods/app/auth/UnlinkRunnable;->onDone:Ljava/lang/Runnable;

    new-instance v0, Landroid/os/Handler;

    invoke-static {}, Landroid/os/Looper;->getMainLooper()Landroid/os/Looper;

    move-result-object v1

    invoke-direct {v0, v1}, Landroid/os/Handler;-><init>(Landroid/os/Looper;)V

    iput-object v0, p0, Lcom/qmods/app/auth/UnlinkRunnable;->handler:Landroid/os/Handler;

    return-void
.end method

# NOTE: URL literal must match wherever you deployed the Worker — see
# DevicePairingRunnable's equivalent note.
.method public run()V
    .locals 8

    iget-object v0, p0, Lcom/qmods/app/auth/UnlinkRunnable;->context:Landroid/content/Context;

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

    if-nez v5, :clear_and_finish

    :try_start
    new-instance v6, Ljava/lang/StringBuilder;

    invoke-direct {v6}, Ljava/lang/StringBuilder;-><init>()V

    const-string v7, "https://update.qmurzik7.workers.dev/device/unlink?token="

    invoke-virtual {v6, v7}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v6

    invoke-virtual {v6, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v6

    invoke-virtual {v6}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v6

    invoke-static {v6}, Lcom/qmods/app/auth/Http;->post(Ljava/lang/String;)Ljava/lang/String;
    :try_end
    .catch Ljava/lang/Exception; {:try_start .. :try_end} :catch_ignored

    goto :clear_and_finish

    :catch_ignored
    move-exception v6

    const-string v6, "QModsAuth"

    const-string v7, "unlink request failed (device_token cleared locally anyway)"

    invoke-static {v6, v7}, Landroid/util/Log;->w(Ljava/lang/String;Ljava/lang/String;)I

    :clear_and_finish
    invoke-interface {v3}, Landroid/content/SharedPreferences;->edit()Landroid/content/SharedPreferences$Editor;

    move-result-object v6

    const-string v7, "device_token"

    invoke-interface {v6, v7}, Landroid/content/SharedPreferences$Editor;->remove(Ljava/lang/String;)Landroid/content/SharedPreferences$Editor;

    move-result-object v6

    invoke-interface {v6}, Landroid/content/SharedPreferences$Editor;->apply()V

    iget-object v6, p0, Lcom/qmods/app/auth/UnlinkRunnable;->onDone:Ljava/lang/Runnable;

    if-eqz v6, :done

    iget-object v7, p0, Lcom/qmods/app/auth/UnlinkRunnable;->handler:Landroid/os/Handler;

    invoke-virtual {v7, v6}, Landroid/os/Handler;->post(Ljava/lang/Runnable;)Z

    :done
    return-void
.end method
