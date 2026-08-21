package com.qvk.app.feature.messages.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.qvk.app.core.model.Conversation
import com.qvk.app.feature.messages.data.MessagesRepository
import com.qvk.app.feature.messages.data.longpoll.LongPollEvent
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MessagesViewModel @Inject constructor(
    private val repository: MessagesRepository,
) : ViewModel() {

    val conversations: StateFlow<List<Conversation>> = repository.observeConversations()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _isRefreshing = MutableStateFlow(true)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    init {
        refresh()
        viewModelScope.launch {
            repository.longPollEvents().collect { event ->
                when (event) {
                    is LongPollEvent.NewOrEditedMessage, LongPollEvent.ConversationsChanged -> refresh()
                }
            }
        }
    }

    fun refresh() = viewModelScope.launch {
        _isRefreshing.value = true
        repository.refreshConversations()
        _isRefreshing.value = false
    }
}
