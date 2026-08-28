.class public Lcom/qmods/app/auth/CrashReportRunnable;
.super Ljava/lang/Object;
.source "CrashReportRunnable.java"
.implements Ljava/lang/Runnable;

# Fire-and-forget POST of a crash report to the Worker — see CrashHandler,
# which starts this on its own throwaway thread and gives it a bounded
# window (Thread.join, a couple seconds) before proceeding to the
# platform's own crash handling. Never throws out of run() — a failure
# reporting a crash must not itself crash the crash handler.

.field private final context:Landroid/content/Context;

.field private final throwable:Ljava/lang/Throwable;

.method public constructor <init>(Landroid/content/Context;Ljava/lang/Throwable;)V
    .locals 0
    .param p1, "context"    # Landroid/content/Context;
    .param p2, "throwable"    # Ljava/lang/Throwable;

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/qmods/app/auth/CrashReportRunnable;->context:Landroid/content/Context;

    iput-object p2, p0, Lcom/qmods/app/auth/CrashReportRunnable;->throwable:Ljava/lang/Throwable;

    return-void
.end method

# NOTE: URL literal must match wherever you deployed the Worker — see
# DevicePairingRunnable's equivalent note. token is best-effort: crashes
# before pairing simply send an empty one, the server treats that as an
# anonymous report rather than rejecting it (see index.ts /device/crash).
.method public run()V
    .locals 12

    :try_start
    iget-object v0, p0, Lcom/qmods/app/auth/CrashReportRunnable;->context:Landroid/content/Context;

    iget-object v1, p0, Lcom/qmods/app/auth/CrashReportRunnable;->throwable:Ljava/lang/Throwable;

    new-instance v2, Lorg/json/JSONObject;

    invoke-direct {v2}, Lorg/json/JSONObject;-><init>()V

    invoke-virtual {v1}, Ljava/lang/Throwable;->getClass()Ljava/lang/Class;

    move-result-object v3

    invoke-virtual {v3}, Ljava/lang/Class;->getName()Ljava/lang/String;

    move-result-object v3

    const-string v4, "name"

    invoke-virtual {v2, v4, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    invoke-virtual {v1}, Ljava/lang/Throwable;->getMessage()Ljava/lang/String;

    move-result-object v3

    if-nez v3, :msg_ok

    const-string v3, ""

    :msg_ok
    const-string v4, "message"

    invoke-virtual {v2, v4, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    invoke-static {v1}, Landroid/util/Log;->getStackTraceString(Ljava/lang/Throwable;)Ljava/lang/String;

    move-result-object v3

    const-string v4, "stack"

    invoke-virtual {v2, v4, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    sget-object v3, Landroid/os/Build;->MODEL:Ljava/lang/String;

    const-string v4, "device"

    invoke-virtual {v2, v4, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    invoke-direct {p0}, Lcom/qmods/app/auth/CrashReportRunnable;->versionName()Ljava/lang/String;

    move-result-object v3

    const-string v4, "version_name"

    invoke-virtual {v2, v4, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;Ljava/lang/Object;)Lorg/json/JSONObject;

    invoke-direct {p0}, Lcom/qmods/app/auth/CrashReportRunnable;->versionCode()I

    move-result v3

    const-string v4, "version_code"

    invoke-virtual {v2, v4, v3}, Lorg/json/JSONObject;->put(Ljava/lang/String;I)Lorg/json/JSONObject;

    invoke-virtual {v2}, Lorg/json/JSONObject;->toString()Ljava/lang/String;

    move-result-object v5

    const-string v6, "qmods_auth"

    const/4 v7, 0x0

    invoke-virtual {v0, v6, v7}, Landroid/content/Context;->getSharedPreferences(Ljava/lang/String;I)Landroid/content/SharedPreferences;

    move-result-object v6

    const-string v7, "device_token"

    const-string v8, ""

    invoke-interface {v6, v7, v8}, Landroid/content/SharedPreferences;->getString(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object v9

    const-string v8, "UTF-8"

    invoke-static {v9, v8}, Ljava/net/URLEncoder;->encode(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;

    move-result-object v9

    new-instance v10, Ljava/lang/StringBuilder;

    invoke-direct {v10}, Ljava/lang/StringBuilder;-><init>()V

    const-string v11, "https://update.qmurzik7.workers.dev/device/crash?token="

    invoke-virtual {v10, v11}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v10

    invoke-virtual {v10, v9}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v10

    invoke-virtual {v10}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v10

    invoke-static {v10, v5}, Lcom/qmods/app/auth/Http;->postJson(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;
    :try_end
    .catch Ljava/lang/Exception; {:try_start .. :try_end} :catch_all

    return-void

    :catch_all
    move-exception v0

    const-string v1, "QModsAuth"

    const-string v2, "crash report failed to send"

    invoke-static {v1, v2, v0}, Landroid/util/Log;->e(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I

    return-void
.end method

# Best-effort — "" if the package can't be introspected.
.method private versionName()Ljava/lang/String;
    .locals 5

    :try_start
    iget-object v0, p0, Lcom/qmods/app/auth/CrashReportRunnable;->context:Landroid/content/Context;

    invoke-virtual {v0}, Landroid/content/Context;->getPackageManager()Landroid/content/pm/PackageManager;

    move-result-object v1

    iget-object v0, p0, Lcom/qmods/app/auth/CrashReportRunnable;->context:Landroid/content/Context;

    invoke-virtual {v0}, Landroid/content/Context;->getPackageName()Ljava/lang/String;

    move-result-object v2

    const/4 v3, 0x0

    invoke-virtual {v1, v2, v3}, Landroid/content/pm/PackageManager;->getPackageInfo(Ljava/lang/String;I)Landroid/content/pm/PackageInfo;

    move-result-object v4

    iget-object v4, v4, Landroid/content/pm/PackageInfo;->versionName:Ljava/lang/String;
    :try_end
    .catch Landroid/content/pm/PackageManager$NameNotFoundException; {:try_start .. :try_end} :catch_default

    if-nez v4, :not_null

    const-string v4, ""

    :not_null
    return-object v4

    :catch_default
    const-string v4, ""

    return-object v4
.end method

# Same pattern as SubscriptionCheckRunnable.getVersionCode() — kept as a
# private duplicate here rather than shared, since the two classes have no
# other reason to depend on each other.
.method private versionCode()I
    .locals 5

    :try_start
    iget-object v0, p0, Lcom/qmods/app/auth/CrashReportRunnable;->context:Landroid/content/Context;

    invoke-virtual {v0}, Landroid/content/Context;->getPackageManager()Landroid/content/pm/PackageManager;

    move-result-object v1

    iget-object v0, p0, Lcom/qmods/app/auth/CrashReportRunnable;->context:Landroid/content/Context;

    invoke-virtual {v0}, Landroid/content/Context;->getPackageName()Ljava/lang/String;

    move-result-object v2

    const/4 v3, 0x0

    invoke-virtual {v1, v2, v3}, Landroid/content/pm/PackageManager;->getPackageInfo(Ljava/lang/String;I)Landroid/content/pm/PackageInfo;

    move-result-object v4

    iget v4, v4, Landroid/content/pm/PackageInfo;->versionCode:I
    :try_end
    .catch Landroid/content/pm/PackageManager$NameNotFoundException; {:try_start .. :try_end} :catch_default

    return v4

    :catch_default
    const/4 v4, 0x0

    return v4
.end method
