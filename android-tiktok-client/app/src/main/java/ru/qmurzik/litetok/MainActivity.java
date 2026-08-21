package ru.qmurzik.litetok;

import android.Manifest;
import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ObjectAnimator;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.PopupWindow;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity implements AppWebViewClient.Callback, AppWebChromeClient.Callback {

    static final int REQUEST_MEDIA_PERMISSIONS = 100;
    private static final int REQUEST_STORAGE_PERMISSION = 101;
    private static final int REQUEST_FILE_CHOOSER = 200;

    private static final String HOME_URL = "https://www.tiktok.com/foryou";

    private static final String MOBILE_UA =
            "Mozilla/5.0 (Linux; Android 13; K) AppleWebKit/537.36 (KHTML, like Gecko) "
                    + "Chrome/127.0.0.0 Mobile Safari/537.36";
    private static final String DESKTOP_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
                    + "Chrome/127.0.0.0 Safari/537.36";
    private static final String LITE_MODE_CSS =
            "(function(){var s=document.createElement('style');"
                    + "s.innerHTML='*{animation-duration:0.001s !important;"
                    + "transition-duration:0.001s !important;scroll-behavior:auto !important;}';"
                    + "document.head.appendChild(s);})();";

    // Hides TikTok's own browser-page chrome — its top bar (logo/hamburger/
    // "open app" banner/search), install and cookie prompts — while leaving
    // TikTok's own bottom tab bar alone (it already looks and behaves like a
    // native app's, and duplicating it natively caused a double nav bar).
    // TikTok's markup uses plain <div>s with hashed class names rather than
    // semantic tags, and its banner text is localized, so instead of a fixed
    // selector list this hides (a) any fixed/sticky element pinned to the
    // very top and shaped like a bar, regardless of tag/class/language, and
    // (b) any shallow element whose own text matches a banner phrase in a
    // few languages. Both checks are scoped to the top few DOM levels so
    // real feed/caption content is never touched. Also strips the tells that
    // make a page read as a webpage (tap highlight, selection callout,
    // scrollbars).
    private static final String CHROME_HIDER_JS =
            "(function(){"
                    + "if(window.__neotokHider)return;window.__neotokHider=true;"
                    + "var style=document.createElement('style');"
                    + "style.innerHTML="
                    + "\"*{-webkit-tap-highlight-color:transparent!important;"
                    + "-webkit-touch-callout:none!important;}"
                    + "body{-webkit-user-select:none!important;overscroll-behavior:none!important;}"
                    + "*::-webkit-scrollbar{display:none!important;width:0!important;height:0!important;}\";"
                    + "document.head.appendChild(style);"
                    + "var BANNER_WORDS=['open in the tiktok app','get the app','continue in browser',"
                    + "'use app','accept all','open app','открыть приложение','открыть в приложении',"
                    + "'продолжить в браузере','использовать приложение','принять все',"
                    + "'установить приложение','скачать приложение'];"
                    + "function hasBannerText(el){"
                    + "if(!el||!el.textContent)return false;"
                    + "var t=el.textContent.trim().toLowerCase();"
                    + "if(t.length===0||t.length>200)return false;"
                    + "for(var i=0;i<BANNER_WORDS.length;i++){if(t.indexOf(BANNER_WORDS[i])>=0)return true;}"
                    + "return false;"
                    + "}"
                    + "function sweep(){"
                    + "try{"
                    + "var candidates=document.querySelectorAll('body>*,body>*>*,body>*>*>*,body>*>*>*>*');"
                    + "for(var i=0;i<candidates.length;i++){"
                    + "var el=candidates[i];"
                    + "var cs=window.getComputedStyle(el);"
                    + "if(cs.display==='none')continue;"
                    + "var isFixedTopBar=false;"
                    + "if(cs.position==='fixed'||cs.position==='sticky'){"
                    + "var rect=el.getBoundingClientRect();"
                    + "if(rect.top<=12&&rect.height>0&&rect.height<=96&&rect.width>=window.innerWidth*0.5){"
                    + "isFixedTopBar=true;"
                    + "}"
                    + "}"
                    + "if(isFixedTopBar||hasBannerText(el)){"
                    + "el.style.setProperty('display','none','important');"
                    + "}"
                    + "}"
                    + "}catch(e){}"
                    + "}"
                    + "sweep();"
                    + "var timer=null;"
                    + "var mo=new MutationObserver(function(){"
                    + "if(timer)return;timer=setTimeout(function(){timer=null;sweep();},500);"
                    + "});"
                    + "mo.observe(document.body,{childList:true,subtree:true});"
                    + "})();";

    private static final long MIN_SPLASH_MS = 500;

    private WebView webView;
    private ProgressBar progressBar;
    private View offlineOverlay;
    private View splashOverlay;
    private TextView btnMenu;
    private Prefs prefs;

    private ValueCallback<Uri[]> filePathCallback;
    private long lastBackPressAt;
    private long splashShownAt;
    private boolean splashDismissed;

    private DownloadManager.Request pendingDownload;
    private String appliedUserAgent;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(getResources().getColor(R.color.bg_root));
        setContentView(R.layout.activity_main);

        prefs = new Prefs(this);
        bindViews();
        setupWebView();
        setupNavigation();

        splashShownAt = System.currentTimeMillis();
        animateSplashIn();

        if (savedInstanceState == null) {
            loadStartPage();
        }
    }

    private void bindViews() {
        webView = (WebView) findViewById(R.id.webview);
        progressBar = (ProgressBar) findViewById(R.id.progress_bar);
        offlineOverlay = findViewById(R.id.offline_overlay);
        splashOverlay = findViewById(R.id.splash_overlay);
        btnMenu = (TextView) findViewById(R.id.btn_menu);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void setupNavigation() {
        btnMenu.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showQuickMenu();
            }
        });
    }

    private void showQuickMenu() {
        LayoutInflater inflater = LayoutInflater.from(this);
        View content = inflater.inflate(R.layout.popup_quick_menu, null);
        final PopupWindow popup = new PopupWindow(content, ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT, true);
        popup.setOutsideTouchable(true);
        popup.setElevation(dp(12));

        content.findViewById(R.id.menu_back).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                popup.dismiss();
                if (webView.canGoBack()) webView.goBack();
            }
        });
        content.findViewById(R.id.menu_forward).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                popup.dismiss();
                if (webView.canGoForward()) webView.goForward();
            }
        });
        content.findViewById(R.id.menu_reload).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                popup.dismiss();
                reload();
            }
        });
        content.findViewById(R.id.menu_settings).setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                popup.dismiss();
                startActivity(new Intent(MainActivity.this, SettingsActivity.class));
            }
        });

        popup.showAsDropDown(btnMenu, -dp(160), dp(8), Gravity.NO_GRAVITY);
    }

    private void animateSplashIn() {
        splashOverlay.setAlpha(0f);
        splashOverlay.setScaleX(0.9f);
        splashOverlay.setScaleY(0.9f);
        splashOverlay.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(300).start();
    }

    private void dismissSplashIfReady() {
        if (splashDismissed) return;
        long elapsed = System.currentTimeMillis() - splashShownAt;
        long remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
        new Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                if (splashDismissed) return;
                splashDismissed = true;
                ObjectAnimator fade = ObjectAnimator.ofFloat(splashOverlay, "alpha", 1f, 0f);
                fade.setDuration(350);
                fade.addListener(new AnimatorListenerAdapter() {
                    @Override
                    public void onAnimationEnd(Animator animation) {
                        splashOverlay.setVisibility(View.GONE);
                    }
                });
                fade.start();
            }
        }, remaining);
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
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setGeolocationEnabled(false);
        settings.setAllowFileAccess(true);
        settings.setTextZoom(prefs.getTextZoom());
        settings.setUserAgentString(prefs.isDesktopSite() ? DESKTOP_UA : MOBILE_UA);
        appliedUserAgent = prefs.isDesktopSite() ? DESKTOP_UA : MOBILE_UA;

        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setBackgroundColor(getResources().getColor(R.color.bg_root));
        webView.setLongClickable(false);
        webView.setHapticFeedbackEnabled(false);
        webView.setOnLongClickListener(new View.OnLongClickListener() {
            @Override
            public boolean onLongClick(View v) {
                return true;
            }
        });

        WebView.setWebContentsDebuggingEnabled(true);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new AppWebViewClient(this, this));
        webView.setWebChromeClient(new AppWebChromeClient(this, webView, this));
        webView.setDownloadListener(new android.webkit.DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                         String mimeType, long contentLength) {
                startDownload(url, userAgent, contentDisposition, mimeType);
            }
        });
    }

    private void loadStartPage() {
        webView.loadUrl(HOME_URL, requestHeaders());
    }

    private void reload() {
        if (isNetworkAvailable()) {
            hideOfflineOverlay();
            webView.loadUrl(webView.getUrl() != null ? webView.getUrl() : HOME_URL, requestHeaders());
        } else {
            showOfflineOverlay();
        }
    }

    private Map<String, String> requestHeaders() {
        Map<String, String> headers = new HashMap<String, String>();
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
        dismissSplashIfReady();
    }

    private void hideOfflineOverlay() {
        offlineOverlay.setVisibility(View.GONE);
    }

    // AppWebViewClient.Callback

    @Override
    public void onPageLoadStarted() {
        progressBar.setVisibility(View.VISIBLE);
        progressBar.setProgress(0);
        webView.evaluateJavascript(CHROME_HIDER_JS, null);
    }

    @Override
    public void onPageLoadFinished() {
        progressBar.setVisibility(View.GONE);
        webView.evaluateJavascript(CHROME_HIDER_JS, null);
        if (prefs.isLiteMode()) {
            webView.evaluateJavascript(LITE_MODE_CSS, null);
        }
        dismissSplashIfReady();
    }

    @Override
    public void onLoadError() {
        progressBar.setVisibility(View.GONE);
        if (!isNetworkAvailable()) {
            showOfflineOverlay();
        }
        dismissSplashIfReady();
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
        if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
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

    private void applyPrefsIfChanged() {
        String desiredUa = prefs.isDesktopSite() ? DESKTOP_UA : MOBILE_UA;
        boolean uaChanged = !desiredUa.equals(appliedUserAgent);
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
