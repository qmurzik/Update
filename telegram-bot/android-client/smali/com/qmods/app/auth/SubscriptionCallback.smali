.class public interface abstract Lcom/qmods/app/auth/SubscriptionCallback;
.super Ljava/lang/Object;
.source "SubscriptionCallback.java"

# Both methods are invoked on the main/UI thread.

# active, daysLeft, plan straight from mod/api/bot.php's subscription_info().
.method public abstract onResult(ZILjava/lang/String;)V
.end method

# error is one of: "not_paired", "not_found", "server_error", "network_error".
# "not_paired" means SubscriptionChecker.isPaired() would also return false —
# send the user through DevicePairing.startPairing() again.
.method public abstract onError(Ljava/lang/String;)V
.end method

# Server says this device's installed app version is below the admin-set
# minimum (see mod/admin/bot.php's set_app_version / the bot's "🚧 Мин.
# версия приложения") — fail-closed regardless of subscription state.
# `message` is the admin-configured text to show (may be empty).
.method public abstract onForceUpdate(Ljava/lang/String;)V
.end method
