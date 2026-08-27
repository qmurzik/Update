.class public Lcom/qmods/app/auth/ForceUpdateDispatcher;
.super Ljava/lang/Object;
.source "ForceUpdateDispatcher.java"
.implements Ljava/lang/Runnable;

# Posted to the main-thread Handler by SubscriptionCheckRunnable, mirroring
# SubscriptionDispatcher — kept as its own tiny class instead of adding a
# third dispatch mode to SubscriptionDispatcher so the existing
# onResult/onError plumbing stays untouched.

.field private final callback:Lcom/qmods/app/auth/SubscriptionCallback;

.field private final message:Ljava/lang/String;

.method public constructor <init>(Lcom/qmods/app/auth/SubscriptionCallback;Ljava/lang/String;)V
    .locals 0
    .param p1, "callback"    # Lcom/qmods/app/auth/SubscriptionCallback;
    .param p2, "message"    # Ljava/lang/String;

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/qmods/app/auth/ForceUpdateDispatcher;->callback:Lcom/qmods/app/auth/SubscriptionCallback;

    iput-object p2, p0, Lcom/qmods/app/auth/ForceUpdateDispatcher;->message:Ljava/lang/String;

    return-void
.end method

.method public run()V
    .locals 2

    iget-object v0, p0, Lcom/qmods/app/auth/ForceUpdateDispatcher;->callback:Lcom/qmods/app/auth/SubscriptionCallback;

    iget-object v1, p0, Lcom/qmods/app/auth/ForceUpdateDispatcher;->message:Ljava/lang/String;

    invoke-interface {v0, v1}, Lcom/qmods/app/auth/SubscriptionCallback;->onForceUpdate(Ljava/lang/String;)V

    return-void
.end method
