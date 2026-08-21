package com.qvk.app.core.datastore

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.qvk.app.core.common.Constants
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

enum class ThemeMode { SYSTEM, LIGHT, DARK, AMOLED }
enum class AccentColor { BLUE, VIOLET, EMERALD, ROSE, AMBER }
enum class MediaQuality { LOW, MEDIUM, HIGH, ORIGINAL }

private val Context.dataStore by preferencesDataStore(Constants.SETTINGS_DATASTORE_NAME)

data class QvkSettings(
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val accentColor: AccentColor = AccentColor.BLUE,
    val useDynamicColor: Boolean = true,
    val textScale: Float = 1.0f,
    val imageQuality: MediaQuality = MediaQuality.HIGH,
    val videoQuality: MediaQuality = MediaQuality.MEDIUM,
    val trafficSaverEnabled: Boolean = false,
    val autoplayVideos: Boolean = true,
    val hideAds: Boolean = true,
    val notifyLikes: Boolean = true,
    val notifyComments: Boolean = true,
    val notifyMessages: Boolean = true,
    val privacyShowOnlineStatus: Boolean = true,
)

@Singleton
class SettingsDataStore @Inject constructor(@ApplicationContext private val context: Context) {

    val settings: Flow<QvkSettings> = context.dataStore.data.map { prefs ->
        QvkSettings(
            themeMode = runCatching { ThemeMode.valueOf(prefs[Keys.THEME_MODE] ?: "") }.getOrDefault(ThemeMode.SYSTEM),
            accentColor = runCatching { AccentColor.valueOf(prefs[Keys.ACCENT] ?: "") }.getOrDefault(AccentColor.BLUE),
            useDynamicColor = prefs[Keys.DYNAMIC_COLOR] ?: true,
            textScale = prefs[Keys.TEXT_SCALE] ?: 1.0f,
            imageQuality = runCatching { MediaQuality.valueOf(prefs[Keys.IMAGE_QUALITY] ?: "") }.getOrDefault(MediaQuality.HIGH),
            videoQuality = runCatching { MediaQuality.valueOf(prefs[Keys.VIDEO_QUALITY] ?: "") }.getOrDefault(MediaQuality.MEDIUM),
            trafficSaverEnabled = prefs[Keys.TRAFFIC_SAVER] ?: false,
            autoplayVideos = prefs[Keys.AUTOPLAY] ?: true,
            hideAds = prefs[Keys.HIDE_ADS] ?: true,
            notifyLikes = prefs[Keys.NOTIFY_LIKES] ?: true,
            notifyComments = prefs[Keys.NOTIFY_COMMENTS] ?: true,
            notifyMessages = prefs[Keys.NOTIFY_MESSAGES] ?: true,
            privacyShowOnlineStatus = prefs[Keys.PRIVACY_ONLINE] ?: true,
        )
    }

    suspend fun setThemeMode(mode: ThemeMode) = context.dataStore.edit { it[Keys.THEME_MODE] = mode.name }
    suspend fun setAccentColor(color: AccentColor) = context.dataStore.edit { it[Keys.ACCENT] = color.name }
    suspend fun setUseDynamicColor(enabled: Boolean) = context.dataStore.edit { it[Keys.DYNAMIC_COLOR] = enabled }
    suspend fun setTextScale(scale: Float) = context.dataStore.edit { it[Keys.TEXT_SCALE] = scale }
    suspend fun setImageQuality(quality: MediaQuality) = context.dataStore.edit { it[Keys.IMAGE_QUALITY] = quality.name }
    suspend fun setVideoQuality(quality: MediaQuality) = context.dataStore.edit { it[Keys.VIDEO_QUALITY] = quality.name }
    suspend fun setTrafficSaver(enabled: Boolean) = context.dataStore.edit { it[Keys.TRAFFIC_SAVER] = enabled }
    suspend fun setAutoplayVideos(enabled: Boolean) = context.dataStore.edit { it[Keys.AUTOPLAY] = enabled }
    suspend fun setHideAds(enabled: Boolean) = context.dataStore.edit { it[Keys.HIDE_ADS] = enabled }
    suspend fun setNotifyLikes(enabled: Boolean) = context.dataStore.edit { it[Keys.NOTIFY_LIKES] = enabled }
    suspend fun setNotifyComments(enabled: Boolean) = context.dataStore.edit { it[Keys.NOTIFY_COMMENTS] = enabled }
    suspend fun setNotifyMessages(enabled: Boolean) = context.dataStore.edit { it[Keys.NOTIFY_MESSAGES] = enabled }
    suspend fun setPrivacyShowOnlineStatus(enabled: Boolean) = context.dataStore.edit { it[Keys.PRIVACY_ONLINE] = enabled }

    private object Keys {
        val THEME_MODE = stringPreferencesKey("theme_mode")
        val ACCENT = stringPreferencesKey("accent_color")
        val DYNAMIC_COLOR = booleanPreferencesKey("dynamic_color")
        val TEXT_SCALE = floatPreferencesKey("text_scale")
        val IMAGE_QUALITY = stringPreferencesKey("image_quality")
        val VIDEO_QUALITY = stringPreferencesKey("video_quality")
        val TRAFFIC_SAVER = booleanPreferencesKey("traffic_saver")
        val AUTOPLAY = booleanPreferencesKey("autoplay_videos")
        val HIDE_ADS = booleanPreferencesKey("hide_ads")
        val NOTIFY_LIKES = booleanPreferencesKey("notify_likes")
        val NOTIFY_COMMENTS = booleanPreferencesKey("notify_comments")
        val NOTIFY_MESSAGES = booleanPreferencesKey("notify_messages")
        val PRIVACY_ONLINE = booleanPreferencesKey("privacy_online")
    }
}
