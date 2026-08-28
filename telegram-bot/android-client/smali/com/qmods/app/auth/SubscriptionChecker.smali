.class public Lcom/qmods/app/auth/SubscriptionChecker;
.super Ljava/lang/Object;
.source "SubscriptionChecker.java"

# Call check() from onResume() (or wherever you gate a paywall) once
# DevicePairing has paired the device. Example:
#
#   if (!SubscriptionChecker.isPaired(this)) {
#       // show "log in via Telegram" screen, call DevicePairing.startPairing()
#   } else {
#       SubscriptionChecker.check(this, new SubscriptionCallback() {
#           public void onResult(boolean active, int daysLeft, String plan) {
#               // active == false -> show paywall
#           }
#           public void onError(String reason) { ... }
#       });
#   }

.method public constructor <init>()V
    .locals 0

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    return-void
.end method

# True once a device_token has been saved by a completed pairing.
.method public static isPaired(Landroid/content/Context;)Z
    .locals 4
    .param p0, "context"    # Landroid/content/Context;

    const-string v0, "qmods_auth"

    const/4 v1, 0x0

    invoke-virtual {p0, v0, v1}, Landroid/content/Context;->getSharedPreferences(Ljava/lang/String;I)Landroid/content/SharedPreferences;

    move-result-object v2

    const-string v0, "device_token"

    const-string v1, ""

    invoke-interface {v2, v0, v1}, Landroid/content/SharedPreferences;->getString(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object v3

    invoke-virtual {v3}, Ljava/lang/String;->isEmpty()Z

    move-result v0

    if-eqz v0, :is_paired

    const/4 v0, 0x0

    return v0

    :is_paired
    const/4 v0, 0x1

    return v0
.end method

# Wipes the saved device_token — e.g. after onError("not_paired") /
# onError("not_found") repeatedly, or an explicit "log out" action.
.method public static clearPairing(Landroid/content/Context;)V
    .locals 3
    .param p0, "context"    # Landroid/content/Context;

    const-string v0, "qmods_auth"

    const/4 v1, 0x0

    invoke-virtual {p0, v0, v1}, Landroid/content/Context;->getSharedPreferences(Ljava/lang/String;I)Landroid/content/SharedPreferences;

    move-result-object v2

    invoke-interface {v2}, Landroid/content/SharedPreferences;->edit()Landroid/content/SharedPreferences$Editor;

    move-result-object v2

    const-string v0, "device_token"

    invoke-interface {v2, v0}, Landroid/content/SharedPreferences$Editor;->remove(Ljava/lang/String;)Landroid/content/SharedPreferences$Editor;

    move-result-object v2

    invoke-interface {v2}, Landroid/content/SharedPreferences$Editor;->apply()V

    return-void
.end method

# Self-service "log out" from inside the app — e.g. a "Выйти" button on your
# main screen. Best-effort tells the Worker to revoke the device_token
# server-side (POST /device/unlink), then ALWAYS wipes the local token
# afterward regardless of whether that network call succeeded, so the user
# can log out even while offline — a stray still-valid token server-side
# just gets caught by the very next /device/subscription check (revoked:
# true) if it's ever reused. onDone runs on the main thread once finished;
# have it navigate to your pairing screen (or call DevicePairing.startPairing()).
.method public static unlink(Landroid/content/Context;Ljava/lang/Runnable;)V
    .locals 3
    .param p0, "context"    # Landroid/content/Context;
    .param p1, "onDone"    # Ljava/lang/Runnable;

    invoke-virtual {p0}, Landroid/content/Context;->getApplicationContext()Landroid/content/Context;

    move-result-object v0

    new-instance v1, Lcom/qmods/app/auth/UnlinkRunnable;

    invoke-direct {v1, v0, p1}, Lcom/qmods/app/auth/UnlinkRunnable;-><init>(Landroid/content/Context;Ljava/lang/Runnable;)V

    new-instance v2, Ljava/lang/Thread;

    invoke-direct {v2, v1}, Ljava/lang/Thread;-><init>(Ljava/lang/Runnable;)V

    invoke-virtual {v2}, Ljava/lang/Thread;->start()V

    return-void
.end method

.method public static check(Landroid/content/Context;Lcom/qmods/app/auth/SubscriptionCallback;)V
    .locals 3
    .param p0, "context"    # Landroid/content/Context;
    .param p1, "callback"    # Lcom/qmods/app/auth/SubscriptionCallback;

    invoke-virtual {p0}, Landroid/content/Context;->getApplicationContext()Landroid/content/Context;

    move-result-object v0

    new-instance v1, Lcom/qmods/app/auth/SubscriptionCheckRunnable;

    invoke-direct {v1, v0, p1}, Lcom/qmods/app/auth/SubscriptionCheckRunnable;-><init>(Landroid/content/Context;Lcom/qmods/app/auth/SubscriptionCallback;)V

    new-instance v2, Ljava/lang/Thread;

    invoke-direct {v2, v1}, Ljava/lang/Thread;-><init>(Ljava/lang/Runnable;)V

    invoke-virtual {v2}, Ljava/lang/Thread;->start()V

    return-void
.end method
