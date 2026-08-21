package com.qvk.app.feature.feed.presentation

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.qvk.app.core.common.Resource
import com.qvk.app.core.model.Comment
import com.qvk.app.feature.feed.data.CommentsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PostDetailUiState(
    val comments: List<Comment> = emptyList(),
    val isLoading: Boolean = true,
    val isSending: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class PostDetailViewModel @Inject constructor(
    private val repository: CommentsRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val ownerId: Long = checkNotNull(savedStateHandle["ownerId"])
    private val postId: Long = checkNotNull(savedStateHandle["postId"])

    private val _state = MutableStateFlow(PostDetailUiState())
    val state: StateFlow<PostDetailUiState> = _state.asStateFlow()

    init { load() }

    fun load() = viewModelScope.launch {
        _state.value = _state.value.copy(isLoading = true, error = null)
        when (val result = repository.getComments(ownerId, postId)) {
            is Resource.Success -> _state.value = _state.value.copy(comments = result.data, isLoading = false)
            is Resource.Error -> _state.value = _state.value.copy(isLoading = false, error = result.message)
            Resource.Loading -> Unit
        }
    }

    fun sendComment(text: String) {
        if (text.isBlank()) return
        viewModelScope.launch {
            _state.value = _state.value.copy(isSending = true)
            when (repository.addComment(ownerId, postId, text)) {
                is Resource.Success -> load()
                is Resource.Error -> _state.value = _state.value.copy(isSending = false, error = "Не удалось отправить комментарий")
                Resource.Loading -> Unit
            }
            _state.value = _state.value.copy(isSending = false)
        }
    }
}
