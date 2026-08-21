package ru.qmurzik.litetok;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.ValueCallback;

import java.util.ArrayList;
import java.util.List;

/**
 * Bridges browser-side camera/microphone permission prompts and the
 * native file picker (used by TikTok's upload flow) to Android APIs.
 */
final class AppWebChromeClient extends WebChromeClient {

    interface Callback {
        void onProgress(int progress);
        void onOpenFileChooser(ValueCallback<Uri[]> filePathCallback, FileChooserParams params);
    }

    private final Activity activity;
    private final Callback callback;

    AppWebChromeClient(Activity activity, Callback callback) {
        this.activity = activity;
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
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                            && activity.checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
                        allGranted = false;
                    }
                }
                if (allGranted) {
                    request.grant(request.getResources());
                } else {
                    request.deny();
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !androidPermissions.isEmpty()) {
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
