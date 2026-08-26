.class public interface abstract Lcom/qmods/app/auth/PairingCallback;
.super Ljava/lang/Object;
.source "PairingCallback.java"

# Implement this in whatever screen starts the pairing flow. All three
# methods are invoked on the main/UI thread — safe to touch views directly.

# Called once the Worker has minted a pairing code, before Telegram is
# launched — useful to show the code as text too (fallback if the device
# has no Telegram app / the deep link intent fails to resolve).
.method public abstract onCodeReady(Ljava/lang/String;Ljava/lang/String;)V
.end method

# Called once the account owner has confirmed the pairing in the bot chat.
# deviceToken is already persisted to SharedPreferences by this point —
# this callback is purely so the UI can move on (e.g. finish() a "waiting
# for Telegram" screen).
.method public abstract onPaired(Ljava/lang/String;)V
.end method

# reason is one of: "start_failed", "expired", "timeout", "network_error".
.method public abstract onFailed(Ljava/lang/String;)V
.end method
