package com.qvk.app.feature.video.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.qvk.app.R
import com.qvk.app.core.model.Attachment
import com.qvk.app.core.ui.components.EmptyState
import com.qvk.app.core.ui.components.ErrorState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VideoScreen(
    onOpenVideo: (Attachment.Video) -> Unit,
    viewModel: VideoViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    var query by remember { mutableStateOf("") }

    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.nav_video)) }) }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            TextField(
                value = query,
                onValueChange = { query = it; viewModel.search(it) },
                modifier = Modifier.fillMaxWidth().padding(12.dp),
                placeholder = { Text("Поиск видео") },
                singleLine = true,
            )
            when {
                state.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                state.error != null -> ErrorState(state.error!!, onRetry = viewModel::load)
                state.videos.isEmpty() -> EmptyState("Видео не найдены")
                else -> LazyColumn(Modifier.fillMaxSize()) {
                    items(state.videos, key = { "${it.ownerId}_${it.videoId}" }) { video ->
                        VideoRow(video, onClick = { onOpenVideo(video) })
                    }
                }
            }
        }
    }
}

@Composable
private fun VideoRow(video: Attachment.Video, onClick: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(12.dp).clickable(onClick = onClick)) {
        Box(
            Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .clip(RoundedCornerShape(16.dp)),
        ) {
            if (video.previewUrl != null) {
                AsyncImage(model = video.previewUrl, contentDescription = video.title, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            } else {
                Box(Modifier.fillMaxSize().clip(RoundedCornerShape(16.dp))) {}
            }
            Icon(Icons.Filled.PlayArrow, contentDescription = null, tint = Color.White, modifier = Modifier.align(Alignment.Center))
        }
        Text(video.title, style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(top = 6.dp))
    }
}
