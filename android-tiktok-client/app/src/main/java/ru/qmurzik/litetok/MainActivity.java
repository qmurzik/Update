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
import android.graphics.Color;
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
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.ImageView;
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
    private static final String DISCOVER_URL = "https://www.tiktok.com/explore";
    private static final String UPLOAD_URL = "https://www.tiktok.com/upload";
    private static final String INBOX_URL = "https://www.tiktok.com/messages";
    private static final String PROFILE_JS =
            "(function(){"
                    + "var el=document.querySelector('[data-e2e=\"profile-icon\"]')"
                    + "||document.querySelector('[data-e2e=\"nav-profile\"]')"
                    + "||document.querySelector('header a[href^=\"/@\"]');"
                    + "if(el){el.click();}else{location.href='https://www.tiktok.com/setting';}"
                    + "})();";

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

    // Hides TikTok's own browser-page chrome (top nav/tabs, "open in app" and
    // cookie banners, install prompts) and strips the tells that make a page
    // feel like a webpage (tap highlight, text-selection callout, scrollbars)
    // so only the video feed itself — which is genuinely TikTok's own,
    // fully working UI — remains visible under our native shell.
    private static final String CHROME_HIDER_JS =
            "(function(){"
                    + "if(window.__neotokHider)return;window.__neotokHider=true;"
                    + "var s=document.createElement('style');"
                    + "s.innerHTML="
                    + "\"*{-webkit-tap-highlight-color:transparent!important;"
                    + "-webkit-touch-callout:none!important;}"
                    + "body{-webkit-user-select:none!important;overscroll-behavior:none!important;}"
                    + "*::-webkit-scrollbar{display:none!important;width:0!important;height:0!important;}"
                    + "header,nav,[data-e2e='top-nav'],[data-e2e='nav-login-button'],"
                    + "[data-e2e='nav-more'],[data-e2e='app-download-card'],"
                    + "[data-e2e='download-card'],[data-e2e='browser-modal'],"
                    + "[data-e2e='open-app-modal'],[class*='DivBannerContainer'],"
                    + "[class*='DivAppBanner'],[id*='cookie-banner'],"
                    + "[class*='CookieBanner']{display:none!important;}\";"
                    + "document.head.appendChild(s);"
                    + "function looksLikeBanner(el){"
                    + "if(!el||!el.textContent)return false;"
                    + "var t=el.textContent.trim().toLowerCase();"
                    + "if(t.length===0||t.length>200)return false;"
                    + "return t.indexOf('open in the tiktok app')>=0||t.indexOf('get the app')>=0||"
                    + "t.indexOf('continue in browser')>=0||t.indexOf('use app')>=0||"
                    + "t.indexOf('accept all')>=0||t.indexOf('open app')>=0;"
                    + "}"
                    + "function killBanners(){"
                    + "try{"
                    + "var all=document.querySelectorAll('div,section,aside');"
                    + "for(var i=0;i<all.length;i++){"
                    + "var el=all[i];"
                    + "if(!looksLikeBanner(el))continue;"
                    + "var cs=window.getComputedStyle(el);"
                    + "if(cs.position==='fixed'||cs.position==='sticky'){"
                    + "el.style.setProperty('display','none','important');"
                    + "}"
                    + "}"
                    + "}catch(e){}"
                    + "}"
                    + "killBanners();"
                    + "var t=null;"
                    + "var mo=new MutationObserver(function(){"
                    + "if(t)return;t=setTimeout(function(){t=null;killBanners();},500);"
                    + "});"
                    + "mo.observe(document.body,{childList:true,subtree:true});"
                    + "})();";

    private static final long MIN_SPLASH_MS = 500;
    private static final int SCROLL_HIDE_THRESHOLD = 12;

    private WebView webView;
    private ProgressBar progressBar;
    private View offlineOverlay;
    private View splashOverlay;
    private View bottomNav;
    private TextView btnMenu;
    private Prefs prefs;

    private View navHome;
    private View navDiscover;
    private View navUpload;
    private View navInbox;
    private View navProfile;
    private ImageView iconHome;
    private ImageView iconDiscover;
    private ImageView iconInbox;
    private ImageView iconProfile;

    private ValueCallback<Uri[]> filePathCallback;
    private long lastBackPressAt;
    private long splashShownAt;
    private boolean splashDismissed;
    private boolean chromeHidden;
    private int selectedTab = 0;

    private DownloadManager.Request pendingDownload;
    private String appliedUserAgent;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupEdgeToEdge();
        setContentView(R.layout.activity_main);

        prefs = new Prefs(this);
        bindViews();
        applyWindowInsets();
        setupWebView();
        setupNavigation();
        updateTabHighlight();

        splashShownAt = System.currentTimeMillis();
        animateSplashIn();

        if (savedInstanceState == null) {
            loadStartPage();
        }
    }

    private void setupEdgeToEdge() {
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    private void bindViews() {
        webView = (WebView) findViewById(R.id.webview);
        progressBar = (ProgressBar) findViewById(R.id.progress_bar);
        offlineOverlay = findViewById(R.id.offline_overlay);
        splashOverlay = findViewById(R.id.splash_overlay);
        bottomNav = findViewById(R.id.bottom_nav);
        btnMenu = (TextView) findViewById(R.id.btn_menu);

        navHome = findViewById(R.id.nav_home);
        navDiscover = findViewById(R.id.nav_discover);
        navUpload = findViewById(R.id.nav_upload);
        navInbox = findViewById(R.id.nav_inbox);
        navProfile = findViewById(R.id.nav_profile);
        iconHome = (ImageView) findViewById(R.id.icon_home);
        iconDiscover = (ImageView) findViewById(R.id.icon_discover);
        iconInbox = (ImageView) findViewById(R.id.icon_inbox);
        iconProfile = (ImageView) findViewById(R.id.icon_profile);
    }

    private void applyWindowInsets() {
        findViewById(android.R.id.content).setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                int top = insets.getSystemWindowInsetTop();
                int bottom = insets.getSystemWindowInsetBottom();
                btnMenu.setTranslationY(top + dp(4));
                ViewGroup.MarginLayoutParams navParams = (ViewGroup.MarginLayoutParams) bottomNav.getLayoutParams();
                navParams.bottomMargin = dp(16) + bottom;
                bottomNav.setLayoutParams(navParams);
                return insets;
            }
        });
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void setupNavigation() {
        View.OnClickListener tabListener = new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (v == navHome) selectTab(0);
                else if (v == navDiscover) selectTab(1);
                else if (v == navUpload) webView.loadUrl(UPLOAD_URL);
                else if (v == navInbox) selectTab(3);
                else if (v == navProfile) selectTab(4);
            }
        };
        navHome.setOnClickListener(tabListener);
        navDiscover.setOnClickListener(tabListener);
        navUpload.setOnClickListener(tabListener);
        navInbox.setOnClickListener(tabListener);
        navProfile.setOnClickListener(tabListener);

        btnMenu.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showQuickMenu();
            }
        });
    }

    private void selectTab(int index) {
        selectedTab = index;
        updateTabHighlight();
        switch (index) {
            case 0: webView.loadUrl(HOME_URL); break;
            case 1: webView.loadUrl(DISCOVER_URL); break;
            case 3: webView.loadUrl(INBOX_URL); break;
            case 4: webView.evaluateJavascript(PROFILE_JS, null); break;
            default: break;
        }
    }

    private void updateTabHighlight() {
        int active = getResources().getColor(R.color.accent);
        int inactive = getResources().getColor(R.color.icon_tint_inactive);
        iconHome.setColorFilter(selectedTab == 0 ? active : inactive);
        iconDiscover.setColorFilter(selectedTab == 1 ? active : inactive);
        iconInbox.setColorFilter(selectedTab == 3 ? active : inactive);
        iconProfile.setColorFilter(selectedTab == 4 ? active : inactive);

        setLabelColor(R.id.label_home, selectedTab == 0);
        setLabelColor(R.id.label_discover, selectedTab == 1);
        setLabelColor(R.id.label_inbox, selectedTab == 3);
        setLabelColor(R.id.label_profile, selectedTab == 4);
    }

    private void setLabelColor(int id, boolean active) {
        TextView label = (TextView) findViewById(id);
        label.setTextColor(getResources().getColor(active ? R.color.accent : R.color.icon_tint_inactive));
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
        webView.setOnScrollChangeListener(new View.OnScrollChangeListener() {
            @Override
            public void onScrollChange(View v, int scrollX, int scrollY, int oldScrollX, int oldScrollY) {
                int dy = scrollY - oldScrollY;
                if (dy > SCROLL_HIDE_THRESHOLD && scrollY > dp(80)) {
                    setChromeHidden(true);
                } else if (dy < -SCROLL_HIDE_THRESHOLD || scrollY < dp(80)) {
                    setChromeHidden(false);
                }
            }
        });
    }

    private void setChromeHidden(boolean hidden) {
        if (hidden == chromeHidden) return;
        chromeHidden = hidden;
        float navTarget = hidden ? bottomNav.getHeight() + dp(32) : 0f;
        bottomNav.animate().translationY(navTarget).setDuration(220).start();
        btnMenu.animate().alpha(hidden ? 0f : 1f).setDuration(220).start();
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
