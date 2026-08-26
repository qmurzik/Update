.class public Lcom/qmods/app/auth/CallbackDispatcher;
.super Ljava/lang/Object;
.source "CallbackDispatcher.java"
.implements Ljava/lang/Runnable;

# Posted to the main-thread Handler by DevicePairingRunnable so the three
# PairingCallback methods are always invoked on the UI thread, never from
# the background pairing thread. One small reusable Runnable instead of
# three near-identical inner classes.

.field private final callback:Lcom/qmods/app/auth/PairingCallback;

.field private final kind:I

.field private final arg1:Ljava/lang/String;

.field private final arg2:Ljava/lang/String;

# kind: 0 = onCodeReady(arg1=code, arg2=deepLink)
#       1 = onPaired(arg1=deviceToken)
#       2 = onFailed(arg1=reason)
.method public constructor <init>(Lcom/qmods/app/auth/PairingCallback;ILjava/lang/String;Ljava/lang/String;)V
    .locals 0
    .param p1, "callback"    # Lcom/qmods/app/auth/PairingCallback;
    .param p2, "kind"    # I
    .param p3, "arg1"    # Ljava/lang/String;
    .param p4, "arg2"    # Ljava/lang/String;

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/qmods/app/auth/CallbackDispatcher;->callback:Lcom/qmods/app/auth/PairingCallback;

    iput p2, p0, Lcom/qmods/app/auth/CallbackDispatcher;->kind:I

    iput-object p3, p0, Lcom/qmods/app/auth/CallbackDispatcher;->arg1:Ljava/lang/String;

    iput-object p4, p0, Lcom/qmods/app/auth/CallbackDispatcher;->arg2:Ljava/lang/String;

    return-void
.end method

.method public run()V
    .locals 5

    iget-object v1, p0, Lcom/qmods/app/auth/CallbackDispatcher;->callback:Lcom/qmods/app/auth/PairingCallback;

    iget-object v2, p0, Lcom/qmods/app/auth/CallbackDispatcher;->arg1:Ljava/lang/String;

    iget-object v3, p0, Lcom/qmods/app/auth/CallbackDispatcher;->arg2:Ljava/lang/String;

    iget v0, p0, Lcom/qmods/app/auth/CallbackDispatcher;->kind:I

    if-nez v0, :check_kind_1

    invoke-interface {v1, v2, v3}, Lcom/qmods/app/auth/PairingCallback;->onCodeReady(Ljava/lang/String;Ljava/lang/String;)V

    return-void

    :check_kind_1
    const/4 v4, 0x1

    if-ne v0, v4, :check_kind_2

    invoke-interface {v1, v2}, Lcom/qmods/app/auth/PairingCallback;->onPaired(Ljava/lang/String;)V

    return-void

    :check_kind_2
    invoke-interface {v1, v2}, Lcom/qmods/app/auth/PairingCallback;->onFailed(Ljava/lang/String;)V

    return-void
.end method
