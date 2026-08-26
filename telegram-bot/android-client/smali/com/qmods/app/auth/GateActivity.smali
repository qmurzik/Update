.class public Lcom/qmods/app/auth/GateActivity;
.super Landroid/app/Activity;
.source "GateActivity.java"
.implements Lcom/qmods/app/auth/PairingCallback;
.implements Lcom/qmods/app/auth/SubscriptionCallback;
.implements Landroid/view/View$OnClickListener;

# Minimal blocking screen shown instead of the app's real content whenever
# the device isn't paired or the subscription isn't active. Built entirely
# with framework views constructed in code (no XML layout / resource IDs
# needed) so it drops into any project without a res/ dependency — restyle
# freely once it works, this is functional, not final design.
#
# Launched by MainActivity via an Intent extra "mode":
#   "pair"    — device_token missing or revoked; shows a "Войти через
#               Telegram" button that starts the pairing flow.
#   "paywall" — paired but subscription inactive; shows a retry button.
#   "error"   — the subscription check itself failed (network/server);
#               fail-closed, same as "paywall" but different copy.
# On success (paired + active) it starts MainActivity and finishes itself.

.field private mode:Ljava/lang/String;

.field private messageView:Landroid/widget/TextView;

.field private codeView:Landroid/widget/TextView;

.field private actionButton:Landroid/widget/Button;

.method public constructor <init>()V
    .locals 0

    invoke-direct {p0}, Landroid/app/Activity;-><init>()V

    return-void
.end method

