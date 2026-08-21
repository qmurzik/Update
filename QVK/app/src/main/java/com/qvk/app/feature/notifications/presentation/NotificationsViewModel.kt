package com.qvk.app.feature.notifications.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.qvk.app.core.common.Resource
import com.qvk.app.feature.notifications.data.AppNotification
import com.qvk.app.feature.notifications.data.NotificationsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class NotificationsUiState(
    val items: List<AppNotification> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
)

@HiltViewModel
class NotificationsViewModel @Inject constructor(
    private val repository: NotificationsRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(NotificationsUiState())
    val state: StateFlow<NotificationsUiState> = _state.asStateFlow()

    init { load() }

    fun load() = viewModelScope.launch {
        _state.value = _state.value.copy(isLoading = true, error = null)
        when (val result = repository.getNotifications()) {
            is Resource.Success -> _state.value = _state.value.copy(isLoading = false, items = result.data)
            is Resource.Error -> _state.value = _state.value.copy(isLoading = false, error = result.message)
            Resource.Loading -> Unit
        }
    }
}
