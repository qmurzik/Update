.class public Lcom/qmods/app/auth/CrashHandler;
.super Ljava/lang/Object;
.source "CrashHandler.java"
.implements Ljava/lang/Thread$UncaughtExceptionHandler;

# Call ONCE, as early as possible (Application.onCreate() if you have a
# custom Application class, otherwise your launcher Activity's onCreate()):
#
#   CrashHandler.install(this);
#
# Every uncaught exception on any thread from then on gets a best-effort
# POST to the Worker (see CrashReportRunnable) before falling through to
# whatever the platform would normally have done — this class never
# suppresses the crash itself, it only reports it first. Reports land as
# Telegram alerts to the admins (same channel as the bot/worker's own
# hidden-error alerts, see worker/src/errorReport.ts), deduped server-side
# so one bad release doesn't flood the chat with one alert per user hit.

.field private final context:Landroid/content/Context;

.field private final previous:Ljava/lang/Thread$UncaughtExceptionHandler;

.method public constructor <init>(Landroid/content/Context;Ljava/lang/Thread$UncaughtExceptionHandler;)V
    .locals 0
    .param p1, "context"    # Landroid/content/Context;
    .param p2, "previous"    # Ljava/lang/Thread$UncaughtExceptionHandler;

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/qmods/app/auth/CrashHandler;->context:Landroid/content/Context;

    iput-object p2, p0, Lcom/qmods/app/auth/CrashHandler;->previous:Ljava/lang/Thread$UncaughtExceptionHandler;

    return-void
.end method

.method public static install(Landroid/content/Context;)V
    .locals 3
    .param p0, "context"    # Landroid/content/Context;

    invoke-virtual {p0}, Landroid/content/Context;->getApplicationContext()Landroid/content/Context;

    move-result-object v0

    invoke-static {}, Ljava/lang/Thread;->getDefaultUncaughtExceptionHandler()Ljava/lang/Thread$UncaughtExceptionHandler;

    move-result-object v1

    new-instance v2, Lcom/qmods/app/auth/CrashHandler;

    invoke-direct {v2, v0, v1}, Lcom/qmods/app/auth/CrashHandler;-><init>(Landroid/content/Context;Ljava/lang/Thread$UncaughtExceptionHandler;)V

    invoke-static {v2}, Ljava/lang/Thread;->setDefaultUncaughtExceptionHandler(Ljava/lang/Thread$UncaughtExceptionHandler;)V

    return-void
.end method

# Starts the report on its own thread and waits AT MOST ~2s for it — long
# enough to usually get the POST out, short enough not to freeze a crashed
# app indefinitely. Whatever happens (report finished, timed out, or threw),
# execution always reaches the platform's own handler at the end, so the
# normal "app has stopped" flow still happens exactly as if this class
# didn't exist — this only ever adds a brief, bounded delay in front of it.
.method public uncaughtException(Ljava/lang/Thread;Ljava/lang/Throwable;)V
    .locals 5
    .param p1, "thread"    # Ljava/lang/Thread;
    .param p2, "throwable"    # Ljava/lang/Throwable;

    :try_start
    iget-object v0, p0, Lcom/qmods/app/auth/CrashHandler;->context:Landroid/content/Context;

    new-instance v1, Lcom/qmods/app/auth/CrashReportRunnable;

    invoke-direct {v1, v0, p2}, Lcom/qmods/app/auth/CrashReportRunnable;-><init>(Landroid/content/Context;Ljava/lang/Throwable;)V

    new-instance v2, Ljava/lang/Thread;

    invoke-direct {v2, v1}, Ljava/lang/Thread;-><init>(Ljava/lang/Runnable;)V

    invoke-virtual {v2}, Ljava/lang/Thread;->start()V

    const-wide/16 v3, 0x7d0    # 2000ms

    invoke-virtual {v2, v3, v4}, Ljava/lang/Thread;->join(J)V
    :try_end
    .catch Ljava/lang/Exception; {:try_start .. :try_end} :catch_all

    goto :deliver

    :catch_all
    move-exception v0

    :deliver
    iget-object v0, p0, Lcom/qmods/app/auth/CrashHandler;->previous:Ljava/lang/Thread$UncaughtExceptionHandler;

    if-eqz v0, :no_previous

    invoke-interface {v0, p1, p2}, Ljava/lang/Thread$UncaughtExceptionHandler;->uncaughtException(Ljava/lang/Thread;Ljava/lang/Throwable;)V

    return-void

    :no_previous
    # Should not normally happen — Android always installs its own default
    # handler before any app code runs — but if it's somehow null, don't
    # leave the process silently hanging in a broken state.
    const/16 v1, 0xa

    invoke-static {v1}, Ljava/lang/System;->exit(I)V

    return-void
.end method
