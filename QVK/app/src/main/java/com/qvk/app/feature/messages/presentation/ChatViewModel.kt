package com.qvk.app.feature.messages.presentation

import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.qvk.app.core.model.ChatMessage
import com.qvk.app.feature.messages.data.MessagesRepository
import com.qvk.app.feature.messages.data.longpoll.LongPollEvent
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val repository: MessagesRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    val peerId: Long = checkNotNull(savedStateHandle["peerId"])
    val title: String = Uri.decode(checkNotNull(savedStateHandle["title"]))

    val messages: StateFlow<List<ChatMessage>> = repository.observeHistory(peerId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    init {
        viewModelScope.launch {
            repository.refreshHistory(peerId)
            repository.markRead(peerId)
        }
        viewModelScope.launch {
            repository.longPollEvents().collect { event ->
                if (event is LongPollEvent.NewOrEditedMessage && event.peerId == peerId) {
                    repository.refreshHistory(peerId)
                    repository.markRead(peerId)
                }
            }
        }
    }

    fun send(text: String) {
        if (text.isBlank()) return
        viewModelScope.launch { repository.sendMessage(peerId, text) }
    }
}
