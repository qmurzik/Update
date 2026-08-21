package com.qvk.app.navigation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.qvk.app.core.datastore.QvkSettings
import com.qvk.app.core.datastore.SettingsDataStore
import com.qvk.app.core.security.TokenManager
import com.qvk.app.feature.messages.data.MessagesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

@HiltViewModel
class AppRootViewModel @Inject constructor(
    private val tokenManager: TokenManager,
    settingsDataStore: SettingsDataStore,
    messagesRepository: MessagesRepository,
) : ViewModel() {

    val isLoggedIn: StateFlow<Boolean?> = tokenManager.activeAccountId
        .map { it != null }
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val settings: StateFlow<QvkSettings> = settingsDataStore.settings
        .stateIn(viewModelScope, SharingStarted.Eagerly, QvkSettings())

    val unreadMessages: StateFlow<Int> = messagesRepository.observeTotalUnread()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)
}
