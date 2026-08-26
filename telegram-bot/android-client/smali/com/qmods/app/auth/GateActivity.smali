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

.field private badge:Landroid/widget/FrameLayout;

.field private pulseX:Landroid/animation/ObjectAnimator;

.field private pulseY:Landroid/animation/ObjectAnimator;

.field private pulseAlpha:Landroid/animation/ObjectAnimator;

.method public constructor <init>()V
    .locals 0

    invoke-direct {p0}, Landroid/app/Activity;-><init>()V

    return-void
.end method

.method public onCreate(Landroid/os/Bundle;)V
    .locals 10
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

    # --- root container: dark card, centered content ---
    new-instance v0, Landroid/widget/LinearLayout;

    invoke-direct {v0, p0}, Landroid/widget/LinearLayout;-><init>(Landroid/content/Context;)V

    const/4 v1, 0x1

    invoke-virtual {v0, v1}, Landroid/widget/LinearLayout;->setOrientation(I)V

    const/16 v1, 0x11

    invoke-virtual {v0, v1}, Landroid/widget/LinearLayout;->setGravity(I)V

    const/high16 v1, 0x42000000    # 32.0dp

    invoke-direct {p0, v1}, Lcom/qmods/app/auth/GateActivity;->dp(F)I

    move-result v1

    invoke-virtual {v0, v1, v1, v1, v1}, Landroid/view/View;->setPadding(IIII)V

    const v1, 0xff10141f

    invoke-virtual {v0, v1}, Landroid/view/View;->setBackgroundColor(I)V

    # --- circular gradient badge with a "sent" glyph (brand mark) ---
    new-instance v1, Landroid/widget/FrameLayout;

    invoke-direct {v1, p0}, Landroid/widget/FrameLayout;-><init>(Landroid/content/Context;)V

    iput-object v1, p0, Lcom/qmods/app/auth/GateActivity;->badge:Landroid/widget/FrameLayout;

    const/4 v4, 0x2

    new-array v3, v4, [I

    const v5, 0xff35a7ff

    const/4 v6, 0x0

    aput v5, v3, v6

    const v5, 0xff7c3aed

    const/4 v6, 0x1

    aput v5, v3, v6

    sget-object v5, Landroid/graphics/drawable/GradientDrawable$Orientation;->TL_BR:Landroid/graphics/drawable/GradientDrawable$Orientation;

    new-instance v6, Landroid/graphics/drawable/GradientDrawable;

    invoke-direct {v6, v5, v3}, Landroid/graphics/drawable/GradientDrawable;-><init>(Landroid/graphics/drawable/GradientDrawable$Orientation;[I)V

    const/4 v3, 0x1    # GradientDrawable.OVAL

    invoke-virtual {v6, v3}, Landroid/graphics/drawable/GradientDrawable;->setShape(I)V

    invoke-virtual {v1, v6}, Landroid/view/View;->setBackground(Landroid/graphics/drawable/Drawable;)V

    new-instance v3, Landroid/widget/TextView;

    invoke-direct {v3, p0}, Landroid/widget/TextView;-><init>(Landroid/content/Context;)V

    const-string v5, "➤"

    invoke-virtual {v3, v5}, Landroid/widget/TextView;->setText(Ljava/lang/CharSequence;)V

    const v5, 0xffffffff

    invoke-virtual {v3, v5}, Landroid/widget/TextView;->setTextColor(I)V

    const/high16 v5, 0x41c00000    # 24.0sp

    invoke-virtual {v3, v5}, Landroid/widget/TextView;->setTextSize(F)V

    sget-object v5, Landroid/graphics/Typeface;->DEFAULT_BOLD:Landroid/graphics/Typeface;

    invoke-virtual {v3, v5}, Landroid/widget/TextView;->setTypeface(Landroid/graphics/Typeface;)V

    const/high16 v5, -0x3dc00000    # -45.0f

    invoke-virtual {v3, v5}, Landroid/view/View;->setRotation(F)V

    new-instance v5, Landroid/widget/FrameLayout$LayoutParams;

    const/4 v7, -0x2    # WRAP_CONTENT

    const/16 v8, 0x11    # Gravity.CENTER

    invoke-direct {v5, v7, v7, v8}, Landroid/widget/FrameLayout$LayoutParams;-><init>(III)V

    invoke-virtual {v1, v3, v5}, Landroid/widget/FrameLayout;->addView(Landroid/view/View;Landroid/view/ViewGroup$LayoutParams;)V

    const/high16 v7, 0x42980000    # 76.0dp

    invoke-direct {p0, v7}, Lcom/qmods/app/auth/GateActivity;->dp(F)I

    move-result v7

    new-instance v5, Landroid/widget/LinearLayout$LayoutParams;

    invoke-direct {v5, v7, v7}, Landroid/widget/LinearLayout$LayoutParams;-><init>(II)V

    const/high16 v8, 0x41800000    # 16.0dp bottom margin

    invoke-direct {p0, v8}, Lcom/qmods/app/auth/GateActivity;->dp(F)I

    move-result v8

    const/4 v9, 0x0

    invoke-virtual {v5, v9, v9, v9, v8}, Landroid/view/ViewGroup$MarginLayoutParams;->setMargins(IIII)V

    invoke-virtual {v0, v1, v5}, Landroid/widget/LinearLayout;->addView(Landroid/view/View;Landroid/view/ViewGroup$LayoutParams;)V

    # --- eyebrow brand label ---
    new-instance v3, Landroid/widget/TextView;

    invoke-direct {v3, p0}, Landroid/widget/TextView;-><init>(Landroid/content/Context;)V

    const-string v5, "QMODS"

    invoke-virtual {v3, v5}, Landroid/widget/TextView;->setText(Ljava/lang/CharSequence;)V

    const/high16 v5, 0x41500000    # 13.0sp

    invoke-virtual {v3, v5}, Landroid/widget/TextView;->setTextSize(F)V

    const v5, 0xff8791a8

    invoke-virtual {v3, v5}, Landroid/widget/TextView;->setTextColor(I)V

    const/16 v5, 0x11

    invoke-virtual {v3, v5}, Landroid/widget/TextView;->setGravity(I)V

    const v5, 0x3e800000    # 0.25em letter spacing

    invoke-virtual {v3, v5}, Landroid/widget/TextView;->setLetterSpacing(F)V

    invoke-virtual {v0, v3}, Landroid/widget/LinearLayout;->addView(Landroid/view/View;)V

    # --- headline / status message ---
    new-instance v1, Landroid/widget/TextView;

    invoke-direct {v1, p0}, Landroid/widget/TextView;-><init>(Landroid/content/Context;)V

    iput-object v1, p0, Lcom/qmods/app/auth/GateActivity;->messageView:Landroid/widget/TextView;

    const/high16 v3, 0x41a00000    # 20.0sp

    invoke-virtual {v1, v3}, Landroid/widget/TextView;->setTextSize(F)V

    sget-object v3, Landroid/graphics/Typeface;->DEFAULT_BOLD:Landroid/graphics/Typeface;

    invoke-virtual {v1, v3}, Landroid/widget/TextView;->setTypeface(Landroid/graphics/Typeface;)V

    const/16 v3, 0x11

    invoke-virtual {v1, v3}, Landroid/widget/TextView;->setGravity(I)V

    const v3, 0xffffffff

    invoke-virtual {v1, v3}, Landroid/widget/TextView;->setTextColor(I)V

    new-instance v3, Landroid/widget/LinearLayout$LayoutParams;

    const/4 v4, -0x2    # WRAP_CONTENT

    invoke-direct {v3, v4, v4}, Landroid/widget/LinearLayout$LayoutParams;-><init>(II)V

    const/high16 v5, 0x41400000    # 12.0dp top

    invoke-direct {p0, v5}, Lcom/qmods/app/auth/GateActivity;->dp(F)I

    move-result v5

    const/high16 v6, 0x41e00000    # 28.0dp bottom

    invoke-direct {p0, v6}, Lcom/qmods/app/auth/GateActivity;->dp(F)I

    move-result v6

    const/4 v7, 0x0

    invoke-virtual {v3, v7, v5, v7, v6}, Landroid/view/ViewGroup$MarginLayoutParams;->setMargins(IIII)V

    invoke-virtual {v0, v1, v3}, Landroid/widget/LinearLayout;->addView(Landroid/view/View;Landroid/view/ViewGroup$LayoutParams;)V

    # --- pairing-code chip (hidden until a code arrives, see onCodeReady) ---
    new-instance v1, Landroid/widget/TextView;

    invoke-direct {v1, p0}, Landroid/widget/TextView;-><init>(Landroid/content/Context;)V

    iput-object v1, p0, Lcom/qmods/app/auth/GateActivity;->codeView:Landroid/widget/TextView;

    const/high16 v3, 0x41e00000    # 28.0sp

    invoke-virtual {v1, v3}, Landroid/widget/TextView;->setTextSize(F)V

    sget-object v3, Landroid/graphics/Typeface;->DEFAULT_BOLD:Landroid/graphics/Typeface;

    invoke-virtual {v1, v3}, Landroid/widget/TextView;->setTypeface(Landroid/graphics/Typeface;)V

    const v3, 0xff9db4ff

    invoke-virtual {v1, v3}, Landroid/widget/TextView;->setTextColor(I)V

    const/16 v3, 0x11

    invoke-virtual {v1, v3}, Landroid/widget/TextView;->setGravity(I)V

    const v3, 0x3f000000    # 0.5em letter spacing

    invoke-virtual {v1, v3}, Landroid/widget/TextView;->setLetterSpacing(F)V

    const/16 v3, 0x8    # View.GONE

    invoke-virtual {v1, v3}, Landroid/view/View;->setVisibility(I)V

    new-instance v3, Landroid/graphics/drawable/GradientDrawable;

    invoke-direct {v3}, Landroid/graphics/drawable/GradientDrawable;-><init>()V

    const v5, 0xff1b2333

    invoke-virtual {v3, v5}, Landroid/graphics/drawable/GradientDrawable;->setColor(I)V

    const/high16 v5, 0x41800000    # 16.0dp corner radius

    invoke-direct {p0, v5}, Lcom/qmods/app/auth/GateActivity;->dp(F)I

    move-result v5

    int-to-float v5, v5

    invoke-virtual {v3, v5}, Landroid/graphics/drawable/GradientDrawable;->setCornerRadius(F)V

    invoke-virtual {v1, v3}, Landroid/view/View;->setBackground(Landroid/graphics/drawable/Drawable;)V

    const/high16 v5, 0x41400000    # 12.0dp vertical padding

    invoke-direct {p0, v5}, Lcom/qmods/app/auth/GateActivity;->dp(F)I

    move-result v5

    const/high16 v6, 0x41c00000    # 24.0dp horizontal padding

    invoke-direct {p0, v6}, Lcom/qmods/app/auth/GateActivity;->dp(F)I

    move-result v6

    invoke-virtual {v1, v6, v5, v6, v5}, Landroid/view/View;->setPadding(IIII)V

    new-instance v3, Landroid/widget/LinearLayout$LayoutParams;

    const/4 v4, -0x2    # WRAP_CONTENT

    invoke-direct {v3, v4, v4}, Landroid/widget/LinearLayout$LayoutParams;-><init>(II)V

    const/high16 v5, 0x41000000    # 8.0dp top

    invoke-direct {p0, v5}, Lcom/qmods/app/auth/GateActivity;->dp(F)I

    move-result v5

    const/high16 v6, 0x41800000    # 16.0dp bottom

    invoke-direct {p0, v6}, Lcom/qmods/app/auth/GateActivity;->dp(F)I

    move-result v6

    const/4 v7, 0x0

    invoke-virtual {v3, v7, v7, v7, v6}, Landroid/view/ViewGroup$MarginLayoutParams;->setMargins(IIII)V

    invoke-virtual {v0, v1, v3}, Landroid/widget/LinearLayout;->addView(Landroid/view/View;Landroid/view/ViewGroup$LayoutParams;)V

    # --- action button: rounded, brand gradient, no default grey chrome ---
    new-instance v1, Landroid/widget/Button;

    invoke-direct {v1, p0}, Landroid/widget/Button;-><init>(Landroid/content/Context;)V

    iput-object v1, p0, Lcom/qmods/app/auth/GateActivity;->actionButton:Landroid/widget/Button;

    invoke-virtual {v1, p0}, Landroid/widget/Button;->setOnClickListener(Landroid/view/View$OnClickListener;)V

    const/4 v3, 0x0

    invoke-virtual {v1, v3}, Landroid/widget/Button;->setAllCaps(Z)V

    const v3, 0xffffffff

    invoke-virtual {v1, v3}, Landroid/widget/Button;->setTextColor(I)V

    const/high16 v3, 0x41800000    # 16.0sp

    invoke-virtual {v1, v3}, Landroid/widget/Button;->setTextSize(F)V

    sget-object v3, Landroid/graphics/Typeface;->DEFAULT_BOLD:Landroid/graphics/Typeface;

    invoke-virtual {v1, v3}, Landroid/widget/Button;->setTypeface(Landroid/graphics/Typeface;)V

    const/4 v4, 0x2

    new-array v3, v4, [I

    const v5, 0xff3157ff

    const/4 v6, 0x0

    aput v5, v3, v6

    const v5, 0xff7c3aed

    const/4 v6, 0x1

    aput v5, v3, v6

    sget-object v5, Landroid/graphics/drawable/GradientDrawable$Orientation;->TL_BR:Landroid/graphics/drawable/GradientDrawable$Orientation;

    new-instance v6, Landroid/graphics/drawable/GradientDrawable;

    invoke-direct {v6, v5, v3}, Landroid/graphics/drawable/GradientDrawable;-><init>(Landroid/graphics/drawable/GradientDrawable$Orientation;[I)V

    const/high16 v3, 0x41800000    # 16.0dp corner radius

    invoke-direct {p0, v3}, Lcom/qmods/app/auth/GateActivity;->dp(F)I

    move-result v3

    int-to-float v3, v3

    invoke-virtual {v6, v3}, Landroid/graphics/drawable/GradientDrawable;->setCornerRadius(F)V

    invoke-virtual {v1, v6}, Landroid/view/View;->setBackground(Landroid/graphics/drawable/Drawable;)V

    const/high16 v3, 0x42000000    # 32.0dp horizontal padding

    invoke-direct {p0, v3}, Lcom/qmods/app/auth/GateActivity;->dp(F)I

    move-result v3

    const/high16 v5, 0x41600000    # 14.0dp vertical padding

    invoke-direct {p0, v5}, Lcom/qmods/app/auth/GateActivity;->dp(F)I

    move-result v5

    invoke-virtual {v1, v3, v5, v3, v5}, Landroid/view/View;->setPadding(IIII)V

    new-instance v3, Landroid/widget/LinearLayout$LayoutParams;

    const/4 v4, -0x2    # WRAP_CONTENT

    invoke-direct {v3, v4, v4}, Landroid/widget/LinearLayout$LayoutParams;-><init>(II)V

    const/high16 v5, 0x41800000    # 16.0dp top

    invoke-direct {p0, v5}, Lcom/qmods/app/auth/GateActivity;->dp(F)I

    move-result v5

    const/4 v6, 0x0

    invoke-virtual {v3, v6, v5, v6, v6}, Landroid/view/ViewGroup$MarginLayoutParams;->setMargins(IIII)V

    invoke-virtual {v0, v1, v3}, Landroid/widget/LinearLayout;->addView(Landroid/view/View;Landroid/view/ViewGroup$LayoutParams;)V

    invoke-virtual {p0, v0}, Landroid/app/Activity;->setContentView(Landroid/view/View;)V

    invoke-direct {p0}, Lcom/qmods/app/auth/GateActivity;->applyMode()V

    # --- entrance: fade + slide the whole card in ---
    const/4 v3, 0x0

    invoke-virtual {v0, v3}, Landroid/view/View;->setAlpha(F)V

    const/high16 v8, 0x41c00000    # 24.0dp

    invoke-direct {p0, v8}, Lcom/qmods/app/auth/GateActivity;->dp(F)I

    move-result v8

    int-to-float v8, v8

    invoke-virtual {v0, v8}, Landroid/view/View;->setTranslationY(F)V

    const-string v4, "alpha"

    const/4 v5, 0x2

    new-array v5, v5, [F

    const/4 v6, 0x0

    const/4 v7, 0x0

    aput v7, v5, v6

    const/4 v6, 0x1

    const/high16 v7, 0x3f800000    # 1.0f

    aput v7, v5, v6

    invoke-static {v0, v4, v5}, Landroid/animation/ObjectAnimator;->ofFloat(Ljava/lang/Object;Ljava/lang/String;[F)Landroid/animation/ObjectAnimator;

    move-result-object v4

    new-instance v6, Landroid/view/animation/DecelerateInterpolator;

    invoke-direct {v6}, Landroid/view/animation/DecelerateInterpolator;-><init>()V

    invoke-virtual {v4, v6}, Landroid/animation/ObjectAnimator;->setInterpolator(Landroid/animation/TimeInterpolator;)V

    const-wide/16 v6, 0x1c2    # 450ms

    invoke-virtual {v4, v6, v7}, Landroid/animation/ObjectAnimator;->setDuration(J)Landroid/animation/ValueAnimator;

    invoke-virtual {v4}, Landroid/animation/ObjectAnimator;->start()V

    const-string v4, "translationY"

    const/4 v5, 0x2

    new-array v5, v5, [F

    const/4 v6, 0x0

    aput v8, v5, v6

    const/4 v6, 0x1

    const/4 v9, 0x0

    aput v9, v5, v6

    invoke-static {v0, v4, v5}, Landroid/animation/ObjectAnimator;->ofFloat(Ljava/lang/Object;Ljava/lang/String;[F)Landroid/animation/ObjectAnimator;

    move-result-object v4

    new-instance v6, Landroid/view/animation/DecelerateInterpolator;

    invoke-direct {v6}, Landroid/view/animation/DecelerateInterpolator;-><init>()V

    invoke-virtual {v4, v6}, Landroid/animation/ObjectAnimator;->setInterpolator(Landroid/animation/TimeInterpolator;)V

    const-wide/16 v6, 0x1c2    # 450ms

    invoke-virtual {v4, v6, v7}, Landroid/animation/ObjectAnimator;->setDuration(J)Landroid/animation/ValueAnimator;

    invoke-virtual {v4}, Landroid/animation/ObjectAnimator;->start()V

    return-void
.end method

# Converts a dp value to px using this Activity's current display metrics —
# used for every hand-built size below so the screen looks the same across
# densities instead of just "however many raw pixels" the old version drew.
.method private dp(F)I
    .locals 2
    .param p1, "value"    # F

    invoke-virtual {p0}, Lcom/qmods/app/auth/GateActivity;->getResources()Landroid/content/res/Resources;

    move-result-object v0

    invoke-virtual {v0}, Landroid/content/res/Resources;->getDisplayMetrics()Landroid/util/DisplayMetrics;

    move-result-object v0

    const/4 v1, 0x1    # TypedValue.COMPLEX_UNIT_DIP

    invoke-static {v1, p1, v0}, Landroid/util/TypedValue;->applyDimension(IFLandroid/util/DisplayMetrics;)F

    move-result v1

    float-to-int v1, v1

    return v1
.end method

# Starts a looping "breathing" animation (scale + alpha) on the brand badge
# — only while mode == "pair", to draw the eye to the Telegram button while
# we're waiting on the user. applyMode() cancels this via stopPulse() first,
# so switching modes never leaves a stray animator running.
.method private startPulse()V
    .locals 8

    iget-object v0, p0, Lcom/qmods/app/auth/GateActivity;->badge:Landroid/widget/FrameLayout;

    const-string v1, "scaleX"

    const/4 v2, 0x2

    new-array v2, v2, [F

    const/high16 v3, 0x3f800000    # 1.0f

    const/4 v4, 0x0

    aput v3, v2, v4

    const/high16 v3, 0x3f900000    # 1.125f

    const/4 v4, 0x1

    aput v3, v2, v4

    invoke-static {v0, v1, v2}, Landroid/animation/ObjectAnimator;->ofFloat(Ljava/lang/Object;Ljava/lang/String;[F)Landroid/animation/ObjectAnimator;

    move-result-object v3

    iput-object v3, p0, Lcom/qmods/app/auth/GateActivity;->pulseX:Landroid/animation/ObjectAnimator;

    const-wide/16 v4, 0x44c    # 1100ms

    invoke-virtual {v3, v4, v5}, Landroid/animation/ObjectAnimator;->setDuration(J)Landroid/animation/ValueAnimator;

    const/4 v4, -0x1    # ValueAnimator.INFINITE

    invoke-virtual {v3, v4}, Landroid/animation/ObjectAnimator;->setRepeatCount(I)V

    const/4 v4, 0x2    # ValueAnimator.REVERSE

    invoke-virtual {v3, v4}, Landroid/animation/ObjectAnimator;->setRepeatMode(I)V

    invoke-virtual {v3}, Landroid/animation/ObjectAnimator;->start()V

    iget-object v0, p0, Lcom/qmods/app/auth/GateActivity;->badge:Landroid/widget/FrameLayout;

    const-string v1, "scaleY"

    const/4 v2, 0x2

    new-array v2, v2, [F

    const/high16 v3, 0x3f800000    # 1.0f

    const/4 v4, 0x0

    aput v3, v2, v4

    const/high16 v3, 0x3f900000    # 1.125f

    const/4 v4, 0x1

    aput v3, v2, v4

    invoke-static {v0, v1, v2}, Landroid/animation/ObjectAnimator;->ofFloat(Ljava/lang/Object;Ljava/lang/String;[F)Landroid/animation/ObjectAnimator;

    move-result-object v3

    iput-object v3, p0, Lcom/qmods/app/auth/GateActivity;->pulseY:Landroid/animation/ObjectAnimator;

    const-wide/16 v4, 0x44c

    invoke-virtual {v3, v4, v5}, Landroid/animation/ObjectAnimator;->setDuration(J)Landroid/animation/ValueAnimator;

    const/4 v4, -0x1

    invoke-virtual {v3, v4}, Landroid/animation/ObjectAnimator;->setRepeatCount(I)V

    const/4 v4, 0x2

    invoke-virtual {v3, v4}, Landroid/animation/ObjectAnimator;->setRepeatMode(I)V

    invoke-virtual {v3}, Landroid/animation/ObjectAnimator;->start()V

    iget-object v0, p0, Lcom/qmods/app/auth/GateActivity;->badge:Landroid/widget/FrameLayout;

    const-string v1, "alpha"

    const/4 v2, 0x2

    new-array v2, v2, [F

    const/high16 v3, 0x3f800000    # 1.0f

    const/4 v4, 0x0

    aput v3, v2, v4

    const/high16 v3, 0x3f200000    # 0.625f

    const/4 v4, 0x1

    aput v3, v2, v4

    invoke-static {v0, v1, v2}, Landroid/animation/ObjectAnimator;->ofFloat(Ljava/lang/Object;Ljava/lang/String;[F)Landroid/animation/ObjectAnimator;

    move-result-object v3

    iput-object v3, p0, Lcom/qmods/app/auth/GateActivity;->pulseAlpha:Landroid/animation/ObjectAnimator;

    const-wide/16 v4, 0x44c

    invoke-virtual {v3, v4, v5}, Landroid/animation/ObjectAnimator;->setDuration(J)Landroid/animation/ValueAnimator;

    const/4 v4, -0x1

    invoke-virtual {v3, v4}, Landroid/animation/ObjectAnimator;->setRepeatCount(I)V

    const/4 v4, 0x2

    invoke-virtual {v3, v4}, Landroid/animation/ObjectAnimator;->setRepeatMode(I)V

    invoke-virtual {v3}, Landroid/animation/ObjectAnimator;->start()V

    return-void
.end method

# Cancels any running pulse animators and resets the badge to its resting
# scale/alpha — called at the top of applyMode() so switching away from
# "pair" (or re-entering it) never stacks or leaks animators.
.method private stopPulse()V
    .locals 2

    iget-object v0, p0, Lcom/qmods/app/auth/GateActivity;->pulseX:Landroid/animation/ObjectAnimator;

    if-eqz v0, :no_x

    invoke-virtual {v0}, Landroid/animation/ObjectAnimator;->cancel()V

    :no_x
    iget-object v0, p0, Lcom/qmods/app/auth/GateActivity;->pulseY:Landroid/animation/ObjectAnimator;

    if-eqz v0, :no_y

    invoke-virtual {v0}, Landroid/animation/ObjectAnimator;->cancel()V

    :no_y
    iget-object v0, p0, Lcom/qmods/app/auth/GateActivity;->pulseAlpha:Landroid/animation/ObjectAnimator;

    if-eqz v0, :no_alpha

    invoke-virtual {v0}, Landroid/animation/ObjectAnimator;->cancel()V

    :no_alpha
    iget-object v0, p0, Lcom/qmods/app/auth/GateActivity;->badge:Landroid/widget/FrameLayout;

    if-eqz v0, :done

    const/high16 v1, 0x3f800000    # 1.0f

    invoke-virtual {v0, v1}, Landroid/view/View;->setScaleX(F)V

    invoke-virtual {v0, v1}, Landroid/view/View;->setScaleY(F)V

    invoke-virtual {v0, v1}, Landroid/view/View;->setAlpha(F)V

    :done
    return-void
.end method

.method protected onDestroy()V
    .locals 0

    invoke-direct {p0}, Lcom/qmods/app/auth/GateActivity;->stopPulse()V

    invoke-super {p0}, Landroid/app/Activity;->onDestroy()V

    return-void
.end method

.method private applyMode()V
    .locals 4

    invoke-direct {p0}, Lcom/qmods/app/auth/GateActivity;->stopPulse()V

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

    invoke-direct {p0}, Lcom/qmods/app/auth/GateActivity;->startPulse()V

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
    .locals 2
    .param p1, "code"    # Ljava/lang/String;
    .param p2, "deepLink"    # Ljava/lang/String;

    iget-object v0, p0, Lcom/qmods/app/auth/GateActivity;->codeView:Landroid/widget/TextView;

    invoke-virtual {v0, p1}, Landroid/widget/TextView;->setText(Ljava/lang/CharSequence;)V

    const/4 v1, 0x0    # View.VISIBLE

    invoke-virtual {v0, v1}, Landroid/view/View;->setVisibility(I)V

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

    const/16 v1, 0x8    # View.GONE

    invoke-virtual {v0, v1}, Landroid/view/View;->setVisibility(I)V

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

    const/16 v2, 0x8    # View.GONE

    invoke-virtual {v1, v2}, Landroid/view/View;->setVisibility(I)V

    return-void
.end method
