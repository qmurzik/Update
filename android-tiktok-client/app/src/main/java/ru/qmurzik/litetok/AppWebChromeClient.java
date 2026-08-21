package ru.qmurzik.litetok;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Message;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.ValueCallback;

import java.util.ArrayList;
import java.util.List;

/**
 * Bridges browser-side camera/microphone permission prompts and the
 * native file picker (used by TikTok's upload flow) to Android APIs, and
 * makes sure JS-opened popup windows (TikTok's security/captcha SDK uses
 * window.open for some checks) navigate instead of silently failing,
 * which otherwise left the page stuck on a blank white screen.
 */
final class AppWebChromeClient extends WebChromeClient {

    private static final String TAG = "NeoTokWebView";

    interface Callback {
        void onProgress(int progress);
        void onOpenFileChooser(ValueCallback<Uri[]> filePathCallback, FileChooserParams params);
    }

    private final Activity activity;
    private final WebView mainWebView;
    private final Callback callback;

    AppWebChromeClient(Activity activity, WebView mainWebView, Callback callback) {
        this.activity = activity;
        this.mainWebView = mainWebView;
        this.callback = callback;
    }

    @Override
    public void onProgressChanged(WebView view, int newProgress) {
        callback.onProgress(newProgress);
    }

    @Override
    public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
        callback.onOpenFileChooser(filePathCallback, fileChooserParams);
        return true;
    }

    @Override
    public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
        WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
        transport.setWebView(mainWebView);
        resultMsg.sendToTarget();
        return true;
    }

    @Override
    public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
        Log.d(TAG, consoleMessage.message() + " -- " + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber());
        return true;
    }

    @Override
    public void onPermissionRequest(final PermissionRequest request) {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                List<String> androidPermissions = new ArrayList<String>();
                for (String resource : request.getResources()) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                        androidPermissions.add(Manifest.permission.CAMERA);
                    } else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                        androidPermissions.add(Manifest.permission.RECORD_AUDIO);
                    }
                }
                boolean allGranted = true;
                for (String permission : androidPermissions) {
                    if (activity.checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
                        allGranted = false;
                    }
                }
                if (allGranted) {
                    request.grant(request.getResources());
                } else {
                    request.deny();
                    if (!androidPermissions.isEmpty()) {
                        activity.requestPermissions(
                                androidPermissions.toArray(new String[0]),
                                MainActivity.REQUEST_MEDIA_PERMISSIONS);
                    }
                }
            }
        });
    }

    @Override
    public void onGeolocationPermissionsShowPrompt(String origin, android.webkit.GeolocationPermissions.Callback callback) {
        callback.invoke(origin, false, false);
    }
}
