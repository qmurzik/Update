package ru.qmurzik.litetok;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Keeps navigation inside the app for tiktok.com itself, but hands off
 * external identity providers (Google/Facebook/Apple sign-in) to the
 * system browser, since those providers block embedded WebView logins.
 */
final class AppWebViewClient extends WebViewClient {

    interface Callback {
        void onPageLoadStarted();
        void onPageLoadFinished();
        void onLoadError();
    }

    private static final String[] EXTERNAL_AUTH_HOSTS = {
            "accounts.google.com",
            "appleid.apple.com",
            "m.facebook.com",
            "www.facebook.com",
            "twitter.com",
            "x.com"
    };

    private final Context context;
    private final Callback callback;
    private boolean mainFrameFailed;

    AppWebViewClient(Context context, Callback callback) {
        this.context = context;
        this.callback = callback;
    }

    private static boolean isExternalAuthHost(String host) {
        if (host == null) {
            return false;
        }
        for (String candidate : EXTERNAL_AUTH_HOSTS) {
            if (host.equalsIgnoreCase(candidate)) {
                return true;
            }
        }
        return false;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        return handleUri(Uri.parse(url));
    }

    private boolean handleUri(Uri uri) {
        String scheme = uri.getScheme();
        if (scheme != null && !scheme.equals("http") && !scheme.equals("https")) {
            try {
                context.startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException ignored) {
                // No app can handle this scheme; nothing more we can do.
            }
            return true;
        }
        if (isExternalAuthHost(uri.getHost())) {
            try {
                context.startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException ignored) {
                return false;
            }
            return true;
        }
        return false;
    }

    @Override
    public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
        mainFrameFailed = false;
        callback.onPageLoadStarted();
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        if (!mainFrameFailed) {
            callback.onPageLoadFinished();
        }
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (request.isForMainFrame()) {
            mainFrameFailed = true;
            callback.onLoadError();
        }
    }
}
