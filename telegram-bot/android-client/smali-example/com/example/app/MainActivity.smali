.class public Lcom/example/app/MainActivity;
.super Landroid/app/Activity;
.source "MainActivity.java"
.implements Lcom/qmods/app/auth/SubscriptionCallback;

# ============================================================
# EXAMPLE ONLY — not part of the reusable auth module (that's
# smali/com/qmods/app/auth/, including GateActivity, the blocking screen
# this example delegates to). Shows exactly how to wire the module into a
# real Activity's onCreate() so the app is gated behind Telegram auth + an
# active subscription, re-checked on every cold start. See
# android-client/README.md "Как работает гейт" for the full picture, and
# "Куда менять package name" for the two different renames involved:
#
#   1. Your real Activity already exists in your decompiled project under
#      its own package — copy the BODY of onCreate()/onResult()/onError()/
#      openGate() into it rather than dropping this whole file in. Only
#      the .implements line and those method bodies matter; delete
#      everything else here.
#   2. `Lcom/qmods/app/auth/...` — the auth module's package — stays as-is
#      UNLESS you renamed it too (see android-client/README.md). This file
#      references it several times below; all of them need the same
#      replacement if you renamed the module. GateActivity.smali's
#      onResult also needs YOUR Activity's class name in place of this
#      example's Lcom/example/app/MainActivity;.
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

    # No separate isPaired() check needed: check() itself reports
    # onError("not_paired") when there's no saved device_token, which
    # onError below treats exactly like any other reason to gate.
    invoke-static {p0, p0}, Lcom/qmods/app/auth/SubscriptionChecker;->check(Landroid/content/Context;Lcom/qmods/app/auth/SubscriptionCallback;)V

    return-void
.end method

# Launches the blocking GateActivity in the given mode ("pair" | "paywall" |
# "error") — see smali/com/qmods/app/auth/GateActivity.smali.
.method private openGate(Ljava/lang/String;)V
    .locals 3
    .param p1, "mode"    # Ljava/lang/String;

    new-instance v0, Landroid/content/Intent;

    const-class v1, Lcom/qmods/app/auth/GateActivity;

    invoke-direct {v0, p0, v1}, Landroid/content/Intent;-><init>(Landroid/content/Context;Ljava/lang/Class;)V

    const-string v1, "mode"

    invoke-virtual {v0, v1, p1}, Landroid/content/Intent;->putExtra(Ljava/lang/String;Ljava/lang/String;)Landroid/content/Intent;

    move-result-object v0

    invoke-virtual {p0, v0}, Landroid/app/Activity;->startActivity(Landroid/content/Intent;)V

    return-void
.end method

# ============================================================
# SubscriptionCallback — called on the UI thread.
# ============================================================

.method public onResult(ZILjava/lang/String;)V
    .locals 1
    .param p1, "active"    # Z
    .param p2, "daysLeft"    # I
    .param p3, "plan"    # Ljava/lang/String;

    # active == true: do nothing, let the real app content stay on screen.
    if-nez p1, :active_ok

    const-string v0, "paywall"

    invoke-direct {p0, v0}, Lcom/example/app/MainActivity;->openGate(Ljava/lang/String;)V

    invoke-virtual {p0}, Lcom/example/app/MainActivity;->finish()V

    :active_ok
    return-void
.end method

.method public onError(Ljava/lang/String;)V
    .locals 2
    .param p1, "reason"    # Ljava/lang/String;

    # reason: "not_paired" | "not_found" | "server_error" | "network_error"
    # Fail-closed: any of these gates the app, "not_paired" just uses a
    # different screen (the pairing flow) than the others (a retry screen).
    const-string v0, "not_paired"

    invoke-virtual {v0, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z

    move-result v0

    if-eqz v0, :other_error

    const-string v1, "pair"

    invoke-direct {p0, v1}, Lcom/example/app/MainActivity;->openGate(Ljava/lang/String;)V

    goto :do_finish

    :other_error
    const-string v1, "error"

    invoke-direct {p0, v1}, Lcom/example/app/MainActivity;->openGate(Ljava/lang/String;)V

    :do_finish
    invoke-virtual {p0}, Lcom/example/app/MainActivity;->finish()V

    return-void
.end method
