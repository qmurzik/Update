package com.qvk.app.feature.music.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.qvk.app.R
import com.qvk.app.core.model.Attachment
import com.qvk.app.core.ui.components.ErrorState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MusicScreen(viewModel: MusicViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    var query by remember { mutableStateOf("") }

    Scaffold(topBar = { TopAppBar(title = { Text("Музыка") }) }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            when (state.screenState) {
                MusicScreenState.LOADING -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                MusicScreenState.UNAVAILABLE -> MusicUnavailableNotice()
                MusicScreenState.ERROR -> ErrorState(state.errorMessage ?: "Ошибка", onRetry = viewModel::load)
                MusicScreenState.AVAILABLE -> {
                    TextField(
                        value = query,
                        onValueChange = { query = it; viewModel.search(it) },
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        placeholder = { Text("Поиск треков") },
                        singleLine = true,
                    )
                    LazyColumn(Modifier.fillMaxSize()) {
                        items(state.tracks, key = { "${it.ownerId}_${it.audioId}" }) { track ->
                            TrackRow(track, isPlaying = state.isPlaying && state.nowPlaying == track, onClick = {
                                if (state.nowPlaying == track) viewModel.togglePlayPause() else viewModel.play(track)
                            })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TrackRow(track: Attachment.Audio, isPlaying: Boolean, onClick: () -> Unit) {
    ListItem(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        leadingContent = { Icon(Icons.Filled.MusicNote, contentDescription = null) },
        headlineContent = { Text(track.title) },
        supportingContent = { Text(track.artist) },
        trailingContent = {
            IconButton(onClick = onClick) {
                Icon(if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow, contentDescription = null)
            }
        },
    )
}

@Composable
private fun MusicUnavailableNotice() {
    Column(Modifier.fillMaxSize().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Filled.MusicNote, contentDescription = null, modifier = Modifier.padding(top = 48.dp))
        Text(
            stringResource(R.string.music_unavailable_title),
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            stringResource(R.string.music_unavailable_body),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}
