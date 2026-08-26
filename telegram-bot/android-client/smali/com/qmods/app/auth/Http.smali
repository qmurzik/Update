.class public Lcom/qmods/app/auth/Http;
.super Ljava/lang/Object;
.source "Http.java"

# Minimal blocking HTTP helper shared by DevicePairingRunnable and
# SubscriptionCheckRunnable. Always call from a background thread — every
# method here blocks on network I/O. Uses only java.net.HttpURLConnection
# (no OkHttp/Retrofit dependency), so it drops into any app regardless of
# what HTTP stack the rest of it already uses.

.method public constructor <init>()V
    .locals 0

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    return-void
.end method

# GET urlStr, return the response body decoded as UTF-8 (works for both
# 2xx and error responses — the Worker's JSON error bodies are still
# readable this way).
.method public static get(Ljava/lang/String;)Ljava/lang/String;
    .locals 4
    .param p0, "urlStr"    # Ljava/lang/String;
    .annotation system Ldalvik/annotation/Throws;
        value = {
            Ljava/io/IOException;
        }
    .end annotation

    new-instance v0, Ljava/net/URL;

    invoke-direct {v0, p0}, Ljava/net/URL;-><init>(Ljava/lang/String;)V

    invoke-virtual {v0}, Ljava/net/URL;->openConnection()Ljava/net/URLConnection;

    move-result-object v1

    check-cast v1, Ljava/net/HttpURLConnection;

    const-string v2, "GET"

    invoke-virtual {v1, v2}, Ljava/net/HttpURLConnection;->setRequestMethod(Ljava/lang/String;)V

    const/16 v2, 0x3a98

    invoke-virtual {v1, v2}, Ljava/net/HttpURLConnection;->setConnectTimeout(I)V

    invoke-virtual {v1, v2}, Ljava/net/HttpURLConnection;->setReadTimeout(I)V

    invoke-static {v1}, Lcom/qmods/app/auth/Http;->readBody(Ljava/net/HttpURLConnection;)Ljava/lang/String;

    move-result-object v3

    invoke-virtual {v1}, Ljava/net/HttpURLConnection;->disconnect()V

    return-object v3
.end method

# Empty-body POST — every POST endpoint this client calls (/device/pair/start)
# takes no request body, the pairing code itself is server-generated.
.method public static post(Ljava/lang/String;)Ljava/lang/String;
    .locals 4
    .param p0, "urlStr"    # Ljava/lang/String;
    .annotation system Ldalvik/annotation/Throws;
        value = {
            Ljava/io/IOException;
        }
    .end annotation

    new-instance v0, Ljava/net/URL;

    invoke-direct {v0, p0}, Ljava/net/URL;-><init>(Ljava/lang/String;)V

    invoke-virtual {v0}, Ljava/net/URL;->openConnection()Ljava/net/URLConnection;

    move-result-object v1

    check-cast v1, Ljava/net/HttpURLConnection;

    const-string v2, "POST"

    invoke-virtual {v1, v2}, Ljava/net/HttpURLConnection;->setRequestMethod(Ljava/lang/String;)V

    const/16 v2, 0x3a98

    invoke-virtual {v1, v2}, Ljava/net/HttpURLConnection;->setConnectTimeout(I)V

    invoke-virtual {v1, v2}, Ljava/net/HttpURLConnection;->setReadTimeout(I)V

    invoke-static {v1}, Lcom/qmods/app/auth/Http;->readBody(Ljava/net/HttpURLConnection;)Ljava/lang/String;

    move-result-object v3

    invoke-virtual {v1}, Ljava/net/HttpURLConnection;->disconnect()V

    return-object v3
.end method

# Reads getInputStream() on 2xx, getErrorStream() otherwise (so a 429/401/500
# JSON error body from the Worker is still readable instead of throwing),
# decodes as UTF-8. Returns "" for a null stream.
.method private static readBody(Ljava/net/HttpURLConnection;)Ljava/lang/String;
    .locals 11
    .param p0, "conn"    # Ljava/net/HttpURLConnection;
    .annotation system Ldalvik/annotation/Throws;
        value = {
            Ljava/io/IOException;
        }
    .end annotation

    invoke-virtual {p0}, Ljava/net/HttpURLConnection;->getResponseCode()I

    move-result v0

    const/16 v1, 0x190

    if-lt v0, v1, :use_input

    invoke-virtual {p0}, Ljava/net/HttpURLConnection;->getErrorStream()Ljava/io/InputStream;

    move-result-object v2

    goto :have_stream

    :use_input
    invoke-virtual {p0}, Ljava/net/HttpURLConnection;->getInputStream()Ljava/io/InputStream;

    move-result-object v2

    :have_stream
    if-nez v2, :read_stream

    const-string v10, ""

    return-object v10

    :read_stream
    new-instance v3, Ljava/io/ByteArrayOutputStream;

    invoke-direct {v3}, Ljava/io/ByteArrayOutputStream;-><init>()V

    const/16 v5, 0x1000

    new-array v4, v5, [B

    :loop
    invoke-virtual {v2, v4}, Ljava/io/InputStream;->read([B)I

    move-result v6

    const/4 v7, -0x1

    if-eq v6, v7, :done

    const/4 v8, 0x0

    invoke-virtual {v3, v4, v8, v6}, Ljava/io/ByteArrayOutputStream;->write([BII)V

    goto :loop

    :done
    invoke-virtual {v2}, Ljava/io/InputStream;->close()V

    const-string v9, "UTF-8"

    invoke-virtual {v3, v9}, Ljava/io/ByteArrayOutputStream;->toString(Ljava/lang/String;)Ljava/lang/String;

    move-result-object v10

    return-object v10
.end method
