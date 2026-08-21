package ru.qmurzik.litetok;

import android.content.Context;
import android.content.SharedPreferences;

final class Prefs {

    private static final String FILE = "litetok_prefs";
    private static final String KEY_LITE_MODE = "lite_mode";
    private static final String KEY_DESKTOP_SITE = "desktop_site";
    private static final String KEY_TEXT_ZOOM = "text_zoom";

    private final SharedPreferences prefs;

    Prefs(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    boolean isLiteMode() {
        return prefs.getBoolean(KEY_LITE_MODE, false);
    }

    void setLiteMode(boolean enabled) {
        prefs.edit().putBoolean(KEY_LITE_MODE, enabled).apply();
    }

    boolean isDesktopSite() {
        return prefs.getBoolean(KEY_DESKTOP_SITE, false);
    }

    void setDesktopSite(boolean enabled) {
        prefs.edit().putBoolean(KEY_DESKTOP_SITE, enabled).apply();
    }

    int getTextZoom() {
        return prefs.getInt(KEY_TEXT_ZOOM, 100);
    }

    void setTextZoom(int percent) {
        prefs.edit().putInt(KEY_TEXT_ZOOM, percent).apply();
    }
}