.method public onCreate(Landroid/os/Bundle;)V
    .locals 6
    .param p1, "savedInstanceState"    # Landroid/os/Bundle;

    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    invoke-virtual {p0}, Lcom/qmods/app/auth/GateActivity;->getIntent()Landroid/content/Intent;

    move-result-object v0

    const-string v1, "mode"

    invoke-virtual {v0, v1}, Landroid/content/Intent;->getStringExtra(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v2

    if-nez v2, :mode_ok

    const-string v2, "pair"

    :mode_ok
    iput-object v2, p0, Lcom/qmods/app/auth/GateActivity;->mode:Ljava/lang/String;

    new-instance v0, Landroid/widget/LinearLayout;

    invoke-direct {v0, p0}, Landroid/widget/LinearLayout;-><init>(Landroid/content/Context;)V

    const/4 v1, 0x1

    invoke-virtual {v0, v1}, Landroid/widget/LinearLayout;->setOrientation(I)V

    const/16 v1, 0x11

    invoke-virtual {v0, v1}, Landroid/widget/LinearLayout;->setGravity(I)V

    const/16 v1, 0x30

    invoke-virtual {v0, v1, v1, v1, v1}, Landroid/view/View;->setPadding(IIII)V

    new-instance v1, Landroid/widget/TextView;

    invoke-direct {v1, p0}, Landroid/widget/TextView;-><init>(Landroid/content/Context;)V

    iput-object v1, p0, Lcom/qmods/app/auth/GateActivity;->messageView:Landroid/widget/TextView;

    const/high16 v3, 0x41a00000

    invoke-virtual {v1, v3}, Landroid/widget/TextView;->setTextSize(F)V

    const/16 v3, 0x11

    invoke-virtual {v1, v3}, Landroid/widget/TextView;->setGravity(I)V

    invoke-virtual {v0, v1}, Landroid/widget/LinearLayout;->addView(Landroid/view/View;)V

    new-instance v4, Landroid/widget/TextView;

    invoke-direct {v4, p0}, Landroid/widget/TextView;-><init>(Landroid/content/Context;)V

    iput-object v4, p0, Lcom/qmods/app/auth/GateActivity;->codeView:Landroid/widget/TextView;

    invoke-virtual {v0, v4}, Landroid/widget/LinearLayout;->addView(Landroid/view/View;)V

    new-instance v5, Landroid/widget/Button;

    invoke-direct {v5, p0}, Landroid/widget/Button;-><init>(Landroid/content/Context;)V

    iput-object v5, p0, Lcom/qmods/app/auth/GateActivity;->actionButton:Landroid/widget/Button;

    invoke-virtual {v5, p0}, Landroid/widget/Button;->setOnClickListener(Landroid/view/View$OnClickListener;)V

    invoke-virtual {v0, v5}, Landroid/widget/LinearLayout;->addView(Landroid/view/View;)V

    invoke-virtual {p0, v0}, Landroid/app/Activity;->setContentView(Landroid/view/View;)V

    invoke-direct {p0}, Lcom/qmods/app/auth/GateActivity;->applyMode()V

    return-void
.end method

.method private applyMode()V
    .locals 4

    iget-object v0, p0, Lcom/qmods/app/auth/GateActivity;->mode:Ljava/lang/String;

    iget-object v1, p0, Lcom/qmods/app/auth/GateActivity;->messageView:Landroid/widget/TextView;

    iget-object v2, p0, Lcom/qmods/app/auth/GateActivity;->actionButton:Landroid/widget/Button;

    const-string v3, "pair"

    invoke-virtual {v3, v0}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z

    move-result v3

    if-eqz v3, :check_paywall

    const-string v3, "Войдите через Telegram, чтобы продолжить."

    invoke-virtual {v1, v3}, Landroid/widget/TextView;->setText(Ljava/lang/CharSequence;)V

    const-string v3, "Войти через Telegram"

    invoke-virtual {v2, v3}, Landroid/widget/Button;->setText(Ljava/lang/CharSequence;)V

    return-void

    :check_paywall
    const-string v3, "paywall"

    invoke-virtual {v3, v0}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z

    move-result v3

    if-eqz v3, :is_error

    const-string v3, "Подписка не активна."

    invoke-virtual {v1, v3}, Landroid/widget/TextView;->setText(Ljava/lang/CharSequence;)V

    const-string v3, "Проверить снова"

    invoke-virtual {v2, v3}, Landroid/widget/Button;->setText(Ljava/lang/CharSequence;)V

    return-void

    :is_error
    const-string v3, "Не удалось проверить подписку. Проверьте интернет."

    invoke-virtual {v1, v3}, Landroid/widget/TextView;->setText(Ljava/lang/CharSequence;)V

    const-string v3, "Повторить"

    invoke-virtual {v2, v3}, Landroid/widget/Button;->setText(Ljava/lang/CharSequence;)V

    return-void
.end method

.method public onClick(Landroid/view/View;)V
    .locals 2
    .param p1, "v"    # Landroid/view/View;

    iget-object v0, p0, Lcom/qmods/app/auth/GateActivity;->mode:Ljava/lang/String;

    const-string v1, "pair"

    invoke-virtual {v1, v0}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z

    move-result v1

    if-eqz v1, :do_check

    invoke-static {p0, p0}, Lcom/qmods/app/auth/DevicePairing;->startPairing(Landroid/content/Context;Lcom/qmods/app/auth/PairingCallback;)V

    return-void

    :do_check
    invoke-static {p0, p0}, Lcom/qmods/app/auth/SubscriptionChecker;->check(Landroid/content/Context;Lcom/qmods/app/auth/SubscriptionCallback;)V

    return-void
.end method

.method public onCodeReady(Ljava/lang/String;Ljava/lang/String;)V
    .locals 1
    .param p1, "code"    # Ljava/lang/String;
    .param p2, "deepLink"    # Ljava/lang/String;

    iget-object v0, p0, Lcom/qmods/app/auth/GateActivity;->codeView:Landroid/widget/TextView;

    invoke-virtual {v0, p1}, Landroid/widget/TextView;->setText(Ljava/lang/CharSequence;)V

    return-void
.end method

.method public onPaired(Ljava/lang/String;)V
    .locals 0
    .param p1, "deviceToken"    # Ljava/lang/String;

    invoke-static {p0, p0}, Lcom/qmods/app/auth/SubscriptionChecker;->check(Landroid/content/Context;Lcom/qmods/app/auth/SubscriptionCallback;)V

    return-void
.end method

.method public onFailed(Ljava/lang/String;)V
    .locals 1
    .param p1, "reason"    # Ljava/lang/String;

    iget-object v0, p0, Lcom/qmods/app/auth/GateActivity;->codeView:Landroid/widget/TextView;

    invoke-virtual {v0, p1}, Landroid/widget/TextView;->setText(Ljava/lang/CharSequence;)V

    return-void
.end method

.method public onResult(ZILjava/lang/String;)V
    .locals 2
    .param p1, "active"    # Z
    .param p2, "daysLeft"    # I
    .param p3, "plan"    # Ljava/lang/String;

    if-eqz p1, :still_inactive

    new-instance v0, Landroid/content/Intent;

    const-class v1, Lcom/instashopper/MainActivity;

    invoke-direct {v0, p0, v1}, Landroid/content/Intent;-><init>(Landroid/content/Context;Ljava/lang/Class;)V

    invoke-virtual {p0, v0}, Landroid/app/Activity;->startActivity(Landroid/content/Intent;)V

    invoke-virtual {p0}, Landroid/app/Activity;->finish()V

    return-void

    :still_inactive
    const-string v0, "paywall"

    iput-object v0, p0, Lcom/qmods/app/auth/GateActivity;->mode:Ljava/lang/String;

    invoke-direct {p0}, Lcom/qmods/app/auth/GateActivity;->applyMode()V

    iget-object v0, p0, Lcom/qmods/app/auth/GateActivity;->codeView:Landroid/widget/TextView;

    const-string v1, ""

    invoke-virtual {v0, v1}, Landroid/widget/TextView;->setText(Ljava/lang/CharSequence;)V

    return-void
.end method

.method public onError(Ljava/lang/String;)V
    .locals 3
    .param p1, "reason"    # Ljava/lang/String;

    const-string v0, "not_paired"

    invoke-virtual {v0, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z

    move-result v0

    if-eqz v0, :is_other

    const-string v1, "pair"

    goto :set_mode

    :is_other
    const-string v1, "error"

    :set_mode
    iput-object v1, p0, Lcom/qmods/app/auth/GateActivity;->mode:Ljava/lang/String;

    invoke-direct {p0}, Lcom/qmods/app/auth/GateActivity;->applyMode()V

    iget-object v1, p0, Lcom/qmods/app/auth/GateActivity;->codeView:Landroid/widget/TextView;

    const-string v2, ""

    invoke-virtual {v1, v2}, Landroid/widget/TextView;->setText(Ljava/lang/CharSequence;)V

    return-void
.end method
