package com.qvk.app.feature.settings.presentation

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil.imageLoader
import com.qvk.app.core.database.AppDatabase
import com.qvk.app.core.datastore.AccentColor
import com.qvk.app.core.datastore.MediaQuality
import com.qvk.app.core.datastore.QvkSettings
import com.qvk.app.core.datastore.SettingsDataStore
import com.qvk.app.core.datastore.ThemeMode
import com.qvk.app.core.security.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val settingsDataStore: SettingsDataStore,
    private val database: AppDatabase,
    private val tokenManager: TokenManager,
    @ApplicationContext private val context: Context,
) : ViewModel() {

    val settings: StateFlow<QvkSettings> = settingsDataStore.settings
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), QvkSettings())

    private val _cacheClearedEvent = MutableStateFlow(0)
    val cacheClearedEvent: StateFlow<Int> = _cacheClearedEvent.asStateFlow()

    fun setThemeMode(mode: ThemeMode) = viewModelScope.launch { settingsDataStore.setThemeMode(mode) }
    fun setAccentColor(color: AccentColor) = viewModelScope.launch { settingsDataStore.setAccentColor(color) }
    fun setUseDynamicColor(enabled: Boolean) = viewModelScope.launch { settingsDataStore.setUseDynamicColor(enabled) }
    fun setTextScale(scale: Float) = viewModelScope.launch { settingsDataStore.setTextScale(scale) }
    fun setImageQuality(quality: MediaQuality) = viewModelScope.launch { settingsDataStore.setImageQuality(quality) }
    fun setVideoQuality(quality: MediaQuality) = viewModelScope.launch { settingsDataStore.setVideoQuality(quality) }
    fun setTrafficSaver(enabled: Boolean) = viewModelScope.launch { settingsDataStore.setTrafficSaver(enabled) }
    fun setAutoplayVideos(enabled: Boolean) = viewModelScope.launch { settingsDataStore.setAutoplayVideos(enabled) }
    fun setHideAds(enabled: Boolean) = viewModelScope.launch { settingsDataStore.setHideAds(enabled) }
    fun setNotifyLikes(enabled: Boolean) = viewModelScope.launch { settingsDataStore.setNotifyLikes(enabled) }
    fun setNotifyComments(enabled: Boolean) = viewModelScope.launch { settingsDataStore.setNotifyComments(enabled) }
    fun setNotifyMessages(enabled: Boolean) = viewModelScope.launch { settingsDataStore.setNotifyMessages(enabled) }
    fun setPrivacyOnline(enabled: Boolean) = viewModelScope.launch { settingsDataStore.setPrivacyShowOnlineStatus(enabled) }

    fun clearCache() = viewModelScope.launch {
        database.clearAllTables()
        context.imageLoader.memoryCache?.clear()
        context.imageLoader.diskCache?.clear()
        _cacheClearedEvent.value += 1
    }

    fun logout() = tokenManager.logoutAll()
}
