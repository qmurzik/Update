package ru.qmurzik.litetok;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebStorage;
import android.widget.CompoundButton;
import android.widget.SeekBar;
import android.widget.Switch;
import android.widget.Toast;

public class SettingsActivity extends Activity {

    private static final int ZOOM_MIN = 70;

    private Prefs prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);
        prefs = new Prefs(this);

        final Switch liteModeSwitch = (Switch) findViewById(R.id.switch_lite_mode);
        liteModeSwitch.setChecked(prefs.isLiteMode());
        liteModeSwitch.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
                prefs.setLiteMode(isChecked);
            }
        });

        final Switch desktopSwitch = (Switch) findViewById(R.id.switch_desktop_site);
        desktopSwitch.setChecked(prefs.isDesktopSite());
        desktopSwitch.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
                prefs.setDesktopSite(isChecked);
            }
        });

        SeekBar zoomSeek = (SeekBar) findViewById(R.id.seek_text_zoom);
        zoomSeek.setProgress(prefs.getTextZoom() - ZOOM_MIN);
        zoomSeek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (fromUser) {
                    prefs.setTextZoom(progress + ZOOM_MIN);
                }
            }

            @Override public void onStartTrackingTouch(SeekBar seekBar) { }
            @Override public void onStopTrackingTouch(SeekBar seekBar) { }
        });

        findViewById(R.id.btn_clear_data).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                clearSiteData();
            }
        });

        findViewById(R.id.btn_close).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
    }

    private void clearSiteData() {
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.removeAllCookies(null);
        cookieManager.flush();
        WebStorage.getInstance().deleteAllData();
        getApplicationContext().deleteDatabase("webview.db");
        getApplicationContext().deleteDatabase("webviewCache.db");
        Toast.makeText(this, R.string.settings_clear_data_done, Toast.LENGTH_SHORT).show();
        finish();
    }
}
