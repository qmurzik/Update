.class public Lcom/qmods/app/auth/SubscriptionDispatcher;
.super Ljava/lang/Object;
.source "SubscriptionDispatcher.java"
.implements Ljava/lang/Runnable;

# Posted to the main-thread Handler by SubscriptionCheckRunnable so
# SubscriptionCallback is always invoked on the UI thread.

.field private final callback:Lcom/qmods/app/auth/SubscriptionCallback;

.field private final isError:Z

.field private final active:Z

.field private final daysLeft:I

.field private final plan:Ljava/lang/String;

.field private final error:Ljava/lang/String;

.method public constructor <init>(Lcom/qmods/app/auth/SubscriptionCallback;ZZILjava/lang/String;Ljava/lang/String;)V
    .locals 0
    .param p1, "callback"    # Lcom/qmods/app/auth/SubscriptionCallback;
    .param p2, "isError"    # Z
    .param p3, "active"    # Z
    .param p4, "daysLeft"    # I
    .param p5, "plan"    # Ljava/lang/String;
    .param p6, "error"    # Ljava/lang/String;

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/qmods/app/auth/SubscriptionDispatcher;->callback:Lcom/qmods/app/auth/SubscriptionCallback;

    iput-boolean p2, p0, Lcom/qmods/app/auth/SubscriptionDispatcher;->isError:Z

    iput-boolean p3, p0, Lcom/qmods/app/auth/SubscriptionDispatcher;->active:Z

    iput p4, p0, Lcom/qmods/app/auth/SubscriptionDispatcher;->daysLeft:I

    iput-object p5, p0, Lcom/qmods/app/auth/SubscriptionDispatcher;->plan:Ljava/lang/String;

    iput-object p6, p0, Lcom/qmods/app/auth/SubscriptionDispatcher;->error:Ljava/lang/String;

    return-void
.end method

.method public run()V
    .locals 5

    iget-boolean v0, p0, Lcom/qmods/app/auth/SubscriptionDispatcher;->isError:Z

    iget-object v1, p0, Lcom/qmods/app/auth/SubscriptionDispatcher;->callback:Lcom/qmods/app/auth/SubscriptionCallback;

    if-eqz v0, :dispatch_result

    iget-object v2, p0, Lcom/qmods/app/auth/SubscriptionDispatcher;->error:Ljava/lang/String;

    invoke-interface {v1, v2}, Lcom/qmods/app/auth/SubscriptionCallback;->onError(Ljava/lang/String;)V

    return-void

    :dispatch_result
    iget-boolean v2, p0, Lcom/qmods/app/auth/SubscriptionDispatcher;->active:Z

    iget v3, p0, Lcom/qmods/app/auth/SubscriptionDispatcher;->daysLeft:I

    iget-object v4, p0, Lcom/qmods/app/auth/SubscriptionDispatcher;->plan:Ljava/lang/String;

    invoke-interface {v1, v2, v3, v4}, Lcom/qmods/app/auth/SubscriptionCallback;->onResult(ZILjava/lang/String;)V

    return-void
.end method
