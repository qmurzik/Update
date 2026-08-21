package com.qvk.app.feature.video.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.qvk.app.core.common.Resource
import com.qvk.app.core.model.Attachment
import com.qvk.app.feature.video.data.VideoRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class VideoUiState(
    val videos: List<Attachment.Video> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
)

@HiltViewModel
class VideoViewModel @Inject constructor(
    private val repository: VideoRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(VideoUiState())
    val state: StateFlow<VideoUiState> = _state.asStateFlow()

    init { load() }

    fun load() = viewModelScope.launch {
        _state.value = _state.value.copy(isLoading = true, error = null)
        when (val result = repository.getMyVideos()) {
            is Resource.Success -> _state.value = _state.value.copy(isLoading = false, videos = result.data)
            is Resource.Error -> _state.value = _state.value.copy(isLoading = false, error = result.message)
            Resource.Loading -> Unit
        }
    }

    fun search(query: String) {
        if (query.isBlank()) {
            load()
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true)
            when (val result = repository.search(query)) {
                is Resource.Success -> _state.value = _state.value.copy(isLoading = false, videos = result.data)
                is Resource.Error -> _state.value = _state.value.copy(isLoading = false, error = result.message)
                Resource.Loading -> Unit
            }
        }
    }
}
