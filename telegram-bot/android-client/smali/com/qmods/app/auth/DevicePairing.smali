.class public Lcom/qmods/app/auth/DevicePairing;
.super Ljava/lang/Object;
.source "DevicePairing.java"

# Public entry point for "log in via the bot" — call startPairing() from a
# button/screen in your app. Example (written as Java for readability; the
# real integration point is just this one static call):
#
#   DevicePairing.startPairing(this, new PairingCallback() {
#       public void onCodeReady(String code, String deepLink) { ... }
#       public void onPaired(String deviceToken) { ... }
#       public void onFailed(String reason) { ... }
#   });
#
# Flow: asks the Worker for a fresh pairing code, opens Telegram on
# t.me/<bot>?start=devicelink_<code>, and polls until the account owner
# confirms it in the chat (or it expires). See DevicePairingRunnable for
# the actual implementation and README "Авторизация приложения через бота"
# in the qmods-bot repo for the full protocol.
#
# startPairingByUsername() is the alternative for a device that has this
# app but no Telegram installed on it: instead of opening a deep link, the
# account owner's Telegram @username is sent to the server, which messages
# THAT chat a Confirm/Decline prompt (only works if that account has
# messaged the bot at least once before, from any device — see
# GateActivity's "pair" mode and README "Привязка по юзернейму").

.method public constructor <init>()V
    .locals 0

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    return-void
.end method

.method public static startPairing(Landroid/content/Context;Lcom/qmods/app/auth/PairingCallback;)V
    .locals 4
    .param p0, "context"    # Landroid/content/Context;
    .param p1, "callback"    # Lcom/qmods/app/auth/PairingCallback;

    invoke-virtual {p0}, Landroid/content/Context;->getApplicationContext()Landroid/content/Context;

    move-result-object v0

    const/4 v3, 0x0

    new-instance v1, Lcom/qmods/app/auth/DevicePairingRunnable;

    invoke-direct {v1, v0, p1, v3}, Lcom/qmods/app/auth/DevicePairingRunnable;-><init>(Landroid/content/Context;Lcom/qmods/app/auth/PairingCallback;Ljava/lang/String;)V

    new-instance v2, Ljava/lang/Thread;

    invoke-direct {v2, v1}, Ljava/lang/Thread;-><init>(Ljava/lang/Runnable;)V

    invoke-virtual {v2}, Ljava/lang/Thread;->start()V

    return-void
.end method

.method public static startPairingByUsername(Landroid/content/Context;Ljava/lang/String;Lcom/qmods/app/auth/PairingCallback;)V
    .locals 3
    .param p0, "context"    # Landroid/content/Context;
    .param p1, "telegramUsername"    # Ljava/lang/String;
    .param p2, "callback"    # Lcom/qmods/app/auth/PairingCallback;

    invoke-virtual {p0}, Landroid/content/Context;->getApplicationContext()Landroid/content/Context;

    move-result-object v0

    new-instance v1, Lcom/qmods/app/auth/DevicePairingRunnable;

    invoke-direct {v1, v0, p2, p1}, Lcom/qmods/app/auth/DevicePairingRunnable;-><init>(Landroid/content/Context;Lcom/qmods/app/auth/PairingCallback;Ljava/lang/String;)V

    new-instance v2, Ljava/lang/Thread;

    invoke-direct {v2, v1}, Ljava/lang/Thread;-><init>(Ljava/lang/Runnable;)V

    invoke-virtual {v2}, Ljava/lang/Thread;->start()V

    return-void
.end method
