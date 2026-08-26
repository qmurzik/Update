.class public Lcom/example/app/MainActivity;
.super Landroid/app/Activity;
.source "MainActivity.java"
.implements Lcom/qmods/app/auth/PairingCallback;
.implements Lcom/qmods/app/auth/SubscriptionCallback;

# ============================================================
# EXAMPLE ONLY — not part of the reusable auth module (that's
# smali/com/qmods/app/auth/). Shows exactly how to wire it into a real
# Activity's onCreate(). This is a placeholder class in package
# com.example.app — see android-client/README.md "Куда менять package
# name" for the two different renames involved:
#
#   1. Your real Activity already exists in your decompiled project under
#      its own package — copy the BODY of onCreate() (and the 5 callback
#      methods) into it rather than dropping this whole file in. Only the
#      .implements lines and the method bodies matter; delete everything
#      else here.
#   2. `Lcom/qmods/app/auth/...` — the auth module's package — stays as-is
#      UNLESS you renamed it too (see android-client/README.md step 2).
#      This file references it 8 times below (2 .implements + 6 calls);
#      all 8 need the same replacement if you renamed the module.
# ============================================================

.method public constructor <init>()V
    .locals 0

    invoke-direct {p0}, Landroid/app/Activity;-><init>()V

    return-void
.end method

.method protected onCreate(Landroid/os/Bundle;)V
    .locals 1
    .param p1, "savedInstanceState"    # Landroid/os/Bundle;

    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    # ... your existing setContentView(...) / view setup stays here ...

    invoke-static {p0}, Lcom/qmods/app/auth/SubscriptionChecker;->isPaired(Landroid/content/Context;)Z

    move-result v0

    if-eqz v0, :not_paired

    # Already paired from a previous run — just check the subscription.
    invoke-static {p0, p0}, Lcom/qmods/app/auth/SubscriptionChecker;->check(Landroid/content/Context;Lcom/qmods/app/auth/SubscriptionCallback;)V

    goto :done

    :not_paired
    # First launch (or a cleared pairing) — start the "log in via Telegram" flow.
    invoke-static {p0, p0}, Lcom/qmods/app/auth/DevicePairing;->startPairing(Landroid/content/Context;Lcom/qmods/app/auth/PairingCallback;)V

    :done
    return-void
.end method

# ============================================================
# PairingCallback — called on the UI thread. Replace the Toast calls with
# your actual screens/views.
# ============================================================

.method public onCodeReady(Ljava/lang/String;Ljava/lang/String;)V
    .locals 3
    .param p1, "code"    # Ljava/lang/String;
    .param p2, "deepLink"    # Ljava/lang/String;

    # TODO: show `code` as text too, in case the device has no Telegram
    # app and the deep link intent silently no-oped.
    const/4 v0, 0x0

    invoke-static {p0, p1, v0}, Landroid/widget/Toast;->makeText(Landroid/content/Context;Ljava/lang/CharSequence;I)Landroid/widget/Toast;

    move-result-object v1

    invoke-virtual {v1}, Landroid/widget/Toast;->show()V

    return-void
.end method

.method public onPaired(Ljava/lang/String;)V
    .locals 3
    .param p1, "deviceToken"    # Ljava/lang/String;

    const-string v0, "Приложение привязано"

    const/4 v1, 0x0

    invoke-static {p0, v0, v1}, Landroid/widget/Toast;->makeText(Landroid/content/Context;Ljava/lang/CharSequence;I)Landroid/widget/Toast;

    move-result-object v2

    invoke-virtual {v2}, Landroid/widget/Toast;->show()V

    # device_token is already saved by this point — go straight into the
    # first subscription check instead of waiting for the next onCreate().
    invoke-static {p0, p0}, Lcom/qmods/app/auth/SubscriptionChecker;->check(Landroid/content/Context;Lcom/qmods/app/auth/SubscriptionCallback;)V

    return-void
.end method

.method public onFailed(Ljava/lang/String;)V
    .locals 2
    .param p1, "reason"    # Ljava/lang/String;

    # reason: "start_failed" | "expired" | "timeout" | "network_error"
    # TODO: show a real "retry" button instead of just a Toast.
    const/4 v0, 0x1

    invoke-static {p0, p1, v0}, Landroid/widget/Toast;->makeText(Landroid/content/Context;Ljava/lang/CharSequence;I)Landroid/widget/Toast;

    move-result-object v1

    invoke-virtual {v1}, Landroid/widget/Toast;->show()V

    return-void
.end method

# ============================================================
# SubscriptionCallback — called on the UI thread.
# ============================================================

.method public onResult(ZILjava/lang/String;)V
    .locals 3
    .param p1, "active"    # Z
    .param p2, "daysLeft"    # I
    .param p3, "plan"    # Ljava/lang/String;

    # TODO: active == true -> unlock your real content instead of doing
    # nothing here; this stub only demonstrates the inactive branch.
    if-nez p1, :inactive

    return-void

    :inactive
    const-string v0, "Подписка не активна"

    const/4 v1, 0x1

    invoke-static {p0, v0, v1}, Landroid/widget/Toast;->makeText(Landroid/content/Context;Ljava/lang/CharSequence;I)Landroid/widget/Toast;

    move-result-object v2

    invoke-virtual {v2}, Landroid/widget/Toast;->show()V

    return-void
.end method

.method public onError(Ljava/lang/String;)V
    .locals 2
    .param p1, "reason"    # Ljava/lang/String;

    # reason: "not_paired" | "not_found" | "server_error" | "network_error"
    # "not_paired" means the saved device_token is gone/invalid (e.g. you
    # called SubscriptionChecker.clearPairing() or a fresh install) —
    # send the user through the pairing flow again automatically.
    const-string v0, "not_paired"

    invoke-virtual {v0, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z

    move-result v1

    if-eqz v1, :not_not_paired

    invoke-static {p0, p0}, Lcom/qmods/app/auth/DevicePairing;->startPairing(Landroid/content/Context;Lcom/qmods/app/auth/PairingCallback;)V

    :not_not_paired
    return-void
.end method
