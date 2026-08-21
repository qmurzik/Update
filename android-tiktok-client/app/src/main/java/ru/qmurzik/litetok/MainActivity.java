package ru.qmurzik.litetok;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.widget.ProgressBar;
import android.widget.Toast;

public class MainActivity extends Activity implements AppWebViewClient.Callback, AppWebChromeClient.Callback {

    static final int REQUEST_MEDIA_PERMISSIONS = 100;
    private static final int REQUEST_STORAGE_PERMISSION = 101;
    private static final int REQUEST_FILE_CHOOSER = 200;

    private static final String START_URL = "https://www.tiktok.com/";
    private static final String MOBILE_UA =
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) "
                    + "Chrome/124.0.0.0 Mobile Safari/537.36";
    private static final String DESKTOP_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
                    + "Chrome/124.0.0.0 Safari/537.36";
    private static final String LITE_MODE_CSS =
            "(function(){var s=document.createElement('style');"
                    + "s.innerHTML='*{animation-duration:0.001s !important;"
                    + "transition-duration:0.001s !important;scroll-behavior:auto !important;}';"
                    + "document.head.appendChild(s);})();";

    private WebView webView;
    private ProgressBar progressBar;
    private View offlineOverlay;
    private Prefs prefs;

    private ValueCallback<Uri[]> filePathCallback;
    private long lastBackPressAt;

    private DownloadManager.Request pendingDownload;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        prefs = new Prefs(this);
        webView = (WebView) findViewById(R.id.webview);
        progressBar = (ProgressBar) findViewById(R.id.progress_bar);
        offlineOverlay = findViewById(R.id.offline_overlay);

        findViewById(R.id.btn_back).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                if (webView.canGoBack()) webView.goBack();
            }
        });
        findViewById(R.id.btn_forward).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                if (webView.canGoForward()) webView.goForward();
            }
        });
        findViewById(R.id.btn_reload).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                reload();
            }
        });
        findViewById(R.id.btn_menu).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                startActivity(new Intent(MainActivity.this, SettingsActivity.class));
            }
        });
        findViewById(R.id.btn_retry).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                reload();
            }
        });

        setupWebView();

        if (savedInstanceState == null) {
            loadStartPage();
        }
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setSupportMultipleWindows(false);
        settings.setGeolocationEnabled(false);
        settings.setAllowFileAccess(true);
        settings.setTextZoom(prefs.getTextZoom());
        settings.setUserAgentString(prefs.isDesktopSite() ? DESKTOP_UA : MOBILE_UA);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new AppWebViewClient(this, this));
        webView.setWebChromeClient(new AppWebChromeClient(this, this));
        webView.setDownloadListener(new android.webkit.DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                         String mimeType, long contentLength) {
                startDownload(url, userAgent, contentDisposition, mimeType);
            }
        });
    }

    private void loadStartPage() {
        webView.loadUrl(START_URL, requestHeaders());
    }

    private void reload() {
        if (isNetworkAvailable()) {
            hideOfflineOverlay();
            webView.loadUrl(webView.getUrl() != null ? webView.getUrl() : START_URL, requestHeaders());
        } else {
            showOfflineOverlay();
        }
    }

    private java.util.Map<String, String> requestHeaders() {
        java.util.Map<String, String> headers = new java.util.HashMap<String, String>();
        if (prefs.isLiteMode()) {
            headers.put("Save-Data", "on");
        }
        return headers;
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return true;
        NetworkInfo info = cm.getActiveNetworkInfo();
        return info != null && info.isConnected();
    }

    private void showOfflineOverlay() {
        offlineOverlay.setVisibility(View.VISIBLE);
        progressBar.setVisibility(View.GONE);
    }

    private void hideOfflineOverlay() {
        offlineOverlay.setVisibility(View.GONE);
    }

    // AppWebViewClient.Callback

    @Override
    public void onPageLoadStarted() {
        progressBar.setVisibility(View.VISIBLE);
        progressBar.setProgress(0);
    }

    @Override
    public void onPageLoadFinished() {
        progressBar.setVisibility(View.GONE);
        if (prefs.isLiteMode()) {
            webView.evaluateJavascript(LITE_MODE_CSS, null);
        }
    }

    @Override
    public void onLoadError() {
        progressBar.setVisibility(View.GONE);
        if (!isNetworkAvailable()) {
            showOfflineOverlay();
        }
    }

    // AppWebChromeClient.Callback

    @Override
    public void onProgress(int progress) {
        progressBar.setProgress(progress);
        if (progress >= 100) {
            new Handler().postDelayed(new Runnable() {
                @Override public void run() {
                    progressBar.setVisibility(View.GONE);
                }
            }, 200);
        }
    }

    @Override
    public void onOpenFileChooser(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
        }
        filePathCallback = callback;
        Intent intent = params.createIntent();
        try {
            startActivityForResult(intent, REQUEST_FILE_CHOOSER);
        } catch (android.content.ActivityNotFoundException e) {
            filePathCallback = null;
            Toast.makeText(this, "Нет приложения для выбора файла", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQUEST_FILE_CHOOSER) {
            if (filePathCallback != null) {
                Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    private void startDownload(String url, String userAgent, String contentDisposition, String mimeType) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            pendingDownload = buildDownloadRequest(url, userAgent, contentDisposition, mimeType);
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQUEST_STORAGE_PERMISSION);
            return;
        }
        enqueueDownload(buildDownloadRequest(url, userAgent, contentDisposition, mimeType));
    }

    private DownloadManager.Request buildDownloadRequest(String url, String userAgent, String contentDisposition, String mimeType) {
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        String cookies = CookieManager.getInstance().getCookie(url);
        if (cookies != null) {
            request.addRequestHeader("cookie", cookies);
        }
        request.addRequestHeader("User-Agent", userAgent);
        String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
        request.setMimeType(mimeType);
        request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.allowScanningByMediaScanner();
        return request;
    }

    private void enqueueDownload(DownloadManager.Request request) {
        DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm != null) {
            dm.enqueue(request);
            Toast.makeText(this, R.string.download_started, Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_MEDIA_PERMISSIONS) {
            boolean granted = true;
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) granted = false;
            }
            if (!granted) {
                Toast.makeText(this, R.string.permission_denied_camera, Toast.LENGTH_LONG).show();
            }
        } else if (requestCode == REQUEST_STORAGE_PERMISSION) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (granted && pendingDownload != null) {
                enqueueDownload(pendingDownload);
            } else if (!granted) {
                Toast.makeText(this, R.string.permission_denied_storage, Toast.LENGTH_LONG).show();
            }
            pendingDownload = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastBackPressAt < 2000) {
            super.onBackPressed();
        } else {
            lastBackPressAt = now;
            Toast.makeText(this, R.string.toast_press_back_again, Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        webView.resumeTimers();
        applyPrefsIfChanged();
    }

    @Override
    protected void onPause() {
        webView.onPause();
        webView.pauseTimers();
        super.onPause();
    }

    private String appliedUserAgent;

    private void applyPrefsIfChanged() {
        String desiredUa = prefs.isDesktopSite() ? DESKTOP_UA : MOBILE_UA;
        boolean uaChanged = appliedUserAgent != null && !appliedUserAgent.equals(desiredUa);
        appliedUserAgent = desiredUa;
        webView.getSettings().setUserAgentString(desiredUa);
        webView.getSettings().setTextZoom(prefs.getTextZoom());
        if (uaChanged) {
            webView.reload();
        }
    }

    @Override
    protected void onDestroy() {
        CookieManager.getInstance().flush();
        super.onDestroy();
    }
}
