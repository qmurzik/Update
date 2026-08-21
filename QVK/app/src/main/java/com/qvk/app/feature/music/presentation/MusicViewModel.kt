package com.qvk.app.feature.music.presentation

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import com.qvk.app.core.model.Attachment
import com.qvk.app.feature.music.data.MusicRepository
import com.qvk.app.feature.music.data.MusicResult
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class MusicScreenState { LOADING, UNAVAILABLE, AVAILABLE, ERROR }

data class MusicUiState(
    val screenState: MusicScreenState = MusicScreenState.LOADING,
    val tracks: List<Attachment.Audio> = emptyList(),
    val nowPlaying: Attachment.Audio? = null,
    val isPlaying: Boolean = false,
    val errorMessage: String? = null,
)

@HiltViewModel
class MusicViewModel @Inject constructor(
    private val repository: MusicRepository,
    @ApplicationContext context: Context,
) : ViewModel() {

    /** Drives real playback for any track whose [Attachment.Audio.directUrl] is non-null (see
     * [MusicRepository] for why that's rarely the case for third-party VK clients). Background
     * playback across the whole app goes through [com.qvk.app.core.media.MusicPlaybackService]. */
    val player: ExoPlayer = ExoPlayer.Builder(context).build()

    private val _state = MutableStateFlow(MusicUiState())
    val state: StateFlow<MusicUiState> = _state.asStateFlow()

    init {
        load()
        player.addListener(object : androidx.media3.common.Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                _state.value = _state.value.copy(isPlaying = isPlaying)
            }
        })
    }

    fun load() = viewModelScope.launch {
        _state.value = _state.value.copy(screenState = MusicScreenState.LOADING)
        when (val result = repository.getMyTracks()) {
            is MusicResult.Available -> _state.value = _state.value.copy(screenState = MusicScreenState.AVAILABLE, tracks = result.tracks)
            MusicResult.Unavailable -> _state.value = _state.value.copy(screenState = MusicScreenState.UNAVAILABLE)
            is MusicResult.Error -> _state.value = _state.value.copy(screenState = MusicScreenState.ERROR, errorMessage = result.message)
        }
    }

    fun search(query: String) = viewModelScope.launch {
        if (query.isBlank()) return@launch load()
        when (val result = repository.search(query)) {
            is MusicResult.Available -> _state.value = _state.value.copy(screenState = MusicScreenState.AVAILABLE, tracks = result.tracks)
            MusicResult.Unavailable -> _state.value = _state.value.copy(screenState = MusicScreenState.UNAVAILABLE)
            is MusicResult.Error -> _state.value = _state.value.copy(screenState = MusicScreenState.ERROR, errorMessage = result.message)
        }
    }

    fun play(track: Attachment.Audio) {
        val url = track.directUrl ?: return
        player.setMediaItem(MediaItem.fromUri(url))
        player.prepare()
        player.play()
        _state.value = _state.value.copy(nowPlaying = track)
    }

    fun togglePlayPause() {
        if (player.isPlaying) player.pause() else player.play()
    }

    override fun onCleared() {
        player.release()
        super.onCleared()
    }
}
